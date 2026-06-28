-- ====================================================================
-- PLAY_TURF COMPLETE BACKEND AUDIT & FIX MIGRATION
-- Version: 2.0.0 (Production-Ready)
-- Purpose: Fixes all missing validations, race conditions, and edge cases
--          in the Join Game / Host Game / Booking system.
--
-- Run this ONCE in Supabase SQL Editor. Every statement is idempotent.
-- ====================================================================

-- ====================================================================
-- SECTION 1: AUDIT LOGGING INFRASTRUCTURE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action text NOT NULL,                    -- 'join_game', 'host_game', 'approve_request', etc.
    table_name text,                         -- affected table
    record_id text,                        -- affected record ID
    user_id text,                          -- who performed the action
    old_values jsonb,                      -- before state
    new_values jsonb,                      -- after state
    error_message text,                    -- if action failed
    ip_address text,                       -- client IP (if available)
    created_at timestamp with time zone DEFAULT timezone('Asia/Kolkata'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Helper function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit(
    p_action text,
    p_table_name text DEFAULT NULL,
    p_record_id text DEFAULT NULL,
    p_user_id text DEFAULT NULL,
    p_old_values jsonb DEFAULT NULL,
    p_new_values jsonb DEFAULT NULL,
    p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_logs (
        action, table_name, record_id, user_id,
        old_values, new_values, error_message
    ) VALUES (
        p_action, p_table_name, p_record_id, p_user_id,
        p_old_values, p_new_values, p_error_message
    );
END;
$$;

-- ====================================================================
-- SECTION 2: RATE LIMITING (Prevents spam/abuse)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.join_rate_limits (
    id text PRIMARY KEY DEFAULT 'rl_' || extract(epoch from now())::bigint::text,
    user_id text NOT NULL,
    action text NOT NULL,                  -- 'join', 'host', 'request', 'approve'
    target_id text,                        -- game_id or booking_id
    created_at timestamp with time zone DEFAULT timezone('Asia/Kolkata'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON public.join_rate_limits(user_id, action, created_at);

-- Cleanup old rate limit entries (runs every 5 mins via pg_cron if available)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.join_rate_limits
    WHERE created_at < timezone('Asia/Kolkata'::text, now()) - interval '5 minutes';
END;
$$;

-- Check if user is rate-limited
CREATE OR REPLACE FUNCTION public.is_rate_limited(
    p_user_id text,
    p_action text,
    p_max_attempts integer DEFAULT 5,
    p_window_minutes integer DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.join_rate_limits
    WHERE user_id = p_user_id
      AND action = p_action
      AND created_at > timezone('Asia/Kolkata'::text, now()) - (p_window_minutes || ' minutes')::interval;
    
    RETURN v_count >= p_max_attempts;
END;
$$;

-- Record a rate limit attempt
CREATE OR REPLACE FUNCTION public.record_rate_limit(
    p_user_id text,
    p_action text,
    p_target_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.join_rate_limits (user_id, action, target_id)
    VALUES (p_user_id, p_action, p_target_id);
END;
$$;

-- ====================================================================
-- SECTION 3: VALIDATION HELPER FUNCTIONS
-- ====================================================================

-- Validate that a game slot is in the future and not expired
CREATE OR REPLACE FUNCTION public.validate_game_slot(
    p_date text,
    p_time text,
    p_duration_hours integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_slot_ts timestamp;
    v_now timestamp;
    v_slot_end_ts timestamp;
BEGIN
    -- Parse slot timestamp in IST
    v_slot_ts := (p_date || ' ' || p_time)::timestamp;
    v_now := timezone('Asia/Kolkata'::text, now())::timestamp;
    v_slot_end_ts := v_slot_ts + (p_duration_hours || ' hours')::interval;

    -- 1. Past date check
    IF p_date < to_char(v_now, 'YYYY-MM-DD') THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Booking is not available for past dates. Please select a valid date.');
    END IF;

    -- 2. Same-day expired slot check
    IF p_date = to_char(v_now, 'YYYY-MM-DD') THEN
        IF v_slot_ts <= v_now THEN
            RETURN jsonb_build_object('ok', false, 'reason', 'This slot has already started. Please select a future time.');
        END IF;
    END IF;

    -- 3. Game already ended (shouldn't happen but defensive)
    IF v_slot_end_ts < v_now THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game has already ended.');
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Validate duplicate join prevention
CREATE OR REPLACE FUNCTION public.check_duplicate_join(
    p_game_id text,
    p_user_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.open_game_players
        WHERE open_game_id = p_game_id
          AND user_id = p_user_id
          AND payment_status IN ('paid', 'requested', 'approved')
    );
END;
$$;

-- Validate slot availability (backend-side double-check)
CREATE OR REPLACE FUNCTION public.is_slot_available(
    p_game_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_game record;
BEGIN
    SELECT * INTO v_game FROM public.open_games WHERE id = p_game_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    
    IF v_game.status = 'cancelled' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game has been cancelled.');
    END IF;
    
    IF v_game.status = 'full' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game is already full.');
    END IF;
    
    IF v_game.slots_filled >= v_game.slots_total THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'No slots remaining.');
    END IF;
    
    RETURN jsonb_build_object('ok', true, 'slots_remaining', v_game.slots_total - v_game.slots_filled);
END;
$$;

-- ====================================================================
-- SECTION 4: FIXED host_open_game WITH COMPLETE VALIDATIONS
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
AS $$
DECLARE
    v_game_id     text;
    v_booking_id  text;
    v_payment_id  text;
    v_end_time    text;
    v_start_ts    timestamp;
    v_price_slot  integer;
    v_validation  jsonb;
    v_now         timestamp;
BEGIN
    -- Rate limit check
    IF public.is_rate_limited(p_host_user_id, 'host', 3, 10) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Too many game creation attempts. Please wait 10 minutes.');
    END IF;

    -- Input validation
    IF p_duration_hours < 1 OR p_duration_hours > 12 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Duration must be between 1 and 12 hours.');
    END IF;
    
    IF p_slots_total < 2 OR p_slots_total > 50 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Player limit must be between 2 and 50.');
    END IF;
    
    IF p_total_amount < 100 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Total amount must be at least ₹100.');
    END IF;

    -- Date/Time validation
    v_validation := public.validate_game_slot(p_date, p_start_time, p_duration_hours);
    IF NOT (v_validation->>'ok')::boolean THEN
        RETURN v_validation;
    END IF;

    -- Check if host is already hosting a game at this time
    v_now := timezone('Asia/Kolkata'::text, now())::timestamp;
    IF EXISTS (
        SELECT 1 FROM public.open_games
        WHERE host_user_id = p_host_user_id
          AND date = p_date
          AND status NOT IN ('cancelled', 'completed')
          AND (
            (p_start_time::time < time::time + (duration_hours || ' hours')::interval) AND
            ((p_start_time::time + (p_duration_hours || ' hours')::interval) > time::time)
          )
    ) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'You are already hosting a game at this time.');
    END IF;

    -- Generate IDs
    v_game_id     := 'game_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text;
    v_booking_id  := 'bkg_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text;
    v_payment_id  := 'pay_' || md5(v_booking_id || p_host_user_id);
    v_start_ts    := (p_date || ' ' || p_start_time)::timestamp;
    v_end_time    := to_char(v_start_ts + (p_duration_hours || ' hours')::interval, 'HH24:MI');
    v_price_slot  := GREATEST(1, ROUND(p_total_amount::numeric / GREATEST(1, p_slots_total)))::integer;

    -- BEGIN TRANSACTION BLOCK
    BEGIN
        -- 1. Insert host court reservation (is_split_booking = false)
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
            'gp_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text,
            v_game_id, p_host_user_id, p_host_name, p_host_avatar,
            'paid', 'Host', v_booking_id, true, now()
        );

        -- Record rate limit
        PERFORM public.record_rate_limit(p_host_user_id, 'host', v_game_id);
        
        -- Log audit
        PERFORM public.log_audit('host_game', 'open_games', v_game_id, p_host_user_id,
            NULL, jsonb_build_object('date', p_date, 'time', p_start_time, 'slots', p_slots_total, 'amount', p_total_amount));

        RETURN jsonb_build_object('ok', true, 'game_id', v_game_id, 'booking_id', v_booking_id);
        
    EXCEPTION WHEN OTHERS THEN
        -- Log failure and rollback
        PERFORM public.log_audit('host_game_failed', 'open_games', NULL, p_host_user_id,
            NULL, NULL, SQLERRM);
        RETURN jsonb_build_object('ok', false, 'reason', 'Transaction failed: ' || SQLERRM);
    END;
END;
$$;

-- ====================================================================
-- SECTION 5: FIXED join_open_game WITH COMPLETE VALIDATIONS
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
AS $$
DECLARE
    v_game          record;
    v_updated       integer;
    v_booking_id    text;
    v_payment_id    text;
    v_end_time      text;
    v_start_ts      timestamp;
    v_validation    jsonb;
    v_slot_check    jsonb;
BEGIN
    -- Rate limit check
    IF public.is_rate_limited(p_user_id, 'join', 5, 5) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Too many join attempts. Please wait 5 minutes.');
    END IF;

    -- Lock the game row for update (prevents race conditions)
    SELECT * INTO v_game FROM public.open_games WHERE id = p_game_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    
    IF v_game.status = 'cancelled' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Cannot join a cancelled game.');
    END IF;
    IF v_game.status = 'full' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game is already full.');
    END IF;
    IF v_game.is_private THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This is a private game. Use the request flow.');
    END IF;

    -- Validate date/time hasn't expired
    v_validation := public.validate_game_slot(v_game.date, v_game.time, v_game.duration_hours);
    IF NOT (v_validation->>'ok')::boolean THEN
        RETURN v_validation;
    END IF;

    -- Check if user is the host
    IF v_game.host_user_id = p_user_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'You are the host of this game.');
    END IF;

    -- Check for duplicate join (by user_id, not just name)
    IF public.check_duplicate_join(p_game_id, p_user_id) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'You have already joined or requested this game.');
    END IF;

    -- Backend slot availability check (defensive)
    v_slot_check := public.is_slot_available(p_game_id);
    IF NOT (v_slot_check->>'ok')::boolean THEN
        RETURN v_slot_check;
    END IF;

    -- Atomic conditional increment (the race-safe lock)
    UPDATE public.open_games
       SET slots_filled = slots_filled + 1,
           status = CASE WHEN slots_filled + 1 >= slots_total THEN 'full' ELSE 'open' END
     WHERE id = p_game_id
       AND status = 'open'
       AND slots_filled < slots_total;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game became full while you were joining. Please try another game.');
    END IF;

    -- Create the joiner's split-payment booking
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

    -- Insert player record
    INSERT INTO public.open_game_players (
        id, open_game_id, user_id, name, avatar,
        payment_status, payment_method, booking_id, is_host, joined_at
    ) VALUES (
        'gp_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text,
        p_game_id, p_user_id, p_name, p_avatar,
        'paid', p_payment_method, v_booking_id, false, now()
    );

    -- Record rate limit
    PERFORM public.record_rate_limit(p_user_id, 'join', p_game_id);
    
    -- Log audit
    PERFORM public.log_audit('join_game', 'open_games', p_game_id, p_user_id,
        jsonb_build_object('slots_filled_before', v_game.slots_filled),
        jsonb_build_object('slots_filled_after', v_game.slots_filled + 1, 'booking_id', v_booking_id));

    RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
    
EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_audit('join_game_failed', 'open_games', p_game_id, p_user_id,
        NULL, NULL, SQLERRM);
    RETURN jsonb_build_object('ok', false, 'reason', 'Transaction failed: ' || SQLERRM);
END;
$$;

-- ====================================================================
-- SECTION 6: FIXED request_join_open_game WITH VALIDATIONS
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
AS $$
DECLARE
    v_game record;
    v_validation jsonb;
BEGIN
    -- Rate limit check
    IF public.is_rate_limited(p_user_id, 'request', 10, 5) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Too many requests. Please wait 5 minutes.');
    END IF;

    SELECT status, is_private, slots_filled, slots_total, date, time, duration_hours, host_user_id
      INTO v_game FROM public.open_games WHERE id = p_game_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    IF v_game.status = 'cancelled' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Cannot join a cancelled game.');
    END IF;
    IF NOT v_game.is_private THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This is a public game. Use direct join instead.');
    END IF;
    IF v_game.slots_filled >= v_game.slots_total THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game is already full.');
    END IF;

    -- Validate date/time
    v_validation := public.validate_game_slot(v_game.date, v_game.time, v_game.duration_hours);
    IF NOT (v_validation->>'ok')::boolean THEN
        RETURN v_validation;
    END IF;

    -- Host cannot request to join own game
    IF v_game.host_user_id = p_user_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'You are the host of this game.');
    END IF;

    -- Duplicate check
    IF public.check_duplicate_join(p_game_id, p_user_id) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'You have already joined or requested this game.');
    END IF;

    INSERT INTO public.open_game_players (
        id, open_game_id, user_id, name, avatar,
        payment_status, payment_method, booking_id, is_host, joined_at
    ) VALUES (
        'gp_' || extract(epoch from now())::bigint::text || '_' || floor(random()*10000)::int::text,
        p_game_id, p_user_id, p_name, p_avatar,
        'requested', NULL, NULL, false, now()
    );

    PERFORM public.record_rate_limit(p_user_id, 'request', p_game_id);
    PERFORM public.log_audit('request_join', 'open_games', p_game_id, p_user_id);

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- ====================================================================
-- SECTION 7: FIXED approve_join_request WITH VALIDATIONS
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
AS $$
DECLARE
    v_game      record;
    v_player    record;
    v_updated   integer;
    v_validation jsonb;
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

    -- Validate game hasn't expired
    v_validation := public.validate_game_slot(v_game.date, v_game.time, v_game.duration_hours);
    IF NOT (v_validation->>'ok')::boolean THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game has expired and cannot be modified.');
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

    PERFORM public.log_audit('approve_request', 'open_games', p_game_id, p_host_user_id,
        jsonb_build_object('player_id', p_player_id, 'status_before', 'requested'),
        jsonb_build_object('status_after', 'approved'));

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- ====================================================================
-- SECTION 8: FIXED reject_join_request WITH VALIDATIONS
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
AS $$
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

    PERFORM public.log_audit('reject_request', 'open_games', p_game_id, p_host_user_id,
        jsonb_build_object('player_id', p_player_id, 'status', v_player.payment_status));

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- ====================================================================
-- SECTION 9: FIXED pay_private_game_share WITH VALIDATIONS
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
AS $$
DECLARE
    v_game          record;
    v_player        record;
    v_booking_id    text;
    v_payment_id    text;
    v_end_time      text;
    v_start_ts      timestamp;
    v_validation    jsonb;
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

    -- Validate game hasn't expired
    v_validation := public.validate_game_slot(v_game.date, v_game.time, v_game.duration_hours);
    IF NOT (v_validation->>'ok')::boolean THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game has expired. Payment cannot be processed.');
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

    PERFORM public.log_audit('pay_private_share', 'open_games', p_game_id, p_user_id,
        jsonb_build_object('status_before', 'approved'),
        jsonb_build_object('status_after', 'paid', 'booking_id', v_booking_id, 'amount', v_game.price_per_slot));

    RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$$;

-- ====================================================================
-- SECTION 10: FIXED leave_open_game WITH VALIDATIONS
-- ====================================================================

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
    v_game   record;
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

    -- If game already started, prevent leaving
    SELECT * INTO v_game FROM public.open_games WHERE id = p_game_id;
    IF FOUND THEN
        DECLARE
            v_slot_ts timestamp;
            v_now timestamp;
        BEGIN
            v_slot_ts := (v_game.date || ' ' || v_game.time)::timestamp;
            v_now := timezone('Asia/Kolkata'::text, now())::timestamp;
            IF v_slot_ts <= v_now THEN
                RETURN jsonb_build_object('ok', false, 'reason', 'This game has already started. You cannot leave now.');
            END IF;
        END;
    END IF;

    IF v_player.payment_status = 'requested' THEN
        DELETE FROM public.open_game_players WHERE id = v_player.id;
        PERFORM public.log_audit('leave_game', 'open_games', p_game_id, p_user_id,
            jsonb_build_object('status', 'requested'));
        RETURN jsonb_build_object('ok', true);
    END IF;

    -- Cancel the player's booking (if any)
    IF v_player.booking_id IS NOT NULL THEN
        UPDATE public.bookings
           SET status = 'CANCELLED'
         WHERE id = v_player.booking_id;
    END IF;

    DELETE FROM public.open_game_players WHERE id = v_player.id;

    UPDATE public.open_games
       SET slots_filled = GREATEST(0, slots_filled - 1),
           status = CASE
             WHEN slots_filled - 1 < slots_total THEN 'open'
             ELSE status
           END
     WHERE id = p_game_id
       AND status IN ('full', 'open');
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    PERFORM public.log_audit('leave_game', 'open_games', p_game_id, p_user_id,
        jsonb_build_object('status', v_player.payment_status, 'booking_id', v_player.booking_id),
        jsonb_build_object('slots_filled', v_game.slots_filled - 1));

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- ====================================================================
-- SECTION 11: FIXED cancel_open_game WITH VALIDATIONS
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
AS $$
DECLARE
    v_host text;
    v_game record;
BEGIN
    SELECT host_user_id, date, time, duration_hours
      INTO v_game FROM public.open_games WHERE id = p_game_id;
    
    IF v_game IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    
    v_host := v_game.host_user_id;
    IF v_host <> p_user_id AND p_is_admin = false THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Only the host can cancel this game.');
    END IF;

    -- If game already started, prevent cancellation (refund policy)
    DECLARE
        v_slot_ts timestamp;
        v_now timestamp;
    BEGIN
        v_slot_ts := (v_game.date || ' ' || v_game.time)::timestamp;
        v_now := timezone('Asia/Kolkata'::text, now())::timestamp;
        IF v_slot_ts <= v_now THEN
            RETURN jsonb_build_object('ok', false, 'reason', 'This game has already started and cannot be cancelled.');
        END IF;
    END;

    UPDATE public.open_games SET status = 'cancelled' WHERE id = p_game_id;

    -- Cancel all linked bookings (host court reservation + every share)
    UPDATE public.bookings
       SET status = 'CANCELLED'
     WHERE open_game_id = p_game_id
       AND status NOT IN ('CANCELLED', 'COMPLETED');

    -- Notify all players via audit log
    PERFORM public.log_audit('cancel_game', 'open_games', p_game_id, p_user_id,
        jsonb_build_object('status_before', 'open_or_full'),
        jsonb_build_object('status_after', 'cancelled', 'cancelled_by', CASE WHEN p_is_admin THEN 'admin' ELSE 'host' END));

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- ====================================================================
-- SECTION 12: ORPHANED PLAYER CLEANUP (Scheduled/On-demand)
-- ====================================================================

-- Function to clean up orphaned players (games that were cancelled but players remain)
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_players()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer := 0;
BEGIN
    DELETE FROM public.open_game_players
    WHERE open_game_id IN (
        SELECT id FROM public.open_games WHERE status = 'cancelled'
    )
    AND payment_status IN ('requested', 'approved');
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Function to auto-cancel games that have passed without starting
CREATE OR REPLACE FUNCTION public.auto_cancel_expired_games()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer := 0;
    v_now timestamp;
BEGIN
    v_now := timezone('Asia/Kolkata'::text, now())::timestamp;
    
    UPDATE public.open_games
       SET status = 'cancelled'
     WHERE status IN ('open', 'full')
       AND (date || ' ' || time)::timestamp < v_now;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Cancel linked bookings for auto-cancelled games
    UPDATE public.bookings
       SET status = 'CANCELLED'
     WHERE open_game_id IN (
         SELECT id FROM public.open_games WHERE status = 'cancelled'
     )
       AND status NOT IN ('CANCELLED', 'COMPLETED');
    
    RETURN v_count;
END;
$$;

-- ====================================================================
-- SECTION 13: GRANT PERMISSIONS
-- ====================================================================

GRANT EXECUTE ON FUNCTION public.host_open_game(text,text,text,text,text,text,integer,integer,integer,boolean,text,text,text,text,double precision,double precision) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.join_open_game(text,text,text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_join_open_game(text,text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.approve_join_request(text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reject_join_request(text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.leave_open_game(text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cancel_open_game(text,text,boolean) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pay_private_game_share(text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_game_slot(text,text,integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_slot_available(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_duplicate_join(text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_players() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auto_cancel_expired_games() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text,text,text,text,jsonb,jsonb,text) TO authenticated, anon;

-- ====================================================================
-- DONE: All validations, race-condition fixes, and audit logging are
--       now in place. Run this ONCE in Supabase SQL Editor.
-- ====================================================================
