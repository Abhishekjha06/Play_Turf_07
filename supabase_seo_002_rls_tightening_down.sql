-- ============================================================================
-- Play Turf — Migration 002 DOWN: restore the pre-tightening public read.
-- (Restores exactly the policy that existed before 002: anon SELECT USING(true).)
-- ============================================================================

DROP POLICY IF EXISTS turfs_anon_published_read ON public.turfs;
DROP POLICY IF EXISTS turfs_auth_published_read ON public.turfs;
DROP POLICY IF EXISTS turfs_admin_all ON public.turfs;
DROP POLICY IF EXISTS turfs_owner_update ON public.turfs;

CREATE POLICY "Public can view turfs" ON public.turfs
  FOR SELECT USING (true);
