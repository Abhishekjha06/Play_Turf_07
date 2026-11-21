-- ============================================================================
-- Play Turf — Migration 003 DOWN: restore migration 001's broad admin policy
-- (all playturf-admin roles may write the seo_* tables again).
-- ============================================================================

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
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_seo_write_admin', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_seo_write_admin_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_seo_write_admin_del', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_playturf_admin(auth.uid())) WITH CHECK (public.is_playturf_admin(auth.uid()))',
      t || '_admin_all', t);
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.is_seo_write_admin();
