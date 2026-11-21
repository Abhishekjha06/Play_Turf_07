-- ============================================================================
-- Play Turf — Migration 002: turfs READ RLS TIGHTENING
-- File: supabase_seo_002_rls_tightening.sql
-- Down:  supabase_seo_002_rls_tightening_down.sql
--
-- ⚠️ PREPARED PER OWNER AMENDMENT 1 — DO NOT APPLY WITHOUT EXPLICIT
-- CONFIRMATION. Run on staging first; keep a pre-application backup.
--
-- Problem (00-audit.md §2/§5): turfs anon SELECT policy is `USING (true)`
-- (supabase_schema.sql:216), so `pending_approval` / `archived` turfs are
-- publicly readable even though the app now filters status='published'
-- client-side (amendment 1). This migration enforces it at the database.
--
-- Access matrix after applying:
--   * anon            → published turfs ONLY (read)
--   * venue owner     → own turf rows, any status (owner_id = auth.uid())
--   * booking holder  → turfs referenced by their bookings (any status), read
--   * admin           → all turfs, full access (is_playturf_admin())
--   * service_role    → unchanged (bypasses RLS; worker/serve.js)
--
-- The SEO public surface keeps working because seo_public_turfs is a definer
-- view that already filters status='published'.
-- ============================================================================

-- 1. Drop the wide-open anon read policy.
DROP POLICY IF EXISTS "Public can view turfs" ON public.turfs;
DROP POLICY IF EXISTS "Public read access on turfs" ON public.turfs;
DROP POLICY IF EXISTS turfs_public_read ON public.turfs;

-- 2. Anon: published turfs only.
CREATE POLICY turfs_anon_published_read ON public.turfs
  FOR SELECT TO anon
  USING (status = 'published');

-- 3. Authenticated non-admin users: published turfs, their own venue rows,
--    and turfs they hold a booking for (booking-holder access per amendment 1).
CREATE POLICY turfs_auth_published_read ON public.turfs
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR owner_id = auth.uid()
    OR public.is_playturf_admin()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.turf_id = turfs.id
        AND b.user_id = auth.uid()
    )
  );

-- 4. Admin full access (update/insert/delete included).
CREATE POLICY turfs_admin_all ON public.turfs
  FOR ALL TO authenticated
  USING (public.is_playturf_admin())
  WITH CHECK (public.is_playturf_admin());

-- 5. Owner update of their own venue rows. NOTE: RLS is row-level and cannot
--    hide columns — owners are prevented from touching status/ownership at the
--    API layer (clientPanel.ts:39-42 whitelist). A column-level REVOKE would
--    also block admins (they connect as `authenticated` too), so it is
--    deliberately not used here.
CREATE POLICY turfs_owner_update ON public.turfs
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================================
-- Down: restores the pre-002 public read (wide-open anon policy).
-- ============================================================================
