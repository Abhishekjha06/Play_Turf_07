-- ============================================================================
-- Play Turf — Migration 004 DOWN
-- ============================================================================
DROP FUNCTION IF EXISTS public.seo_admin_set_slug(bigint, text, text);
