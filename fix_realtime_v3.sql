-- ====================================================================
-- BULLETPROOF REALTIME FIX (v3) — No exceptions, just checks first
-- Run this ENTIRE script in Supabase SQL Editor. Safe forever.
-- ====================================================================

-- ----------------------------------------------------------------------
-- STEP 1: Clean up broken legacy triggers calling non-existent function
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
-- STEP 2: Ensure REPLICA IDENTITY FULL (sends full row data to realtime)
-- ----------------------------------------------------------------------
ALTER TABLE public.bookings        REPLICA IDENTITY FULL;
ALTER TABLE public.games           REPLICA IDENTITY FULL;
ALTER TABLE public.game_players    REPLICA IDENTITY FULL;
ALTER TABLE public.game_waitlist   REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------
-- STEP 3: Publication setup — CHECK FIRST, never crash
-- Uses pg_publication_tables to see if table is already a member.
-- ----------------------------------------------------------------------
DO $$
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- bookings
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.bookings;
    END IF;

    -- games
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'games'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.games;
    END IF;

    -- game_players
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_players'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.game_players;
    END IF;

    -- game_waitlist
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_waitlist'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.game_waitlist;
    END IF;
END
$$;

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
-- VERIFICATION (optional — run after to confirm)
-- ====================================================================
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.bookings'::regclass AND NOT tgisinternal;
-- ====================================================================
