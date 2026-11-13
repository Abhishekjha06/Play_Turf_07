-- ============================================================================
-- PlayTurf — Client (Turf Owner) Panel enablement migration
-- Generated 2026-11-13. Run AFTER supabase_security_fixes.sql and
-- supabase_admin_rbac.sql. Review before running; idempotent; no data loss.
--
-- Purpose:
--   1. turfs.owner_id — real ownership (a client manages their venues)
--   2. blocked_slots  — persistent maintenance/maintenance-free slot blocking
--      (replaces the UI-only blocking that never reached the database)
--   3. Owner RLS — owners see bookings/blocks only for THEIR venues
--   4. Booking integrity: the overlap trigger also rejects bookings that
--      collide with a blocked slot (additive check — the existing
--      unique index and booking-vs-booking logic are untouched)
--
-- NOTE: Business → Location → Facility hierarchy and staff management are
-- deliberately NOT in this migration (owner decision pending). This migration
-- makes the CURRENT single-owner-per-turf model real and safe.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1 — Ownership
-- ---------------------------------------------------------------------------

ALTER TABLE public.turfs ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_turfs_owner ON public.turfs (owner_id);

-- Backfill: none possible automatically — assign owners via
-- Admin → Venue Management → edit → Owner, or:
--   UPDATE public.turfs SET owner_id = '<client-profile-uuid>' WHERE id = '<turf-id>';

-- ---------------------------------------------------------------------------
-- SECTION 2 — Persistent blocked slots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.blocked_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  turf_id text NOT NULL,
  pitch_id integer,                          -- NULL = all courts of the turf
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  reason text NOT NULL DEFAULT 'Maintenance',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT blocked_slots_valid_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_blocked_slots_lookup
  ON public.blocked_slots (turf_id, date);

-- Prevent exact duplicate blocks for the same court/date/start
CREATE UNIQUE INDEX IF NOT EXISTS unique_blocked_slot
  ON public.blocked_slots (turf_id, date, start_time, COALESCE(pitch_id, -1));

ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;

-- Availability is public information: any client (incl. anon) can read blocks.
DROP POLICY IF EXISTS "Anyone can view blocked slots" ON public.blocked_slots;
CREATE POLICY "Anyone can view blocked slots"
  ON public.blocked_slots FOR SELECT
  USING (true);

-- Only the venue's owner (or a platform admin) may create/remove blocks.
DROP POLICY IF EXISTS "Owners manage blocked slots" ON public.blocked_slots;
CREATE POLICY "Owners manage blocked slots"
  ON public.blocked_slots FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.turfs t WHERE t.id = turf_id AND t.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.turfs t WHERE t.id = turf_id AND t.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin'))
  );

-- ---------------------------------------------------------------------------
-- SECTION 3 — Owner data access (business-scoped by ownership)
-- ---------------------------------------------------------------------------

-- Owners can read bookings for venues they own (bookings contain customer
-- names/phones — scope strictly by ownership).
DROP POLICY IF EXISTS "Turf owners can view their venue bookings" ON public.bookings;
CREATE POLICY "Turf owners can view their venue bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.turfs t WHERE t.id = turf_id AND t.owner_id = auth.uid())
  );

-- Owners can edit the operational fields of venues they own (never the
-- lifecycle/ownership columns — those stay admin-controlled).
DROP POLICY IF EXISTS "Turf owners can edit their venues" ON public.turfs;
CREATE POLICY "Turf owners can edit their venues"
  ON public.turfs FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- SECTION 4 — Booking integrity: blocked slots participate in prevention
-- ADDITIVE: the existing unique index and booking-vs-booking overlap check
-- are unchanged. This only adds a third guard (booking ∩ block = reject).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_booking_overlap_and_expiry()
RETURNS trigger AS $$
DECLARE
    existing_count integer;
    blocked_count integer;
    slot_timestamp timestamp;
    current_server_time timestamp;
BEGIN
    -- 1. Expiry Validation (Asia/Kolkata for Indian turf locations)
    IF NEW.date = to_char(timezone('Asia/Kolkata'::text, now()), 'YYYY-MM-DD') THEN
        slot_timestamp := (NEW.date || ' ' || NEW.start_time)::timestamp;
        current_server_time := timezone('Asia/Kolkata'::text, now())::timestamp;

        IF slot_timestamp <= current_server_time THEN
            RAISE EXCEPTION 'This slot has already expired and cannot be booked.';
        END IF;
    END IF;

    -- 2. Multi-hour Overlap Check — case-insensitive status, pitch-aware
    SELECT COUNT(*) INTO existing_count
    FROM public.bookings
    WHERE turf_id = NEW.turf_id
      AND date = NEW.date
      AND lower(status) NOT IN ('cancelled')
      AND id != NEW.id
      AND pitch_id IS NOT DISTINCT FROM NEW.pitch_id
      AND (
        (NEW.start_time::time < end_time::time) AND
        (NEW.end_time::time > start_time::time)
      );

    IF existing_count > 0 THEN
        RAISE EXCEPTION 'One or more slots in this time range are already booked.';
    END IF;

    -- 3. Blocked-slot check — a booking may not overlap an owner-blocked
    --    period on the same turf (a NULL pitch block covers every court).
    SELECT COUNT(*) INTO blocked_count
    FROM public.blocked_slots b
    WHERE b.turf_id = NEW.turf_id
      AND b.date = NEW.date
      AND (b.pitch_id IS NULL OR b.pitch_id IS NOT DISTINCT FROM NEW.pitch_id)
      AND (NEW.start_time::time < b.end_time) AND (NEW.end_time::time > b.start_time);

    IF blocked_count > 0 THEN
        RAISE EXCEPTION 'This time range is blocked by the venue and cannot be booked.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (Trigger trg_check_booking_overlap_and_expiry already exists and will use
--  the updated function body automatically — no trigger recreation needed.)

-- ---------------------------------------------------------------------------
-- SECTION 5 — Verification
-- ---------------------------------------------------------------------------
-- 1. Ownership column:      SELECT column_name FROM information_schema.columns WHERE table_name='turfs' AND column_name='owner_id';
-- 2. Blocked table:         SELECT count(*) FROM public.blocked_slots;
-- 3. Owner read policy:     SELECT policyname FROM pg_policies WHERE tablename='bookings' AND policyname LIKE 'Turf owners%';
-- 4. Behaviour test (as the owner, after assigning ownership):
--    INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time, reason)
--    VALUES ('<OWNED_TURF_ID>', CURRENT_DATE + 1, '10:00', '12:00', 'maintenance');
--    → then attempt a player booking for that slot: expect 'blocked by the venue' error.
-- ============================================================================
