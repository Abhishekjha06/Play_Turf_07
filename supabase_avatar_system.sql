-- ============================================================================
-- Avatar system: mascot avatar_id on profiles
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run (idempotent).
--
-- Adds profiles.avatar_id (permanent mascot id: yeti|sky|blush|mint|buddy).
-- Existing users keep their row and default to 'yeti'; no duplicate profiles
-- are created and no other columns are touched. The existing RLS policies
-- already govern access:
--   "Users can view own profile"   FOR SELECT USING (auth.uid() = id)
--   "Users can update own profile" FOR UPDATE USING (auth.uid() = id)
-- → each user can read and update only their own avatar_id.
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_id text DEFAULT 'yeti' NOT NULL;

-- Backfill: any user without an avatar gets the default mascot.
UPDATE public.profiles SET avatar_id = 'yeti' WHERE avatar_id IS NULL;

-- Optional integrity guard: only the five permanent mascot ids are valid.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_avatar_id_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_avatar_id_check
            CHECK (avatar_id IN ('yeti', 'sky', 'blush', 'mint', 'buddy'));
    END IF;
END $$;
