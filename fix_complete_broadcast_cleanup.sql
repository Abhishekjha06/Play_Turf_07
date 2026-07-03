-- ====================================================================
-- COMPLETE FIX: Drop all broken broadcast triggers + functions
-- This covers games, game_players, and any other tables.
-- ====================================================================

-- ----------------------------------------------------------------------
-- STEP 1: Drop triggers on games table that call broadcast_game_change
-- ----------------------------------------------------------------------
DO $$
DECLARE
    rec record;
BEGIN
    FOR rec IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'public.games'::regclass
          AND NOT tgisinternal
          AND pg_get_triggerdef(oid) ILIKE '%broadcast_game_change%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.games;', rec.tgname);
        RAISE NOTICE 'Dropped trigger % on games', rec.tgname;
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------
-- STEP 2: Drop triggers on game_players that call broadcast_game_player_change
-- ----------------------------------------------------------------------
DO $$
DECLARE
    rec record;
BEGIN
    FOR rec IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'public.game_players'::regclass
          AND NOT tgisinternal
          AND pg_get_triggerdef(oid) ILIKE '%broadcast_game_player_change%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.game_players;', rec.tgname);
        RAISE NOTICE 'Dropped trigger % on game_players', rec.tgname;
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------
-- STEP 3: Drop ALL broken broadcast functions
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.broadcast_booking_change();
DROP FUNCTION IF EXISTS public.broadcast_game_change();
DROP FUNCTION IF EXISTS public.broadcast_game_player_change();
DROP FUNCTION IF EXISTS public.broadcast_changes();

-- ----------------------------------------------------------------------
-- STEP 4: Also hunt for any other triggers on ANY table calling ANY broadcast function
-- ----------------------------------------------------------------------
DO $$
DECLARE
    rec record;
BEGIN
    FOR rec IN
        SELECT 
            c.relname as tbl,
            tr.tgname as trg
        FROM pg_trigger tr
        JOIN pg_class c ON tr.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE NOT tr.tgisinternal
          AND n.nspname = 'public'
          AND (
              pg_get_triggerdef(tr.oid) ILIKE '%broadcast_game_change%'
           OR pg_get_triggerdef(tr.oid) ILIKE '%broadcast_game_player_change%'
           OR pg_get_triggerdef(tr.oid) ILIKE '%broadcast_booking_change%'
           OR pg_get_triggerdef(tr.oid) ILIKE '%broadcast_changes%'
          )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I;', rec.trg, 'public', rec.tbl);
        RAISE NOTICE 'Dropped broken trigger % on %', rec.trg, rec.tbl;
    END LOOP;
END
$$;

-- ----------------------------------------------------------------------
-- STEP 5: Verify — should return ZERO rows
-- ----------------------------------------------------------------------
SELECT 
    c.relname as table_name,
    tr.tgname as trigger_name
FROM pg_trigger tr
JOIN pg_class c ON tr.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE NOT tr.tgisinternal
  AND n.nspname = 'public'
  AND (
      pg_get_triggerdef(tr.oid) ILIKE '%broadcast_game_change%'
   OR pg_get_triggerdef(tr.oid) ILIKE '%broadcast_game_player_change%'
   OR pg_get_triggerdef(tr.oid) ILIKE '%broadcast_booking_change%'
   OR pg_get_triggerdef(tr.oid) ILIKE '%broadcast_changes%'
  );
