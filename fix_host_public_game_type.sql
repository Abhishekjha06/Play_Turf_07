-- ====================================================================
-- FIX: host_public_game — change v_game_id from text to uuid
-- Also fixes host_private_game if it has the same bug.
-- ====================================================================

-- Fix host_public_game
CREATE OR REPLACE FUNCTION public.host_public_game(
    p_turf_id text,
    p_date text,
    p_start_time text,
    p_hours integer,
    p_sport text,
    p_title text DEFAULT NULL,
    p_description text DEFAULT NULL,
    p_skill_level text DEFAULT NULL,
    p_gender text DEFAULT NULL,
    p_age_limit integer DEFAULT NULL,
    p_max_players integer DEFAULT 10,
    p_price_per_player double precision DEFAULT 0,
    p_allow_waitlist boolean DEFAULT true,
    p_allow_invites boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_host_id uuid := auth.uid();
    v_host_name text;
    v_turf record;
    v_booking_id text;
    v_game_id uuid;        -- FIXED: was text, now uuid
    v_end_time text;
    v_total_amount double precision;
    v_existing integer;
BEGIN
    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Authentication required');
    END IF;

    SELECT full_name INTO v_host_name FROM public.profiles WHERE id = v_host_id;
    IF v_host_name IS NULL THEN v_host_name := 'Host'; END IF;

    SELECT * INTO v_turf FROM public.turfs WHERE id = p_turf_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Turf not found');
    END IF;

    v_end_time := to_char((p_date || ' ' || p_start_time)::timestamp + (p_hours || ' hours')::interval, 'HH24:MI');
    v_total_amount := v_turf.price_per_hour * p_hours;

    SELECT COUNT(*) INTO v_existing
    FROM public.bookings
    WHERE turf_id = p_turf_id
      AND date = p_date
      AND status NOT IN ('cancelled', 'completed')
      AND start_time::time < v_end_time::time
      AND end_time::time > p_start_time::time;

    IF v_existing > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Slot already booked');
    END IF;

    INSERT INTO public.bookings (
        user_id, turf_id, turf_name, turf_image, date, start_time, end_time,
        hours, amount, price_per_hour, total_amount, booking_type, status, payment_status
    ) VALUES (
        v_host_id::text, p_turf_id, v_turf.name, v_turf.image,
        p_date, p_start_time, v_end_time, p_hours,
        v_total_amount, v_turf.price_per_hour, v_total_amount, 'open_game', 'confirmed', 'pending'
    )
    RETURNING id::text INTO v_booking_id;

    INSERT INTO public.games (
        booking_id, host_id, turf_id, sport, visibility, title, description,
        skill_level, gender, age_limit, max_players, joined_players, waiting_players,
        price_per_player, status, allow_waitlist, allow_invites, start_time, end_time, date,
        host_name
    ) VALUES (
        v_booking_id, v_host_id, p_turf_id, p_sport, 'public', p_title, p_description,
        p_skill_level, p_gender, p_age_limit, p_max_players, 1, 0,
        p_price_per_player, 'open', p_allow_waitlist, p_allow_invites,
        p_start_time, v_end_time, p_date,
        v_host_name
    )
    RETURNING id INTO v_game_id;

    INSERT INTO public.game_players (game_id, user_id, status, payment_status, joined_at)
    VALUES (v_game_id, v_host_id, 'joined', CASE WHEN p_price_per_player > 0 THEN 'pending' ELSE 'completed' END, now());

    RETURN jsonb_build_object('ok', true, 'game_id', v_game_id, 'booking_id', v_booking_id);
END;
$function$;
