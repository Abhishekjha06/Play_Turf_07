-- ====================================================================
-- PLAY_TURF: Fix ALL RPC functions to return JSON + avoid $$ issues
-- Use $func$ instead of $$ so Supabase SQL Editor doesn't break on semicolons
-- ====================================================================

-- Drop old functions first (clean slate)
DROP FUNCTION IF EXISTS public.host_open_game(text,text,text,text,text,text,integer,integer,integer,boolean,text,text,text,text,double precision,double precision);
DROP FUNCTION IF EXISTS public.join_open_game(text,text,text,text,text);
DROP FUNCTION IF EXISTS public.request_join_open_game(text,text,text,text);
DROP FUNCTION IF EXISTS public.approve_join_request(text,text,text);
DROP FUNCTION IF EXISTS public.reject_join_request(text,text,text);
DROP FUNCTION IF EXISTS public.leave_open_game(text,text);
DROP FUNCTION IF EXISTS public.cancel_open_game(text,text,boolean);
DROP FUNCTION IF EXISTS public.pay_private_game_share(text,text,text);

-- ====================================================================
-- 1. host_open_game — RETURNS JSONB (not text)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.host_open_game(
    p_sport          text,
    p_turf_id        text,
    p_turf_name      text,
    p_turf_image     text,
    p_date           text,
    p_start_time     text,
    p_duration_hours integer,
    p_total_amount   integer,
    p_slots_total    integer,
    p_is_private     boolean,
    p_cancellation   text,
    p_host_user_id   text,
    p_host_name      text,
    p_host_avatar    text,
    p_lat            double precision DEFAULT NULL,
    p_lng            double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_game_id     text;
    v_booking_id  text;
    v_payment_id  text;
    v_end_time    text;
    v_start_ts    timestamp;
    v_price_slot  integer;
    v_now         timestamp;
BEGIN
    v_now := timezone('Asia/Kolkata'::text, now())::timestamp;

    -- Validate input
    IF p_duration_hours < 1 OR p_duration_hours > 12 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Duration must be between 1 and 12 hours.');
    END IF;
    IF p_slots_total < 2 OR p_slots_total > 50 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Player limit must be between 2 and 50.');
    END IF;
    IF p_total_amount < 100 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Total amount must be at least 100.');
    END IF;

    -- Expiry guard
    IF p_date < to_char(v_now, 'YYYY-MM-DD') THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Booking is not available for past dates. Please select a valid date.');
    END IF;
    IF p_date = to_char(v_now, 'YYYY-MM-DD') THEN
        v_start_ts := (p_date || ' ' || p_start_time)::timestamp;
        IF v_start_ts <= v_now THEN
            RETURN jsonb_build_object('ok', false, 'reason', 'This slot has already started. Please select a future time.');
        END IF;
    END IF;

    -- Pre-check: existing active booking on this slot (non-split)
    IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE turf_id = p_turf_id
          AND date = p_date
          AND start_time = p_start_time
          AND status != 'CANCELLED'
          AND is_split_booking = false
    ) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This slot has already been booked by another user.');
    END IF;

    -- Generate IDs
    v_game_id     := 'game_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text;
    v_booking_id  := 'bkg_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text;
    v_payment_id  := 'pay_' || md5(v_booking_id);
    v_start_ts    := (p_date || ' ' || p_start_time)::timestamp;
    v_end_time    := to_char(v_start_ts + (p_duration_hours || ' hours')::interval, 'HH24:MI');
    v_price_slot  := GREATEST(1, ROUND(p_total_amount::numeric / GREATEST(1, p_slots_total)))::integer;

    -- 1. Insert host booking (overlap trigger will fire)
    INSERT INTO public.bookings (
        id, user_id, turf_id, turf_name, turf_image,
        date, start_time, end_time, hours, amount,
        status, payment_id, open_game_id, is_split_booking, created_at
    ) VALUES (
        v_booking_id, p_host_user_id, p_turf_id, p_turf_name, p_turf_image,
        p_date, p_start_time, v_end_time, p_duration_hours, v_price_slot,
        'CONFIRMED', v_payment_id, v_game_id, false, now()
    );

    -- 2. Insert open game
    INSERT INTO public.open_games (
        id, sport, venue, turf_id, date, time, duration_hours,
        price_per_slot, total_amount, slots_total, slots_filled,
        status, distance, host_name, host_avatar, host_user_id,
        cancellation_policy, is_private, lat, lng, created_at
    ) VALUES (
        v_game_id, p_sport, p_turf_name, p_turf_id, p_date, p_start_time, p_duration_hours,
        v_price_slot, p_total_amount, p_slots_total, 1,
        'open', 0, p_host_name, p_host_avatar, p_host_user_id,
        p_cancellation, p_is_private, p_lat, p_lng, now()
    );

    -- 3. Insert host player
    INSERT INTO public.open_game_players (
        id, open_game_id, user_id, name, avatar,
        payment_status, payment_method, booking_id, is_host, joined_at
    ) VALUES (
        'gp_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text,
        v_game_id, p_host_user_id, p_host_name, p_host_avatar,
        'paid', 'Host', v_booking_id, true, now()
    );

    RETURN jsonb_build_object('ok', true, 'game_id', v_game_id, 'booking_id', v_booking_id);
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Transaction failed: ' || SQLERRM);
END;
$func$;

-- ====================================================================
-- 2. join_open_game — RETURNS JSONB
-- ====================================================================

CREATE OR REPLACE FUNCTION public.join_open_game(
    p_game_id        text,
    p_user_id        text,
    p_name           text,
    p_avatar         text,
    p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_game          record;
    v_updated       integer;
    v_booking_id    text;
    v_payment_id    text;
    v_end_time      text;
    v_start_ts      timestamp;
BEGIN
    SELECT * INTO v_game FROM public.open_games WHERE id = p_game_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    IF v_game.status = 'cancelled' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Cannot join a cancelled game.');
    END IF;
    IF v_game.is_private THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This is a private game. Use the request flow.');
    END IF;

    -- Already joined?
    IF EXISTS (
        SELECT 1 FROM public.open_game_players
        WHERE open_game_id = p_game_id AND user_id = p_user_id
    ) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'You have already joined this game.');
    END IF;

    -- Atomic increment
    UPDATE public.open_games
       SET slots_filled = slots_filled + 1,
           status = CASE WHEN slots_filled + 1 >= slots_total THEN 'full' ELSE 'open' END
     WHERE id = p_game_id
       AND status = 'open'
       AND slots_filled < slots_total;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game is already full.');
    END IF;

    -- Pre-check: duplicate active booking on this slot (non-split)
    IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE turf_id = v_game.turf_id
          AND date = v_game.date
          AND start_time = v_game.time
          AND status != 'CANCELLED'
          AND is_split_booking = false
    ) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This slot has already been booked.');
    END IF;

    v_start_ts   := (v_game.date || ' ' || v_game.time)::timestamp;
    v_end_time   := to_char(v_start_ts + (v_game.duration_hours || ' hours')::interval, 'HH24:MI');
    v_booking_id := 'bkg_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text;
    v_payment_id := 'pay_' || md5(v_booking_id || p_user_id);

    INSERT INTO public.bookings (
        id, user_id, turf_id, turf_name, turf_image,
        date, start_time, end_time, hours, amount,
        status, payment_id, open_game_id, is_split_booking, created_at
    ) SELECT
        v_booking_id, p_user_id, v_game.turf_id, v_game.venue,
        (SELECT image FROM public.turfs WHERE id = v_game.turf_id LIMIT 1),
        v_game.date, v_game.time, v_end_time, v_game.duration_hours,
        v_game.price_per_slot, 'CONFIRMED', v_payment_id, p_game_id, true, now()
    WHERE v_game.turf_id IS NOT NULL;

    INSERT INTO public.open_game_players (
        id, open_game_id, user_id, name, avatar,
        payment_status, payment_method, booking_id, is_host, joined_at
    ) VALUES (
        'gp_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text,
        p_game_id, p_user_id, p_name, p_avatar,
        'paid', p_payment_method, v_booking_id, false, now()
    );

    RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'This slot has already been booked or an error occurred.');
END;
$func$;

-- ====================================================================
-- 3. request_join_open_game
-- ====================================================================

CREATE OR REPLACE FUNCTION public.request_join_open_game(
    p_game_id text,
    p_user_id text,
    p_name    text,
    p_avatar  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_game record;
BEGIN
    SELECT status, is_private, slots_filled, slots_total
      INTO v_game FROM public.open_games WHERE id = p_game_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    IF v_game.status = 'cancelled' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Cannot join a cancelled game.');
    END IF;
    IF v_game.slots_filled >= v_game.slots_total THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game is already full.');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.open_game_players
        WHERE open_game_id = p_game_id AND user_id = p_user_id
    ) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'You have already joined or requested.');
    END IF;

    INSERT INTO public.open_game_players (
        id, open_game_id, user_id, name, avatar,
        payment_status, payment_method, booking_id, is_host, joined_at
    ) VALUES (
        'gp_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text,
        p_game_id, p_user_id, p_name, p_avatar,
        'requested', NULL, NULL, false, now()
    );

    RETURN jsonb_build_object('ok', true);
END;
$func$;

-- ====================================================================
-- 4. approve_join_request
-- ====================================================================

CREATE OR REPLACE FUNCTION public.approve_join_request(
    p_game_id      text,
    p_player_id    text,
    p_host_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_game   record;
    v_player record;
    v_updated integer;
BEGIN
    SELECT * INTO v_game FROM public.open_games WHERE id = p_game_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    IF v_game.host_user_id <> p_host_user_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Only the host can approve requests.');
    END IF;

    SELECT * INTO v_player FROM public.open_game_players
     WHERE id = p_player_id AND open_game_id = p_game_id;
    IF NOT FOUND OR v_player.payment_status <> 'requested' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'No such pending request.');
    END IF;

    UPDATE public.open_games
       SET slots_filled = slots_filled + 1,
           status = CASE WHEN slots_filled + 1 >= slots_total THEN 'full' ELSE 'open' END
     WHERE id = p_game_id AND status = 'open' AND slots_filled < slots_total;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game is full — cannot approve.');
    END IF;

    UPDATE public.open_game_players
       SET payment_status = 'approved'
     WHERE id = p_player_id;

    RETURN jsonb_build_object('ok', true);
END;
$func$;

-- ====================================================================
-- 5. reject_join_request
-- ====================================================================

CREATE OR REPLACE FUNCTION public.reject_join_request(
    p_game_id      text,
    p_player_id    text,
    p_host_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_host      text;
    v_player    record;
BEGIN
    SELECT host_user_id INTO v_host FROM public.open_games WHERE id = p_game_id;
    IF v_host IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    IF v_host <> p_host_user_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Only the host can reject requests.');
    END IF;

    SELECT * INTO v_player FROM public.open_game_players
     WHERE id = p_player_id AND open_game_id = p_game_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Player request not found.');
    END IF;

    IF v_player.payment_status = 'requested' THEN
        DELETE FROM public.open_game_players WHERE id = p_player_id;
    ELSIF v_player.payment_status = 'approved' THEN
        DELETE FROM public.open_game_players WHERE id = p_player_id;
        UPDATE public.open_games
           SET slots_filled = GREATEST(0, slots_filled - 1),
               status = CASE WHEN slots_filled - 1 < slots_total THEN 'open' ELSE status END
         WHERE id = p_game_id;
    ELSE
        RETURN jsonb_build_object('ok', false, 'reason', 'Cannot reject a player who has already paid.');
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$func$;

-- ====================================================================
-- 6. pay_private_game_share
-- ====================================================================

CREATE OR REPLACE FUNCTION public.pay_private_game_share(
    p_game_id        text,
    p_user_id        text,
    p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_game          record;
    v_player        record;
    v_booking_id    text;
    v_payment_id    text;
    v_end_time      text;
    v_start_ts      timestamp;
BEGIN
    SELECT * INTO v_game FROM public.open_games WHERE id = p_game_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;

    SELECT * INTO v_player FROM public.open_game_players
     WHERE open_game_id = p_game_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Player request not found.');
    END IF;
    IF v_player.payment_status = 'paid' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Already paid.');
    END IF;
    IF v_player.payment_status <> 'approved' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Request is not approved by host yet.');
    END IF;

    v_start_ts   := (v_game.date || ' ' || v_game.time)::timestamp;
    v_end_time   := to_char(v_start_ts + (v_game.duration_hours || ' hours')::interval, 'HH24:MI');
    v_booking_id := 'bkg_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text;
    v_payment_id := 'pay_' || md5(v_booking_id || p_user_id);

    INSERT INTO public.bookings (
        id, user_id, turf_id, turf_name, turf_image,
        date, start_time, end_time, hours, amount,
        status, payment_id, open_game_id, is_split_booking, created_at
    ) SELECT
        v_booking_id, p_user_id, v_game.turf_id, v_game.venue,
        (SELECT image FROM public.turfs WHERE id = v_game.turf_id LIMIT 1),
        v_game.date, v_game.time, v_end_time, v_game.duration_hours,
        v_game.price_per_slot, 'CONFIRMED', v_payment_id, p_game_id, true, now()
    WHERE v_game.turf_id IS NOT NULL;

    UPDATE public.open_game_players
       SET payment_status = 'paid',
           payment_method = p_payment_method,
           booking_id = v_booking_id
     WHERE id = v_player.id;

    RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$func$;

-- ====================================================================
-- 7. leave_open_game
-- ====================================================================

CREATE OR REPLACE FUNCTION public.leave_open_game(
    p_game_id text,
    p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_player record;
    v_updated integer;
BEGIN
    SELECT * INTO v_player FROM public.open_game_players
     WHERE open_game_id = p_game_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'You are not part of this game.');
    END IF;
    IF v_player.is_host THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Host cannot leave. Cancel the game instead.');
    END IF;
    IF v_player.payment_status = 'requested' THEN
        DELETE FROM public.open_game_players WHERE id = v_player.id;
        RETURN jsonb_build_object('ok', true);
    END IF;

    IF v_player.booking_id IS NOT NULL THEN
        UPDATE public.bookings SET status = 'CANCELLED' WHERE id = v_player.booking_id;
    END IF;

    DELETE FROM public.open_game_players WHERE id = v_player.id;

    UPDATE public.open_games
       SET slots_filled = GREATEST(0, slots_filled - 1),
           status = CASE WHEN slots_filled - 1 < slots_total THEN 'open' ELSE status END
     WHERE id = p_game_id
       AND status IN ('full', 'open');
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN jsonb_build_object('ok', true);
END;
$func$;

-- ====================================================================
-- 8. cancel_open_game
-- ====================================================================

CREATE OR REPLACE FUNCTION public.cancel_open_game(
    p_game_id text,
    p_user_id text,
    p_is_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_host text;
BEGIN
    SELECT host_user_id INTO v_host FROM public.open_games WHERE id = p_game_id;
    IF v_host IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    IF v_host <> p_user_id AND p_is_admin = false THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Only the host can cancel this game.');
    END IF;

    UPDATE public.open_games SET status = 'cancelled' WHERE id = p_game_id;

    UPDATE public.bookings
       SET status = 'CANCELLED'
     WHERE open_game_id = p_game_id
       AND status NOT IN ('CANCELLED', 'COMPLETED');

    RETURN jsonb_build_object('ok', true);
END;
$func$;

-- ====================================================================
-- 9. Grant permissions
-- ====================================================================

GRANT EXECUTE ON FUNCTION public.host_open_game(text,text,text,text,text,text,integer,integer,integer,boolean,text,text,text,text,double precision,double precision) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.join_open_game(text,text,text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_join_open_game(text,text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.approve_join_request(text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reject_join_request(text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.leave_open_game(text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cancel_open_game(text,text,boolean) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pay_private_game_share(text,text,text) TO authenticated, anon;

-- ====================================================================
-- DONE: All 8 RPC functions now return JSON and use $func$ instead of $$
-- ====================================================================
