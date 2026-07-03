-- ====================================================================
-- KILL-SWITCH FIXED: Drop ANY trigger containing 'broadcast' on ANY table
-- Variable names fixed to avoid collision.
-- ====================================================================

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
          AND pg_get_triggerdef(tr.oid) ILIKE '%broadcast%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I;', 
            rec.trg, 'public', rec.tbl);
        RAISE NOTICE 'Dropped broken trigger % on %', rec.trg, rec.tbl;
    END LOOP;
END
$$;

-- Also drop any function referencing broadcast_changes
DROP FUNCTION IF EXISTS public.broadcast_booking_change();
DROP FUNCTION IF EXISTS public.broadcast_game_change();
DROP FUNCTION IF EXISTS public.broadcast_changes();

-- Verify: should return zero rows
SELECT c.relname as table_name, tr.tgname as trigger_name
FROM pg_trigger tr
JOIN pg_class c ON tr.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE NOT tr.tgisinternal
  AND n.nspname = 'public'
  AND pg_get_triggerdef(tr.oid) ILIKE '%broadcast%';
