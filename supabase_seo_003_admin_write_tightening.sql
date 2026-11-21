-- ============================================================================
-- Play Turf — Migration 003: SEO WRITES RESTRICTED TO ADMIN/SUPER_ADMIN
-- File: supabase_seo_003_admin_write_tightening.sql
-- Down:  supabase_seo_003_admin_write_tightening_down.sql
--
-- ⚠️ PREPARED (owner round-3 item 6) — apply AFTER 001 on staging first.
-- Migration 001 lets ANY playturf-admin role (admin/super_admin/finance/
-- content/support) write the seo_* tables. This migration narrows WRITES to
-- super_admin + admin only; finance/content/support keep READ access where a
-- read policy exists. Reads by anon happen only through the published views.
--
-- Application-level enforcement already in place: every AdminSeo mutation goes
-- through admin-api.ts withAudit() → log_admin_action (audit trail), and the
-- UI gate is canManage = super_admin|content_admin.
-- ============================================================================

-- Helper: is the caller an admin or super_admin?
CREATE OR REPLACE FUNCTION public.is_seo_write_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND ((role::text IN ('admin', 'super_admin')) OR is_admin = true)
  );
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'seo_metadata', 'seo_metadata_versions', 'seo_category_aliases',
    'seo_category_associations', 'seo_location_associations',
    'seo_landing_pages', 'seo_redirects', 'seo_generation_jobs',
    'seo_generation_logs', 'seo_validation_issues', 'seo_locations',
    'seo_sport_categories'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_seo_write_admin', t);
    -- re-create the broad read policy from 001 first (keeps reads working)
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_playturf_admin())',
      t || '_admin_read', t);
    -- narrow writes to admin/super_admin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_seo_write_admin())',
      t || '_seo_write_admin', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_seo_write_admin()) WITH CHECK (public.is_seo_write_admin())',
      t || '_seo_write_admin_upd', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_seo_write_admin())',
      t || '_seo_write_admin_del', t);
  END LOOP;
END;
$$;

-- ============================================================================
-- DOWN — restore the 001 broad admin policies.
-- ============================================================================
