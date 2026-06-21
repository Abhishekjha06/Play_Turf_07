-- ====================================================================
-- OPEN GAMES FIX MIGRATION
-- Makes Open Games atomic, race-safe, overlap-aware, and complete
-- (host approve/reject, leave, real distance, real identity).
--
-- Run this ONCE on your Supabase project (SQL Editor → New query).
-- Safe to re-run: every statement is idempotent (CREATE OR REPLACE / IF NOT EXISTS).
-- ====================================================================

-- --------------------------------------------------------------------
-- 0. Schema adjustments
-- --------------------------------------------------------------------

-- Real geo coordinates so distance is computed from the turf, not random.
ALTER TABLE public.open_games
    ADD COLUMN IF NOT EXISTS lat double precision,
    ADD COLUMN IF NOT EXISTS lng double precision;

-- Duration in hours (was hardcoded +1h client-side). Default 1.
ALTER TABLE public.open_games
    ADD COLUMN IF NOT EXISTS duration_hours integer NOT NULL DEFAULT 1;

-- Normalise start_time to 24h HH:MM. Keep old text values working via a
-- generated cast is overkill; the RPC layer enforces HH:MM going forward.
ALTER TABLE public.open_game_players
    ADD COLUMN IF NOT EXISTS is_host boolean NOT NULL DEFAULT false;

-- pending join requests for PRIVATE games use payment_status = 'requested'.
-- Lifecycle: requested -> (approved => paid) | (rejected => removed)


-- --------------------------------------------------------------------
-- 1. Overlap trigger fix
--    The original trigger counted ALL non-cancelled bookings, which blocks
--    players 2..N from joining an open game (their split-payment bookings
--    overlap the host's court reservation). Split bookings are payment
--    shares, NOT court reservations, so they must be excluded from the
--    overlap check.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_booking_overlap_and_expiry()
RETURNS trigger AS $$
DECLARE
    existing_count integer;
    slot_timestamp timestamp;
    current_server_time timestamp;
BEGIN
    -- 1. Expiry Validation (IST - Asia/Kolkata)
    IF NEW.date = to_char(timezone('Asia/Kolkata'::text, now()), 'YYYY-MM-DD') THEN
        slot_timestamp := (NEW.date || ' ' || NEW.start_time)::timestamp;
        current_server_time := timezone('Asia/Kolkata'::text, now())::timestamp;
        IF slot_timestamp <= current_server_time THEN
            RAISE EXCEPTION 'This slot has already expired and cannot be booked.';
        END IF;
    END IF;

    -- 2. Multi-hour Overlap Check
    --    Only NON-split bookings reserve the court. Split bookings
    --    (is_split_booking = true) are individual player payment shares
    --    inside an already-reserved open-game slot and must NOT block
    --    each other or be blocked by the host reservation.
    IF NEW.is_split_booking = false THEN
        SELECT COUNT(*) INTO existing_count
        FROM public.bookings
        WHERE turf_id = NEW.turf_id
          AND date = NEW.date
          AND status != 'CANCELLED'
          AND is_split_booking = false
          AND id != NEW.id
          AND (
            (NEW.start_time::time < end_time::time) AND
            (NEW.end_time::time > start_time::time)
          );

        IF existing_count > 0 THEN
            RAISE EXCEPTION 'One or more slots in this time range are already booked.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (trigger already exists from base schema; just rebinding is harmless)
DROP TRIGGER IF EXISTS trg_check_booking_overlap_and_expiry ON public.bookings;
CREATE TRIGGER trg_check_booking_overlap_and_expiry
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.check_booking_overlap_and_expiry();


-- --------------------------------------------------------------------
-- 2. Host an open game  —  atomic create
--    Creates: open_games row + host player + host court booking in ONE
--    transaction. The host's booking is is_split_booking=false so it is
--    a real court reservation (subject to the overlap trigger above).
--    Returns the new game id.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.host_open_game(
    p_sport          text,
    p_turf_id        text,
    p_turf_name      text,
    p_turf_image     text,
    p_date           text,        -- YYYY-MM-DD
    p_start_time     text,        -- HH:MM 24h
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
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_game_id     text := 'game_' || extract(epoch from now())::bigint::text || '_' || floor(random()*1000)::int::text;
    v_booking_id  text := 'bkg_' || extract(epoch from now())::bigint::text || '_' || floor(random()*1000)::int::text;
    v_payment_id  text := 'pay_' || md5(v_booking_id);
    v_end_time    text;
    v_start_ts    timestamp;
    v_price_slot  integer;
BEGIN
    -- Validate time format and compute end
    v_start_ts := (p_date || ' ' || p_start_time)::timestamp;
    v_end_time := to_char(v_start_ts + (p_duration_hours || ' hours')::interval, 'HH24:MI');
    v_price_slot := GREATEST(1, ROUND(p_total_amount::numeric / GREATEST(1, p_slots_total)))::integer;

    -- Expiry guard (IST)
    IF p_date = to_char(timezone('Asia/Kolkata'::text, now()), 'YYYY-MM-DD') THEN
        IF v_start_ts <= timezone('Asia/Kolkata'::text, now())::timestamp THEN
            RAISE EXCEPTION 'This slot has already expired and cannot be booked.';
        END IF;
    END IF;

    -- 1. Insert host court reservation FIRST (is_split_booking = false).
    --    The overlap trigger will raise if the turf/date/time is taken.
    INSERT INTO public.bookings (
        id, user_id, turf_id, turf_name, turf_image,
        date, start_time, end_time, hours, amount,
        status, payment_id, open_game_id, is_split_booking, created_at
    ) VALUES (
        v_booking_id, p_host_user_id, p_turf_id, p_turf_name, p_turf_image,
        p_date, p_start_time, v_end_time, p_duration_hours, v_price_slot,
        'CONFIRMED', v_payment_id, v_game_id, false, now()
    );

    -- 2. Insert the open game
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

    -- 3. Insert host player record
    INSERT INTO public.open_game_players (
        id, open_game_id, user_id, name, avatar,
        payment_status, payment_method, booking_id, is_host, joined_at
    ) VALUES (
        'gp_' || extract(epoch from now())::bigint::text, v_game_id, p_host_user_id,
        p_host_name, p_host_avatar, 'paid', 'Host', v_booking_id, true, now()
    );

    RETURN v_game_id;
END;
$$;


-- --------------------------------------------------------------------
-- 3. Join an open game  —  atomic conditional increment
--    Race-safe: the conditional UPDATE acts as a lock. If two users hit
--    the last slot simultaneously, exactly one gets rows-affected = 1.
--    Returns jsonb { ok, reason, booking_id }.
-- --------------------------------------------------------------------

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
AS $$
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
        RETURN jsonb_build_object('ok', false, 'reason',
            'This is a private game. Use the request flow.');
    END IF;

    -- Already joined?
    IF EXISTS (
        SELECT 1 FROM public.open_game_players
        WHERE open_game_id = p_game_id AND user_id = p_user_id
    ) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'You have already joined this game.');
    END IF;

    -- Atomic conditional increment (the lock)
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

    -- Create the joiner's split-payment booking (excluded from overlap)
    v_start_ts   := (v_game.date || ' ' || v_game.time)::timestamp;
    v_end_time   := to_char(v_start_ts + (v_game.duration_hours || ' hours')::interval, 'HH24:MI');
    v_booking_id := 'bkg_' || extract(epoch from now())::bigint::text || '_' || floor(random()*1000)::int::text;
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

    -- Insert player record
    INSERT INTO public.open_game_players (
        id, open_game_id, user_id, name, avatar,
        payment_status, payment_method, booking_id, is_host, joined_at
    ) VALUES (
        'gp_' || extract(epoch from now())::bigint::text || '_' || floor(random()*1000)::int::text,
        p_game_id, p_user_id, p_name, p_avatar,
        'paid', p_payment_method, v_booking_id, false, now()
    );

    RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$$;


-- --------------------------------------------------------------------
-- 4. Request to join a PRIVATE game (no payment yet)
-- --------------------------------------------------------------------

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
AS $$
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
        'gp_' || extract(epoch from now())::bigint::text || '_' || floor(random()*1000)::int::text,
        p_game_id, p_user_id, p_name, p_avatar,
        'requested', NULL, NULL, false, now()
    );

    RETURN jsonb_build_object('ok', true);
END;
$$;


-- --------------------------------------------------------------------
-- 5. Host approves a private join request
--    Atomically increments slot, creates the joiner's booking, flips
--    the player's payment_status requested -> paid.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_join_request(
    p_game_id     text,
    p_player_id   text,
    p_host_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_game   record;
    v_player record;
    v_updated integer;
    v_booking_id text;
    v_payment_id text;
    v_end_time   text;
    v_start_ts   timestamp;
BEGIN
    SELECT * INTO v_game FROM public.open_games WHERE id = p_game_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    -- Authorization: only the host (or an admin via service role) may approve
    IF v_game.host_user_id <> p_host_user_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Only the host can approve requests.');
    END IF;

    SELECT * INTO v_player FROM public.open_game_players
     WHERE id = p_player_id AND open_game_id = p_game_id;
    IF NOT FOUND OR v_player.payment_status <> 'requested' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'No such pending request.');
    END IF;

    -- Atomic conditional increment
    UPDATE public.open_games
       SET slots_filled = slots_filled + 1,
           status = CASE WHEN slots_filled + 1 >= slots_total THEN 'full' ELSE 'open' END
     WHERE id = p_game_id AND status = 'open' AND slots_filled < slots_total;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game is full — cannot approve.');
    END IF;

    v_start_ts   := (v_game.date || ' ' || v_game.time)::timestamp;
    v_end_time   := to_char(v_start_ts + (v_game.duration_hours || ' hours')::interval, 'HH24:MI');
    v_booking_id := 'bkg_' || extract(epoch from now())::bigint::text || '_' || floor(random()*1000)::int::text;
    v_payment_id := 'pay_' || md5(v_booking_id || v_player.user_id);

    INSERT INTO public.bookings (
        id, user_id, turf_id, turf_name, turf_image,
        date, start_time, end_time, hours, amount,
        status, payment_id, open_game_id, is_split_booking, created_at
    ) SELECT
        v_booking_id, v_player.user_id, v_game.turf_id, v_game.venue,
        (SELECT image FROM public.turfs WHERE id = v_game.turf_id LIMIT 1),
        v_game.date, v_game.time, v_end_time, v_game.duration_hours,
        v_game.price_per_slot, 'CONFIRMED', v_payment_id, p_game_id, true, now()
    WHERE v_game.turf_id IS NOT NULL;

    UPDATE public.open_game_players
       SET payment_status = 'paid', booking_id = v_booking_id
     WHERE id = p_player_id;

    RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$$;


-- --------------------------------------------------------------------
-- 6. Host rejects a private join request
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_join_request(
    p_game_id      text,
    p_player_id    text,
    p_host_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host text;
BEGIN
    SELECT host_user_id INTO v_host FROM public.open_games WHERE id = p_game_id;
    IF v_host IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    IF v_host <> p_host_user_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Only the host can reject requests.');
    END IF;

    DELETE FROM public.open_game_players
     WHERE id = p_player_id AND open_game_id = p_game_id
       AND payment_status = 'requested';

    RETURN jsonb_build_object('ok', true);
END;
$$;


-- --------------------------------------------------------------------
-- 7. Leave an open game
--    Decrements slot count, removes player, cancels the player's booking.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.leave_open_game(
    p_game_id text,
    p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        RETURN jsonb_build_object('ok', false, 'reason',
            'Host cannot leave. Cancel the game instead.');
    END IF;
    IF v_player.payment_status = 'requested' THEN
        -- Pending request: just remove, no slot to decrement
        DELETE FROM public.open_game_players WHERE id = v_player.id;
        RETURN jsonb_build_object('ok', true);
    END IF;

    -- Cancel the player's booking (if any)
    IF v_player.booking_id IS NOT NULL THEN
        UPDATE public.bookings
           SET status = 'CANCELLED'
         WHERE id = v_player.booking_id;
    END IF;

    DELETE FROM public.open_game_players WHERE id = v_player.id;

    -- Reopen a slot if the game was full
    UPDATE public.open_games
       SET slots_filled = GREATEST(0, slots_filled - 1),
           status = CASE
             WHEN slots_filled - 1 < slots_total THEN 'open'
             ELSE status
           END
     WHERE id = p_game_id
       AND status IN ('full', 'open');
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN jsonb_build_object('ok', true);
END;
$$;


-- --------------------------------------------------------------------
-- 8. Cancel an open game (host / admin)
--    Marks game cancelled, cancels every linked booking so players see
--    it as refunded in their booking history.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_open_game(
    p_game_id text,
    p_user_id text,
    p_is_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- Cancel all linked bookings (host court reservation + every share)
    UPDATE public.bookings
       SET status = 'CANCELLED'
     WHERE open_game_id = p_game_id
       AND status NOT IN ('CANCELLED', 'COMPLETED');

    RETURN jsonb_build_object('ok', true);
END;
$$;


-- --------------------------------------------------------------------
-- 9. Grant EXECUTE on all RPCs to authenticated + anon (RLS still
--    governs the underlying tables; the functions do their own authz).
-- --------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.host_open_game(text,text,text,text,text,text,integer,integer,integer,boolean,text,text,text,text,double precision,double precision) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.join_open_game(text,text,text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_join_open_game(text,text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.approve_join_request(text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reject_join_request(text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.leave_open_game(text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cancel_open_game(text,text,boolean) TO authenticated, anon;

-- Done.
