-- ====================================================================
-- KILL-SWITCH: Drop ANY trigger containing 'broadcast' on ANY public table
-- Run this to instantly fix the hidden trigger.
-- ====================================================================

DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT 
            c.relname as table_name,
            t.tgname as trigger_name
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE NOT t.tgisinternal
          AND n.nspname = 'public'
          AND pg_get_triggerdef(t.oid) ILIKE '%broadcast%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I;', 
            t.trigger_name, 'public', t.table_name);
        RAISE NOTICE 'Dropped broken trigger % on %', t.trigger_name, t.table_name;
    END LOOP;
END
$$;

-- Also drop any function referencing broadcast_changes
DROP FUNCTION IF EXISTS public.broadcast_booking_change();
DROP FUNCTION IF EXISTS public.broadcast_game_change();
DROP FUNCTION IF EXISTS public.broadcast_changes();

-- Verify: should return zero rows
SELECT c.relname, t.tgname
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND pg_get_triggerdef(t.oid) ILIKE '%broadcast%';
