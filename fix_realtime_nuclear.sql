-- ====================================================================
-- NUCLEAR CLEANUP: Remove ALL broken realtime triggers + fix publication
-- Run this ENTIRE script in Supabase SQL Editor.
-- ====================================================================

-- ----------------------------------------------------------------------
-- STEP 1: Aggressively drop ALL triggers on bookings EXCEPT the overlap one
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
          AND tgname != 'trg_check_booking_overlap'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.bookings;', t.tgname);
        RAISE NOTICE 'Dropped trigger: %', t.tgname;
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------
-- STEP 2: Drop the broken function (and any variants)
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.broadcast_booking_change();
DROP FUNCTION IF EXISTS public.broadcast_booking_change();

-- ----------------------------------------------------------------------
-- STEP 3: Also check games table for any broken triggers
-- ----------------------------------------------------------------------
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'public.games'::regclass
          AND NOT tgisinternal
          AND (
              pg_get_triggerdef(oid) ILIKE '%broadcast_changes%'
           OR pg_get_triggerdef(oid) ILIKE '%broadcast%'
          )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.games;', t.tgname);
        RAISE NOTICE 'Dropped broken trigger on games: %', t.tgname;
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------
-- STEP 4: Same for game_players and game_waitlist
-- ----------------------------------------------------------------------
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'public.game_players'::regclass
          AND NOT tgisinternal
          AND pg_get_triggerdef(oid) ILIKE '%broadcast%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.game_players;', t.tgname);
        RAISE NOTICE 'Dropped broken trigger on game_players: %', t.tgname;
    END LOOP;

    FOR t IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'public.game_waitlist'::regclass
          AND NOT tgisinternal
          AND pg_get_triggerdef(oid) ILIKE '%broadcast%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.game_waitlist;', t.tgname);
        RAISE NOTICE 'Dropped broken trigger on game_waitlist: %', t.tgname;
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------
-- STEP 5: Fix publication (idempotent — checks first)
-- ----------------------------------------------------------------------
ALTER TABLE public.bookings        REPLICA IDENTITY FULL;
ALTER TABLE public.games           REPLICA IDENTITY FULL;
ALTER TABLE public.game_players    REPLICA IDENTITY FULL;
ALTER TABLE public.game_waitlist   REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.bookings;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'games'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.games;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_players'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.game_players;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_waitlist'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.game_waitlist;
    END IF;
END
$$;

-- ----------------------------------------------------------------------
-- STEP 6: Broadcast channel policies
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
-- VERIFY: Run this after to confirm cleanup
-- ====================================================================
-- SELECT tgname, pg_get_triggerdef(oid) 
-- FROM pg_trigger 
-- WHERE tgrelid = 'public.bookings'::regclass AND NOT tgisinternal;
-- 
-- Should show ONLY: trg_check_booking_overlap
-- ====================================================================
