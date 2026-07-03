-- ====================================================================
-- FIX: Add FK relationships so Supabase client can join game_players/games with profiles
-- ====================================================================

-- game_players → profiles (so .select('*, profiles(*)') works)
ALTER TABLE public.game_players
DROP CONSTRAINT IF EXISTS fk_game_players_profiles;

ALTER TABLE public.game_players
ADD CONSTRAINT fk_game_players_profiles
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- games → profiles (host profile lookup)
ALTER TABLE public.games
DROP CONSTRAINT IF EXISTS fk_games_host_profiles;

ALTER TABLE public.games
ADD CONSTRAINT fk_games_host_profiles
FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- game_waitlist → profiles
ALTER TABLE public.game_waitlist
DROP CONSTRAINT IF EXISTS fk_game_waitlist_profiles;

ALTER TABLE public.game_waitlist
ADD CONSTRAINT fk_game_waitlist_profiles
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ====================================================================
-- IMPORTANT: After adding FKs, refresh Supabase schema cache
-- In Supabase Dashboard: Database → Refresh Schema Cache (or wait ~1 min)
-- ====================================================================
