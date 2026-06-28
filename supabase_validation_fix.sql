-- ====================================================================
-- PLAY_TURF VALIDATION FUNCTIONS FIX
-- Run this if you get "syntax error at or near 'IF'"
-- ====================================================================

-- Drop existing functions first (clean state)
DROP FUNCTION IF EXISTS public.validate_game_slot(text, text, integer);
DROP FUNCTION IF EXISTS public.check_duplicate_join(text, text);
DROP FUNCTION IF EXISTS public.is_slot_available(text);

-- ====================================================================
-- 1. validate_game_slot — Date/Time validation
-- ====================================================================

CREATE OR REPLACE FUNCTION public.validate_game_slot(
    p_date text,
    p_time text,
    p_duration_hours integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_slot_ts timestamp;
    v_now timestamp;
    v_slot_end_ts timestamp;
BEGIN
    v_slot_ts := (p_date || ' ' || p_time)::timestamp;
    v_now := timezone('Asia/Kolkata'::text, now())::timestamp;
    v_slot_end_ts := v_slot_ts + (p_duration_hours || ' hours')::interval;

    -- Past date check
    IF p_date < to_char(v_now, 'YYYY-MM-DD') THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Booking is not available for past dates. Please select a valid date.');
    END IF;

    -- Same-day expired slot check
    IF p_date = to_char(v_now, 'YYYY-MM-DD') THEN
        IF v_slot_ts <= v_now THEN
            RETURN jsonb_build_object('ok', false, 'reason', 'This slot has already started. Please select a future time.');
        END IF;
    END IF;

    -- Game already ended
    IF v_slot_end_ts < v_now THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'This game has already ended.');
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$func$;

-- ====================================================================
-- 2. check_duplicate_join — Prevent double joining
-- ====================================================================

CREATE OR REPLACE FUNCTION public.check_duplicate_join(
    p_game_id text,
    p_user_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.open_game_players
        WHERE open_game_id = p_game_id
          AND user_id = p_user_id
          AND payment_status IN ('paid', 'requested', 'approved')
    );
END;
$func$;

-- ====================================================================
-- 3. is_slot_available — Backend slot check
-- ====================================================================

CREATE OR REPLACE FUNCTION public.is_slot_available(
    p_game_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
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
$func$;

-- ====================================================================
-- 4. Test the functions
-- ====================================================================

-- Test 1: Past date (should fail)
SELECT public.validate_game_slot('2020-01-01', '10:00', 1) as past_date_test;

-- Test 2: Future date (should pass)
SELECT public.validate_game_slot('2030-01-01', '10:00', 1) as future_date_test;

-- Test 3: Check a real game (if any exist)
SELECT public.is_slot_available('game_123') as slot_test;

-- ====================================================================
-- DONE: All validation helper functions created successfully.
-- ====================================================================
