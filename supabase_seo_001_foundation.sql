-- ============================================================================
-- Play Turf — Dynamic SEO Engine · Migration 001: FOUNDATION
-- File: supabase_seo_001_foundation.sql            (idempotent — safe to re-run)
-- Down:  supabase_seo_001_foundation_down.sql      (commented inline, too)
-- Test on a STAGING project first (runbook §1). Master prompt §5/§6.
--
-- Amendment-driven changes vs. the Phase 0 design (owner review 2026-11-21):
--   * turfs.locality column (amendment 6) — no normalized locality existed;
--     backfill is admin-reviewed (validation queue), never silently trusted.
--   * Trigger: (a) never blocks/rolls back a turf write (amendment 3a),
--     (b) fires only on SEO-relevant columns + skips worker writes via a
--     session GUC (3b), (c) on DELETE writes a 410 tombstone into
--     seo_redirects in the same transaction (3c).
--   * RLS: base seo_* tables are ADMIN-ONLY (is_playturf_admin); public reads
--     happen ONLY through published-only views (amendment 4) — serve.js uses
--     the anon key against those views, never service-role.
--   * Landing pages carry override_index for the explicit "force index below
--     threshold" override (amendment 9).
--   * Slugs stay id-suffixed ({name}-{id}) and are stored in turfs.slug
--     (amendment 7); legacy raw-id URLs are 301'd by serve.js later, and any
--     future slug change writes a 301 here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. turfs: slug, locality, updated_at (reversible, non-destructive)
-- ----------------------------------------------------------------------------

ALTER TABLE public.turfs ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.turfs ADD COLUMN IF NOT EXISTS locality text;
ALTER TABLE public.turfs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS turfs_slug_unique_idx
  ON public.turfs (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS turfs_status_idx ON public.turfs (status);
CREATE INDEX IF NOT EXISTS turfs_locality_idx ON public.turfs (city, locality);

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

-- SQL-side slugify for legacy {name}-{id} paths (DELETE tombstones for rows
-- that never had a slug). Mirrors slug.shared.mjs for plain ASCII names.
CREATE OR REPLACE FUNCTION public.seo_slugify(v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(
    regexp_replace(lower(coalesce(v, '')), '[^a-z0-9]+', '-', 'g'),
    '-+$', ''));
$$;

-- ----------------------------------------------------------------------------
-- 2. Outbox: SEO-relevant turf writes enqueue an idempotent job.
--    Amendment 3: exception-safe (a write can NEVER fail because of SEO),
--    column-scoped (b), worker writes skipped via session GUC, and DELETE
--    writes a 410 tombstone in the same transaction (c).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_generation_jobs (
  id            bigserial PRIMARY KEY,
  entity_type   text NOT NULL DEFAULT 'turf' CHECK (entity_type IN ('turf')),
  entity_id     text NOT NULL,
  op            text NOT NULL CHECK (op IN ('created', 'updated', 'deleted')),
  content_hash  text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
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
  v_path  text;
BEGIN
  -- (b) worker/bulk writes opt out explicitly; everything else is processed.
  IF coalesce(current_setting('app.seo_skip_trigger', true), '') = 'on' THEN
    RETURN NULL;
  END IF;

  -- (a) SEO must never block or fail a turf write: swallow everything.
  BEGIN
    IF (TG_OP = 'DELETE') THEN
      v_id  := OLD.id;
      v_op  := 'deleted';
      v_hash := md5(coalesce(OLD.slug, '') || '|' || coalesce(OLD.name, '') || '|' || 'deleted');
      -- (c) 410 tombstone in the same transaction: old URL dies with the turf.
      v_path := '/turf/' || coalesce(
        OLD.slug,
        trim(regexp_replace(regexp_replace(lower(coalesce(OLD.name, '')), '[^a-z0-9]+', '-', 'g'), '-+$', ''))
          || '-' || trim(regexp_replace(regexp_replace(lower(OLD.id), '[^a-z0-9]+', '-', 'g'), '-+$', ''))
      );
      INSERT INTO public.seo_redirects (from_path, to_path, status_code, reason)
      VALUES (v_path, NULL, 410, 'turf_deleted')
      ON CONFLICT (from_path) DO UPDATE
        SET status_code = 410, to_path = NULL, reason = 'turf_deleted';
    ELSE
      v_id  := NEW.id;
      v_op  := CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END;
      v_hash := md5(NEW::text);
    END IF;

    INSERT INTO public.seo_generation_jobs (entity_type, entity_id, op, content_hash, payload)
    VALUES ('turf', v_id, v_op, v_hash,
            jsonb_build_object(
              'slug', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.slug END,
              'legacy_path', CASE WHEN TG_OP = 'DELETE' THEN v_path ELSE NULL END,
              'name', CASE WHEN TG_OP = 'DELETE' THEN OLD.name ELSE NEW.name END,
              'city', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.city END,
              'op', v_op))
    ON CONFLICT (entity_type, entity_id, content_hash)
    DO UPDATE SET status = 'pending', attempts = 0, last_error = NULL, created_at = now();
  EXCEPTION WHEN OTHERS THEN
    -- Never re-raise: the turf write must always succeed (amendment 3a).
    NULL;
  END;

  RETURN NULL;
END;
$$;

-- (b) fire only on SEO-relevant columns. INSERT cannot be column-scoped in
-- Postgres, so it always fires; hash-dedup keeps it cheap.
DROP TRIGGER IF EXISTS turfs_seo_outbox ON public.turfs;
CREATE TRIGGER turfs_seo_outbox
  AFTER INSERT
  OR UPDATE OF name, city, address, locality, slug, image, gallery, videos,
               sport_types, amenities, description, price_per_hour, timing,
               lat, lng, status
  OR DELETE
  ON public.turfs
  FOR EACH ROW EXECUTE FUNCTION public.seo_turf_changed();

-- Worker entry points (owner review round 2, item 2).
--
-- The worker skips the outbox trigger via the `app.seo_skip_trigger` GUC.
-- Through the Supabase POOLER (transaction mode) a session-level SET would
-- leak across tenants and a two-statement sequence (SET then UPDATE) may run
-- on different connections — so the skip MUST be transaction-local:
--   set_config(..., is_local := true)  inside the SAME transaction as the
--   write. These SECURITY DEFINER RPCs make that atomic: one RPC call = one
--   transaction = GUC + write together, on whatever pooled connection serves
--   it. Workers MUST go through these functions; a direct
--   supabase.from('turfs').update() from the worker WILL fire the trigger.
--
-- Verified on staging before production (runbook §1); pooler behaviour
-- documented here and in docs/seo-engine/phase2.md.

CREATE OR REPLACE FUNCTION public.seo_worker_set_slug(p_turf_id text, p_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- SECURITY DEFINER bypasses RLS, so guard explicitly: admin or service_role.
  IF NOT (public.is_playturf_admin() OR coalesce(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'seo_worker_set_slug: admin or service_role only';
  END IF;
  PERFORM set_config('app.seo_skip_trigger', 'on', true);
  UPDATE public.turfs SET slug = p_slug WHERE id = p_turf_id;
END;
$$;

-- Claim one batch of pending jobs atomically (FOR UPDATE SKIP LOCKED keeps
-- concurrent workers safe through the pooler too).
CREATE OR REPLACE FUNCTION public.seo_claim_jobs(p_batch integer DEFAULT 50)
RETURNS TABLE (id bigint, entity_id text, op text, payload jsonb, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_playturf_admin() OR coalesce(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'seo_claim_jobs: admin or service_role only';
  END IF;
  PERFORM set_config('app.seo_skip_trigger', 'on', true);
  DROP TABLE IF EXISTS pg_temp.claimed_jobs;
  CREATE TEMP TABLE claimed_jobs ON COMMIT DROP AS
    SELECT j.id, j.entity_id, j.op, j.payload, j.attempts
    FROM public.seo_generation_jobs j
    WHERE j.status = 'pending'
    ORDER BY j.created_at
    LIMIT GREATEST(1, LEAST(p_batch, 500))
    FOR UPDATE SKIP LOCKED;
  UPDATE public.seo_generation_jobs j
    SET status = 'processing', attempts = j.attempts + 1
    FROM claimed_jobs c WHERE j.id = c.id;
  RETURN QUERY SELECT * FROM claimed_jobs;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seo_worker_set_slug(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seo_claim_jobs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seo_worker_set_slug(text, text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.seo_claim_jobs(integer) TO service_role, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Sport categories + aliases (no taxonomy existed — 00-audit.md §6)
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

-- Seed defaults: only the four sports seen in live data + the single alias the
-- master prompt sanctions (Box Cricket under Cricket). Futsal→Football is NOT
-- guessed — admins add aliases in the dashboard (master prompt §8).
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
-- 4. Normalized locations
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
-- 5. Per-entity metadata + version history
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
  generated_description text,
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'generated', 'needs_review', 'approved', 'published')),
  generated_by        text NOT NULL DEFAULT 'template' CHECK (generated_by IN ('template', 'ai', 'admin')),
  content_hash        text,
  source_version      integer NOT NULL DEFAULT 1,
  locked_fields       jsonb NOT NULL DEFAULT '[]'::jsonb,
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
-- 6. Landing pages — with the amendment-9 override flag
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
  -- Amendment 9: explicit, dashboard-flagged override to force index below
  -- threshold. Admin-only, audited; always produces a validation issue row.
  override_index      boolean NOT NULL DEFAULT false,
  override_by         text,
  status              text NOT NULL DEFAULT 'candidate'
                      CHECK (status IN ('candidate', 'approved', 'rejected', 'archived')),
  approved_by         text,
  approved_at         timestamptz,
  last_evaluated_at   timestamptz,
  uniq_key            text GENERATED ALWAYS AS (
                        coalesce(category_id::text, '-') || ':' || coalesce(location_id::text, '-')
                      ) STORED,
  UNIQUE (uniq_key),
  CONSTRAINT seo_landing_pages_has_one_ref CHECK (category_id IS NOT NULL OR location_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS seo_landing_pages_indexable_idx
  ON public.seo_landing_pages (is_indexable) WHERE is_indexable;

-- ----------------------------------------------------------------------------
-- 7. Redirects (chains stored pre-collapsed; 410 tombstones written by the
--    trigger; request-time resolver in SQL for serve.js's single round trip)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_redirects (
  id          bigserial PRIMARY KEY,
  from_path   text NOT NULL UNIQUE,
  to_path     text,
  status_code smallint NOT NULL DEFAULT 301 CHECK (status_code IN (301, 410)),
  reason      text,
  target_robots text DEFAULT 'index',
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz,
  hit_count   bigint NOT NULL DEFAULT 0
);

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

-- anon grant: serve.js resolves redirects with the anon key in the request
-- path (amendment 4 — no service-role). Read-only over seo_redirects; leaks
-- nothing but public redirect behaviour.
GRANT EXECUTE ON FUNCTION public.seo_resolve_redirect(text) TO service_role, authenticated, anon;

-- ----------------------------------------------------------------------------
-- 8. Logs + validation issues
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_generation_logs (
  id            bigserial PRIMARY KEY,
  entity_type   text NOT NULL,
  entity_id     text NOT NULL,
  trigger       text NOT NULL,
  component     text NOT NULL,
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
  code        text NOT NULL,   -- 'missing_locality', 'locality_needs_review',
                               -- 'implausible_coords', 'junk_sport',
                               -- 'forced_index_below_threshold', 'dup_title', …
  severity    text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
  message     text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS seo_validation_issues_open_idx
  ON public.seo_validation_issues (entity_type, entity_id) WHERE resolved_at IS NULL;

-- ----------------------------------------------------------------------------
-- 9. RLS + public views (amendment 4)
--    Base seo_* tables: ADMIN-ONLY writes, and NO direct public reads.
--    Public reads happen ONLY through published-only views; serve.js uses the
--    anon key against these views (2s timeout + CDN cache + build fallback),
--    NEVER service-role.
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
BEGIN
  -- Admin-only tables (jobs/logs/issues + redirects): no public policies at all.
  FOREACH t IN ARRAY ARRAY['seo_generation_jobs', 'seo_generation_logs',
                           'seo_validation_issues', 'seo_redirects'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_playturf_admin()) WITH CHECK (public.is_playturf_admin())',
      t || '_admin_all', t);
  END LOOP;

  -- Content tables: admin full access; NO anon SELECT on the base tables —
  -- the public reads the published-only views below.
  FOREACH t IN ARRAY ARRAY['seo_metadata', 'seo_metadata_versions',
                           'seo_sport_categories', 'seo_category_aliases',
                           'seo_category_associations', 'seo_locations',
                           'seo_location_associations', 'seo_landing_pages'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_public_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_playturf_admin()) WITH CHECK (public.is_playturf_admin())',
      t || '_admin_all', t);
  END LOOP;
END;
$$;

-- Public views (definer-owned → bypass base RLS deliberately; Supabase linter
-- warning is expected and intended — see runbook §8).
-- Amendment 1 interplay: turfs.status filtering happens here at the view level
-- so the anon/serve path can never leak unpublished rows even before the
-- turfs-table RLS tightening (migration 002, awaiting owner confirmation).

DROP VIEW IF EXISTS public.seo_public_metadata;
CREATE VIEW public.seo_public_metadata AS
SELECT id, entity_type, entity_id, seo_title, meta_description, h1, slug,
       canonical_url, robots_index, robots_follow, og_title, og_description,
       og_image, twitter_title, twitter_description, focus_keyword,
       secondary_keywords, status, generated_by, version, updated_at
FROM public.seo_metadata
WHERE status = 'published' AND robots_index;

DROP VIEW IF EXISTS public.seo_public_turfs;
CREATE VIEW public.seo_public_turfs AS
SELECT id, name, slug, city, locality, address, image, gallery, videos,
       sport_types, amenities, description, price_per_hour, timing, rating,
       lat, lng, is_popular, status, updated_at
FROM public.turfs
WHERE status = 'published';

DROP VIEW IF EXISTS public.seo_public_landing_pages;
CREATE VIEW public.seo_public_landing_pages AS
SELECT id, page_type, category_id, location_id, slug, listing_count,
       unique_content_words, is_indexable, override_index, status, updated_at
FROM public.seo_landing_pages;

DROP VIEW IF EXISTS public.seo_public_categories;
CREATE VIEW public.seo_public_categories AS
SELECT id, name, slug, parent_id FROM public.seo_sport_categories;

DROP VIEW IF EXISTS public.seo_public_locations;
CREATE VIEW public.seo_public_locations AS
SELECT id, type, parent_id, name, slug, aliases, latitude, longitude
FROM public.seo_locations;

DROP VIEW IF EXISTS public.seo_public_redirects;
CREATE VIEW public.seo_public_redirects AS
SELECT from_path, to_path, status_code FROM public.seo_redirects;

GRANT SELECT ON public.seo_public_metadata TO anon, authenticated;
GRANT SELECT ON public.seo_public_turfs TO anon, authenticated;
GRANT SELECT ON public.seo_public_landing_pages TO anon, authenticated;
GRANT SELECT ON public.seo_public_categories TO anon, authenticated;
GRANT SELECT ON public.seo_public_locations TO anon, authenticated;
GRANT SELECT ON public.seo_public_redirects TO anon, authenticated;

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
-- DOWN — also available uncommented in supabase_seo_001_foundation_down.sql
-- ============================================================================
