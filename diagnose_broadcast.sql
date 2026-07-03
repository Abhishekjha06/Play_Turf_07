-- ====================================================================
-- DIAGNOSTIC: Find EVERY reference to broadcast_changes anywhere
-- Run ALL of these queries and send back the results.
-- ====================================================================

-- 1. All triggers on ALL tables (not just bookings)
SELECT 
    tgname,
    relname as table_name,
    pg_get_triggerdef(oid) as definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE NOT tgisinternal
  AND n.nspname = 'public'
ORDER BY relname, tgname;

-- 2. All functions that reference 'broadcast_changes' in their body
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%broadcast_changes%';

-- 3. All functions that reference 'broadcast' in their body (broader search)
SELECT 
    p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%broadcast%';
