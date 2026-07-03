-- ====================================================================
-- BULLETPROOF FIX: 42710 publication duplicate + broken broadcast trigger
-- Run this ENTIRE script in Supabase SQL Editor. Safe to run multiple times.
-- ====================================================================

-- ----------------------------------------------------------------------
-- STEP 1: Remove broken triggers that call non-existent function
-- ----------------------------------------------------------------------
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'public.bookings'::regclass
          AND NOT tgisinternal
          AND (
              pg_get_triggerdef(oid) ILIKE '%broadcast_changes%'
           OR pg_get_triggerdef(oid) ILIKE '%broadcast_booking_change%'
          )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.bookings;', t.tgname);
        RAISE NOTICE 'Dropped broken trigger: %', t.tgname;
    END LOOP;
END
$$;

DROP FUNCTION IF EXISTS public.broadcast_booking_change();

-- ----------------------------------------------------------------------
-- STEP 2: Idempotent publication setup (NEVER throws 42710)
-- ----------------------------------------------------------------------
-- IMPORTANT: We use EXCEPTION WHEN duplicate_table so this is 100% safe
-- to re-run even if tables are already in the publication.

DO $$
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
    END IF;

    -- bookings
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.bookings;
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE 'bookings already in publication — skipped';
    END;

    -- games
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.games;
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE 'games already in publication — skipped';
    END;

    -- game_players
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.game_players;
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE 'game_players already in publication — skipped';
    END;

    -- game_waitlist
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.game_waitlist;
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE 'game_waitlist already in publication — skipped';
    END;
END
$$;

-- ----------------------------------------------------------------------
-- STEP 3: Ensure REPLICA IDENTITY FULL (so postgres_changes sends full rows)
-- ----------------------------------------------------------------------
ALTER TABLE public.bookings        REPLICA IDENTITY FULL;
ALTER TABLE public.games           REPLICA IDENTITY FULL;
ALTER TABLE public.game_players    REPLICA IDENTITY FULL;
ALTER TABLE public.game_waitlist   REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------
-- STEP 4: Realtime broadcast channel policies
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send broadcasts"     ON realtime.messages;

CREATE POLICY "Authenticated users can receive broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
    topic LIKE 'turf:%'    OR
    topic LIKE 'booking:%' OR
    topic LIKE 'game:%'    OR
    topic LIKE 'user:%'
);

CREATE POLICY "Authenticated users can send broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ====================================================================
-- DONE. Run these to verify:
--   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.bookings'::regclass AND NOT tgisinternal;
-- ====================================================================
