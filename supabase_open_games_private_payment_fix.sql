-- ====================================================================
-- PATCH: Open Games private flow (Approve-then-Pay)
-- Redefines approval/rejection behavior for private open games,
-- and adds a new function to process the user's payment.
--
-- Run ONCE in Supabase SQL Editor.
-- ====================================================================

-- 1. Redefine approve_join_request to ONLY approve the request (reserving a slot).
--    It does NOT create the booking or mark as paid yet.
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
BEGIN
    SELECT * INTO v_game FROM public.open_games WHERE id = p_game_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game not found.');
    END IF;
    
    -- Authorization check
    IF v_game.host_user_id <> p_host_user_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Only the host can approve requests.');
    END IF;

    SELECT * INTO v_player FROM public.open_game_players
     WHERE id = p_player_id AND open_game_id = p_game_id;
    IF NOT FOUND OR v_player.payment_status <> 'requested' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'No such pending request.');
    END IF;

    -- Atomic conditional increment to reserve the slot
    UPDATE public.open_games
       SET slots_filled = slots_filled + 1,
           status = CASE WHEN slots_filled + 1 >= slots_total THEN 'full' ELSE 'open' END
     WHERE id = p_game_id AND status = 'open' AND slots_filled < slots_total;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Game is full — cannot approve.');
    END IF;

    -- Flip player status to approved (but unpaid)
    UPDATE public.open_game_players
       SET payment_status = 'approved'
     WHERE id = p_player_id;

    RETURN jsonb_build_object('ok', true);
END;
$$;


-- 2. Redefine reject_join_request to support removing both 'requested' and 'approved' players.
--    If an approved (but unpaid) player is rejected, the slot is reopened.
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
        -- Simply delete the player request. No slot was reserved.
        DELETE FROM public.open_game_players WHERE id = p_player_id;
    ELSIF v_player.payment_status = 'approved' THEN
        -- Delete the player request and reopen the reserved slot.
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
$$;


-- 3. Create pay_private_game_share to let approved players pay and finalize their join.
--    This creates the split-payment booking and marks status as 'paid'.
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

    -- Update player record
    UPDATE public.open_game_players
       SET payment_status = 'paid',
           payment_method = p_payment_method,
           booking_id = v_booking_id
     WHERE id = v_player.id;

    RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$$;


-- 4. Re-grant execute rights to public RPCs
GRANT EXECUTE ON FUNCTION public.approve_join_request(text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reject_join_request(text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pay_private_game_share(text,text,text) TO authenticated, anon;
