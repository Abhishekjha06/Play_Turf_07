-- ====================================================================
-- PATCH: host_open_game now RETURNS jsonb  (fixes two bugs)
--   Bug 1: dashboard error "cannot coerce the result to a single json object"
--          -> the function returned a bare text scalar; PostgREST couldn't
--             represent it. Now returns a proper jsonb object.
--   Bug 2: frontend fabricated a fake booking id ("host_<gameId>") so the
--          post-host redirect to /booking/:id 404'd silently. Now the RPC
--          returns the REAL booking_id so the redirect works.
--
-- Run ONCE in Supabase SQL Editor. Idempotent (CREATE OR REPLACE).
-- ====================================================================

-- Drop the old scalar-returning version of the signature if it exists,
-- then recreate with jsonb return. (CREATE OR REPLACE can't change the
-- RETURN type, so we must DROP first.)
DROP FUNCTION IF EXISTS public.host_open_game(
    text,text,text,text,text,text,integer,integer,integer,boolean,text,text,text,text,
    double precision,double precision
);

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
RETURNS jsonb
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
    --    The overlap trigger raises if the turf/date/time is already taken.
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

    -- Return a proper jsonb object (fixes "cannot coerce to single json object")
    -- AND the real booking_id (fixes the silent 404 redirect).
    RETURN jsonb_build_object(
        'ok', true,
        'game_id', v_game_id,
        'booking_id', v_booking_id
    );
END;
$$;

-- Re-grant execute (DROP removed grants on this signature)
GRANT EXECUTE ON FUNCTION public.host_open_game(
    text,text,text,text,text,text,integer,integer,integer,boolean,text,text,text,text,
    double precision,double precision
) TO authenticated, anon;

-- Done.
