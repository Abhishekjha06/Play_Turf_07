-- ====================================================================
-- FIND THE HIDDEN TRIGGER causing broadcast_changes error
-- Run ALL of these and send back the results.
-- ====================================================================

-- 1. ALL triggers on games table
SELECT tgname, pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgrelid = 'public.games'::regclass AND NOT tgisinternal;

-- 2. ALL triggers on game_players table
SELECT tgname, pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgrelid = 'public.game_players'::regclass AND NOT tgisinternal;

-- 3. ALL triggers on game_waitlist table
SELECT tgname, pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgrelid = 'public.game_waitlist'::regclass AND NOT tgisinternal;

-- 4. Broader search: any trigger definition containing 'broadcast'
SELECT 
    c.relname as table_name,
    t.tgname as trigger_name,
    pg_get_triggerdef(t.oid) as definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND pg_get_triggerdef(t.oid) ILIKE '%broadcast%';

-- 5. Check if old open_games / open_game_players tables still exist
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('open_games', 'open_game_players');
