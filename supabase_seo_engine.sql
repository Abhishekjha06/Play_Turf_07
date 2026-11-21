-- ============================================================================
-- Play Turf — Dynamic SEO Engine · Phase 1 FOUNDATION
-- File: supabase_seo_engine.sql
--
-- Run order: AFTER supabase_admin_rbac.sql (needs is_playturf_admin() and
-- site_settings). Idempotent: safe to re-run. Reversible: see DOWN block at
-- the bottom (kept commented — uncomment and run to roll back).
--
-- Conventions:
--   * Writes happen via service_role (worker, serve.js) or admin (dashboard).
--   * Master prompt §5 tables; spec deviations are documented inline and in
--     docs/seo-engine/00-audit.md §6.
--   * Feature flags default OFF (site_settings) — engine is inert until the
--     runbook enable step.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. turfs: slug + updated_at (reversible, non-destructive additions)
-- ----------------------------------------------------------------------------

ALTER TABLE public.turfs ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.turfs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Partial unique index: multiple NULLs allowed before backfill fills slugs in.
CREATE UNIQUE INDEX IF NOT EXISTS turfs_slug_unique_idx
  ON public.turfs (slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS turfs_status_idx ON public.turfs (status);

-- updated_at maintained by trigger, not by client code.
CREATE OR REPLACE FUNCTION public.seo_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS turfs_touch_updated_at ON public.turfs;
CREATE TRIGGER turfs_touch_updated_at
  BEFORE INSERT OR UPDATE ON public.turfs
  FOR EACH ROW EXECUTE FUNCTION public.seo_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Outbox: every turf write enqueues an idempotent SEO job
--    (covers ALL write paths — admin API, legacy admin lib, owner panel,
--    bulk backfills — see 00-audit.md §3. Booking writes never touch turfs,
--    so bookings can never enqueue SEO work; master prompt §14.)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_generation_jobs (
  id            bigserial PRIMARY KEY,
  entity_type   text NOT NULL DEFAULT 'turf' CHECK (entity_type IN ('turf')),
  entity_id     text NOT NULL,
  op            text NOT NULL CHECK (op IN ('created', 'updated', 'deleted')),
  content_hash  text NOT NULL,                -- md5 of row text; skips no-op regenerations
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,  -- snapshot for DELETE (slug, name, locality)
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed', 'skipped')),
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  UNIQUE (entity_type, entity_id, content_hash)
);
CREATE INDEX IF NOT EXISTS seo_generation_jobs_pending_idx
  ON public.seo_generation_jobs (status, created_at)
  WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION public.seo_turf_changed()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_hash  text;
  v_op    text;
  v_id    text;
  v_slug  text;
  v_name  text;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_id   := OLD.id;
    v_slug := OLD.slug;
    v_name := OLD.name;
    v_op   := 'deleted';
    v_hash := md5(coalesce(OLD.slug, '') || '|' || coalesce(OLD.name, '') || '|' || coalesce(OLD.status, '') || '|deleted');
  ELSE
    v_id   := NEW.id;
    v_slug := NEW.slug;
    v_name := NEW.name;
    v_op   := CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END;
    -- status/is_popular/is_nearby change surfaces but not content: still hashed,
    -- the worker decides what to regenerate (robots vs full metadata).
    v_hash := md5(NEW::text);
  END IF;

  INSERT INTO public.seo_generation_jobs (entity_type, entity_id, op, content_hash, payload)
  VALUES ('turf', v_id, v_op, v_hash,
          jsonb_build_object('slug', v_slug, 'name', v_name, 'op', v_op))
  ON CONFLICT (entity_type, entity_id, content_hash)
  DO UPDATE SET status = 'pending', attempts = 0, last_error = NULL, created_at = now();

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS turfs_seo_outbox ON public.turfs;
CREATE TRIGGER turfs_seo_outbox
  AFTER INSERT OR UPDATE OR DELETE ON public.turfs
  FOR EACH ROW EXECUTE FUNCTION public.seo_turf_changed();

-- ----------------------------------------------------------------------------
-- 3. Sport categories + aliases (no taxonomy existed — see 00-audit.md §6)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_sport_categories (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  slug       text NOT NULL UNIQUE,
  parent_id  bigint REFERENCES public.seo_sport_categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_category_aliases (
  id          bigserial PRIMARY KEY,
  alias       text NOT NULL UNIQUE,
  category_id bigint NOT NULL REFERENCES public.seo_sport_categories(id) ON DELETE CASCADE,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_category_associations (
  id          bigserial PRIMARY KEY,
  turf_id     text NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  category_id bigint NOT NULL REFERENCES public.seo_sport_categories(id) ON DELETE CASCADE,
  source      text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turf_id, category_id)
);
CREATE INDEX IF NOT EXISTS seo_category_assoc_category_idx
  ON public.seo_category_associations (category_id);

-- Seed defaults: only the four sports seen in live data, plus the ONE alias
-- mapping the master prompt itself sanctions (§8 Box Cricket under Cricket).
-- Futsal→Football etc. is NOT guessed — admins add aliases in the dashboard.
INSERT INTO public.seo_sport_categories (name, slug) VALUES
  ('Cricket', 'cricket'),
  ('Football', 'football'),
  ('Futsal', 'futsal'),
  ('Basketball', 'basketball')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.seo_category_aliases (alias, category_id)
SELECT 'Box Cricket', c.id FROM public.seo_sport_categories c WHERE c.slug = 'cricket'
ON CONFLICT (alias) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Normalized locations (none existed — see 00-audit.md §6)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_locations (
  id         bigserial PRIMARY KEY,
  type       text NOT NULL CHECK (type IN ('country', 'state', 'city', 'locality')),
  parent_id  bigint REFERENCES public.seo_locations(id) ON DELETE CASCADE,
  name       text NOT NULL,
  slug       text NOT NULL,
  aliases    text[] NOT NULL DEFAULT '{}',
  latitude   double precision,
  longitude  double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, slug)
);
-- country roots have NULL parent: UNIQUE(parent_id, slug) does not dedupe them.
CREATE UNIQUE INDEX IF NOT EXISTS seo_locations_root_slug_idx
  ON public.seo_locations (slug) WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS seo_locations_type_idx ON public.seo_locations (type);

CREATE TABLE IF NOT EXISTS public.seo_location_associations (
  id          bigserial PRIMARY KEY,
  turf_id     text NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  location_id bigint NOT NULL REFERENCES public.seo_locations(id) ON DELETE CASCADE,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turf_id, location_id)
);
CREATE INDEX IF NOT EXISTS seo_location_assoc_location_idx
  ON public.seo_location_associations (location_id);

-- ----------------------------------------------------------------------------
-- 5. Per-entity metadata + version history (master prompt §5)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_metadata (
  id                  bigserial PRIMARY KEY,
  entity_type         text NOT NULL CHECK (entity_type IN ('turf', 'category_page', 'location_page', 'landing_page', 'static_page')),
  entity_id           text NOT NULL,
  seo_title           text,
  meta_description    text,
  h1                  text,
  slug                text,
  canonical_url       text,
  robots_index        boolean NOT NULL DEFAULT true,
  robots_follow       boolean NOT NULL DEFAULT true,
  og_title            text,
  og_description      text,
  og_image            text,
  twitter_title       text,
  twitter_description text,
  focus_keyword       text,
  secondary_keywords  jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_description text,          -- AI output, only after approval
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'generated', 'needs_review', 'approved', 'published')),
  generated_by        text NOT NULL DEFAULT 'template' CHECK (generated_by IN ('template', 'ai', 'admin')),
  content_hash        text,            -- source-data hash; unchanged hash skips regeneration
  source_version      integer NOT NULL DEFAULT 1,
  locked_fields       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- admin-edited fields, never overwritten
  version             integer NOT NULL DEFAULT 1,
  approved_by         text,
  approved_at         timestamptz,
  generated_at        timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS seo_metadata_slug_scope_idx
  ON public.seo_metadata (entity_type, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS seo_metadata_status_idx ON public.seo_metadata (status);
CREATE INDEX IF NOT EXISTS seo_metadata_robots_idx ON public.seo_metadata (robots_index);

CREATE TABLE IF NOT EXISTS public.seo_metadata_versions (
  id             bigserial PRIMARY KEY,
  seo_metadata_id bigint NOT NULL REFERENCES public.seo_metadata(id) ON DELETE CASCADE,
  version        integer NOT NULL,
  snapshot       jsonb NOT NULL,
  changed_by     text,
  change_reason  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seo_metadata_id, version)
);

-- ----------------------------------------------------------------------------
-- 6. Landing pages (records for Turf in {City}, {Sport} Turf in {City}, …)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_landing_pages (
  id                  bigserial PRIMARY KEY,
  page_type           text NOT NULL CHECK (page_type IN ('category', 'location', 'category_location')),
  category_id         bigint REFERENCES public.seo_sport_categories(id) ON DELETE CASCADE,
  location_id         bigint REFERENCES public.seo_locations(id) ON DELETE CASCADE,
  slug                text NOT NULL UNIQUE,
  listing_count       integer NOT NULL DEFAULT 0,
  unique_content_words integer NOT NULL DEFAULT 0,
  is_indexable        boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'candidate'
                      CHECK (status IN ('candidate', 'approved', 'rejected', 'archived')),
  approved_by         text,
  approved_at         timestamptz,
  last_evaluated_at   timestamptz,
  -- NULLs in Postgres UNIQUE never collide, so pin the pair via a generated key:
  uniq_key            text GENERATED ALWAYS AS (
                        coalesce(category_id::text, '-') || ':' || coalesce(location_id::text, '-')
                      ) STORED,
  UNIQUE (uniq_key),
  CONSTRAINT seo_landing_pages_has_one_ref CHECK (category_id IS NOT NULL OR location_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS seo_landing_pages_indexable_idx
  ON public.seo_landing_pages (is_indexable) WHERE is_indexable;

-- ----------------------------------------------------------------------------
-- 7. Redirects (master prompt §5/§13 — collapsed chains, no noindex targets)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_redirects (
  id          bigserial PRIMARY KEY,
  from_path   text NOT NULL UNIQUE,
  to_path     text,                        -- NULL for 410
  status_code smallint NOT NULL DEFAULT 301 CHECK (status_code IN (301, 410)),
  reason      text,
  target_robots text,                     -- 'index' | 'noindex' at write time
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz,
  hit_count   bigint NOT NULL DEFAULT 0
);

-- Request-time resolver used by api/serve.js: collapses chains server-side,
-- detects loops, enforces depth. Returns no rows when there is no redirect.
CREATE OR REPLACE FUNCTION public.seo_resolve_redirect(p_path text)
RETURNS TABLE (to_path text, status_code smallint, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current text := p_path;
  v_row     public.seo_redirects;
  v_depth   integer := 0;
  v_seen    text[] := ARRAY[p_path];
BEGIN
  SELECT * INTO v_row FROM public.seo_redirects WHERE from_path = p_path;
  IF NOT FOUND THEN
    RETURN;                       -- no redirect: caller serves normally
  END IF;
  IF v_row.status_code = 410 THEN
    RETURN QUERY SELECT ''::text, 410::smallint, 'gone'::text;
    RETURN;
  END IF;

  v_current := v_row.to_path;
  LOOP
    IF v_current = ANY(v_seen) THEN
      RETURN QUERY SELECT ''::text, 301::smallint, 'loop'::text;
      RETURN;
    END IF;
    v_seen := v_seen || v_current;

    SELECT * INTO v_row FROM public.seo_redirects WHERE from_path = v_current;
    IF NOT FOUND THEN
      RETURN QUERY SELECT v_current, 301::smallint, 'resolved'::text;
      RETURN;
    END IF;
    IF v_row.status_code = 410 THEN
      RETURN QUERY SELECT ''::text, 301::smallint, 'chain_too_long'::text;
      RETURN;
    END IF;

    v_depth := v_depth + 1;
    IF v_depth > 5 THEN
      RETURN QUERY SELECT ''::text, 301::smallint, 'chain_too_long'::text;
      RETURN;
    END IF;
    v_current := v_row.to_path;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Logs + validation issues (master prompt §5)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_generation_logs (
  id            bigserial PRIMARY KEY,
  entity_type   text NOT NULL,
  entity_id     text NOT NULL,
  trigger       text NOT NULL,             -- 'turfs_trigger' | 'admin' | 'bulk' | 'worker'
  component     text NOT NULL,             -- 'metadata' | 'jsonld' | 'sitemap' | 'associations' | 'redirects'
  status        text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message text,
  duration_ms   integer,
  model         text,
  tokens        integer,
  generated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seo_generation_logs_entity_idx
  ON public.seo_generation_logs (entity_type, entity_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS public.seo_validation_issues (
  id          bigserial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  code        text NOT NULL,               -- e.g. 'missing_locality', 'junk_sport', 'dup_title'
  severity    text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
  message     text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS seo_validation_issues_open_idx
  ON public.seo_validation_issues (entity_type, entity_id) WHERE resolved_at IS NULL;

-- ----------------------------------------------------------------------------
-- 9. RLS (admin = existing is_playturf_admin(); worker/serve.js use service_role
--    which bypasses RLS; public read only where the SPA needs it)
-- ----------------------------------------------------------------------------

ALTER TABLE public.seo_generation_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_metadata          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_metadata_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_sport_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_category_aliases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_category_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_locations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_location_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_landing_pages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_redirects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_generation_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_validation_issues ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  admin_only text[] := ARRAY['seo_generation_jobs', 'seo_generation_logs', 'seo_validation_issues'];
  rec record;
BEGIN
  -- Admin-only tables: admin full access, everyone else nothing.
  FOREACH t IN ARRAY admin_only LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_playturf_admin()) WITH CHECK (public.is_playturf_admin())',
      t || '_admin_all', t);
  END LOOP;

  -- Public-readable tables: anon/authenticated SELECT, admin full access.
  FOREACH rec IN ARRAY ARRAY[
    ROW('seo_metadata'::text), ROW('seo_metadata_versions'::text),
    ROW('seo_sport_categories'::text), ROW('seo_category_aliases'::text),
    ROW('seo_category_associations'::text), ROW('seo_locations'::text),
    ROW('seo_location_associations'::text), ROW('seo_landing_pages'::text)
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.t || '_public_read', rec.t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', rec.t || '_public_read', rec.t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.t || '_admin_all', rec.t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_playturf_admin()) WITH CHECK (public.is_playturf_admin())',
      rec.t || '_admin_all', rec.t);
  END LOOP;

  -- seo_redirects: admin-only reads too (serve.js uses service_role).
  EXECUTE 'DROP POLICY IF EXISTS seo_redirects_admin_all ON public.seo_redirects';
  EXECUTE 'CREATE POLICY seo_redirects_admin_all ON public.seo_redirects FOR ALL TO authenticated USING (public.is_playturf_admin()) WITH CHECK (public.is_playturf_admin())';
END;
$$;

GRANT EXECUTE ON FUNCTION public.seo_resolve_redirect(text) TO service_role, authenticated;

-- ----------------------------------------------------------------------------
-- 10. Feature flags (default OFF — engine inert until the runbook enables it)
-- ----------------------------------------------------------------------------

INSERT INTO public.site_settings (key, value)
VALUES
  ('seo_engine_enabled',        'false'),
  ('seo_ai_enabled',            'false'),
  ('seo_landing_pages_enabled', 'false'),
  ('seo_sitemap_enabled',       'false'),
  ('seo_redirects_enabled',     'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- DOWN (rollback) — uncomment to revert everything this migration added.
-- ============================================================================
-- DROP TRIGGER IF EXISTS turfs_seo_outbox ON public.turfs;
-- DROP TRIGGER IF EXISTS turfs_touch_updated_at ON public.turfs;
-- DROP FUNCTION IF EXISTS public.seo_turf_changed();
-- DROP FUNCTION IF EXISTS public.seo_touch_updated_at();
-- DROP FUNCTION IF EXISTS public.seo_resolve_redirect(text);
-- DROP TABLE IF EXISTS public.seo_validation_issues;
-- DROP TABLE IF EXISTS public.seo_generation_logs;
-- DROP TABLE IF EXISTS public.seo_redirects;
-- DROP TABLE IF EXISTS public.seo_landing_pages;
-- DROP TABLE IF EXISTS public.seo_location_associations;
-- DROP TABLE IF EXISTS public.seo_locations;
-- DROP TABLE IF EXISTS public.seo_category_associations;
-- DROP TABLE IF EXISTS public.seo_category_aliases;
-- DROP TABLE IF EXISTS public.seo_sport_categories;
-- DROP TABLE IF EXISTS public.seo_metadata_versions;
-- DROP TABLE IF EXISTS public.seo_metadata;
-- DROP TABLE IF EXISTS public.seo_generation_jobs;
-- DELETE FROM public.site_settings WHERE key LIKE 'seo_%';
-- ALTER TABLE public.turfs DROP COLUMN IF EXISTS updated_at;
-- DROP INDEX IF EXISTS turfs_slug_unique_idx;
-- ALTER TABLE public.turfs DROP COLUMN IF EXISTS slug;
