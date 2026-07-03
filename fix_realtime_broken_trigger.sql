-- ====================================================================
-- EMERGENCY FIX: Remove broken realtime.broadcast_changes trigger
-- and properly configure Supabase Realtime for bookings/games tables.
-- ====================================================================
-- Run this in the Supabase SQL Editor immediately.
-- ====================================================================

-- 1. REMOVE BROKEN LEGACY TRIGGERS
-- Old schemas created triggers calling realtime.broadcast_changes(),
-- an API that was removed from modern Supabase. These cause:
--   "function realtime.broadcast_changes(name, text, text, jsonb) does not exist"
-- on every INSERT/UPDATE to bookings.
-- ------------------------------------------------------------------

DO $$
DECLARE
    t record;
BEGIN
    -- Find any trigger on bookings that references broadcast_changes
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

-- Also drop the old function if it exists
DROP FUNCTION IF EXISTS public.broadcast_booking_change();

-- 2. VERIFY / FIX PUBLICATION SETUP
-- Ensure REPLICA IDENTITY FULL is set so postgres_changes sends full row data.
-- ------------------------------------------------------------------

ALTER TABLE public.bookings   REPLICA IDENTITY FULL;
ALTER TABLE public.games      REPLICA IDENTITY FULL;
ALTER TABLE public.game_players REPLICA IDENTITY FULL;
ALTER TABLE public.game_waitlist REPLICA IDENTITY FULL;

-- 3. ADD TABLES TO PUBLICATION (idempotent — safe to re-run)
-- Uses EXCEPTION handling so it never crashes on duplicate_table (42710).
-- ------------------------------------------------------------------

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.bookings;
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE 'bookings already in supabase_realtime publication';
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.games;
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE 'games already in supabase_realtime publication';
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.game_players;
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE 'game_players already in supabase_realtime publication';
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.game_waitlist;
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE 'game_waitlist already in supabase_realtime publication';
    END;
END
$$;

-- 4. REALTIME BROADCAST POLICIES (for client-to-client broadcast channels)
-- ------------------------------------------------------------------

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
-- VERIFICATION QUERIES (run these after to confirm the fix)
-- ====================================================================
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.bookings'::regclass AND NOT tgisinternal;
-- ====================================================================
