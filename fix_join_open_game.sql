-- ============================================================
-- FIX: join_open_game — removes false "already booked" error
-- ============================================================
-- Copy this ENTIRE block into the Supabase SQL Editor and click Run

DROP FUNCTION IF EXISTS public.join_open_game(text, text, text, text, text);

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
    RETURN jsonb_build_object('ok', false, 'reason', COALESCE(SQLERRM, 'An unexpected error occurred. Please try again.'));
END;
$func$;
