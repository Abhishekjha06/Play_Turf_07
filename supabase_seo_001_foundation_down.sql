-- ============================================================================
-- Play Turf — Migration 001 DOWN (rollback). Run top-to-bottom on the SAME
-- project that ran supabase_seo_001_foundation.sql. Take a backup first.
-- ============================================================================

DROP VIEW IF EXISTS public.seo_public_metadata;
DROP VIEW IF EXISTS public.seo_public_turfs;
DROP VIEW IF EXISTS public.seo_public_landing_pages;
DROP VIEW IF EXISTS public.seo_public_categories;
DROP VIEW IF EXISTS public.seo_public_locations;
DROP VIEW IF EXISTS public.seo_public_redirects;

DROP TRIGGER IF EXISTS turfs_seo_outbox ON public.turfs;
DROP TRIGGER IF EXISTS turfs_touch_updated_at ON public.turfs;
DROP FUNCTION IF EXISTS public.seo_turf_changed();
DROP FUNCTION IF EXISTS public.seo_touch_updated_at();
DROP FUNCTION IF EXISTS public.seo_resolve_redirect(text);
DROP FUNCTION IF EXISTS public.seo_slugify(text);
DROP FUNCTION IF EXISTS public.seo_worker_set_slug(text, text);
DROP FUNCTION IF EXISTS public.seo_claim_jobs(integer);

DROP TABLE IF EXISTS public.seo_validation_issues;
DROP TABLE IF EXISTS public.seo_generation_logs;
DROP TABLE IF EXISTS public.seo_redirects;
DROP TABLE IF EXISTS public.seo_landing_pages;
DROP TABLE IF EXISTS public.seo_location_associations;
DROP TABLE IF EXISTS public.seo_locations;
DROP TABLE IF EXISTS public.seo_category_associations;
DROP TABLE IF EXISTS public.seo_category_aliases;
DROP TABLE IF EXISTS public.seo_sport_categories;
DROP TABLE IF EXISTS public.seo_metadata_versions;
DROP TABLE IF EXISTS public.seo_metadata;
DROP TABLE IF EXISTS public.seo_generation_jobs;

DELETE FROM public.site_settings WHERE key LIKE 'seo_%';

ALTER TABLE public.turfs DROP COLUMN IF EXISTS updated_at;
DROP INDEX IF EXISTS turfs_slug_unique_idx;
ALTER TABLE public.turfs DROP COLUMN IF EXISTS slug;
ALTER TABLE public.turfs DROP COLUMN IF EXISTS locality;
