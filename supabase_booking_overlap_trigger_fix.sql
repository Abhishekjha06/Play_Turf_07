-- ====================================================================
-- PATCH: Fix BEFORE INSERT OR UPDATE trigger function on public.bookings
-- to skip overlap checks for split bookings (is_split_booking = true).
--
-- Run ONCE in Supabase SQL Editor.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.check_booking_overlap_and_expiry()
RETURNS trigger AS $$
DECLARE
    existing_count integer;
    slot_timestamp timestamp;
    current_server_time timestamp;
BEGIN
    -- 1. Expiry Validation (using Asia/Kolkata timezone for Indian turf locations)
    IF NEW.date = to_char(timezone('Asia/Kolkata'::text, now()), 'YYYY-MM-DD') THEN
        slot_timestamp := (NEW.date || ' ' || NEW.start_time)::timestamp;
        current_server_time := timezone('Asia/Kolkata'::text, now())::timestamp;
        
        IF slot_timestamp <= current_server_time THEN
            RAISE EXCEPTION 'This slot has already expired and cannot be booked.';
        END IF;
    END IF;

    -- 2. Multi-hour Overlap Check (Only enforce for standard bookings, i.e., is_split_booking = false)
    IF NOT NEW.is_split_booking THEN
        SELECT COUNT(*) INTO existing_count
        FROM public.bookings
        WHERE turf_id = NEW.turf_id
          AND date = NEW.date
          AND status != 'CANCELLED'
          AND id != NEW.id
          AND is_split_booking = false
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
