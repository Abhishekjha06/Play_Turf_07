-- ============================================================================
-- RLS verification (owner review round 2, item 3) — run ON STAGING after
-- applying supabase_seo_001_foundation.sql, connected as ANON (the PostgREST
-- anon role) and then as ADMIN. Every query prints a result; the expected
-- outcome is in the comment. Paste the whole file output into the Phase 2
-- report.
--
-- NOTE: these are live-DB assertions — they CANNOT be automated in vitest
-- (no DB access from CI without keys). The static shape of the migration is
-- asserted in components/src/test/seo-migration.test.ts.
-- ============================================================================

-- ── As ANON ────────────────────────────────────────────────────────────────

-- 3.1 anon CAN read the published views.
-- Expected: rows (or empty set) — NOT an error.
SELECT 'VIEW seo_public_metadata' AS probe, count(*) FROM public.seo_public_metadata;
SELECT 'VIEW seo_public_turfs'    AS probe, count(*) FROM public.seo_public_turfs;
SELECT 'VIEW seo_public_landing_pages' AS probe, count(*) FROM public.seo_public_landing_pages;
SELECT 'VIEW seo_public_categories'    AS probe, count(*) FROM public.seo_public_categories;
SELECT 'VIEW seo_public_locations'     AS probe, count(*) FROM public.seo_public_locations;
SELECT 'VIEW seo_public_redirects'     AS probe, count(*) FROM public.seo_public_redirects;

-- 3.2 anon CANNOT read the base seo_* tables.
-- Expected: `permission denied for table seo_metadata` (and each table below).
SELECT 'BASE seo_metadata (must FAIL)' AS probe, count(*) FROM public.seo_metadata;
SELECT 'BASE seo_generation_jobs (must FAIL)' AS probe, count(*) FROM public.seo_generation_jobs;
SELECT 'BASE seo_redirects (must FAIL)' AS probe, count(*) FROM public.seo_redirects;
SELECT 'BASE seo_landing_pages (must FAIL)' AS probe, count(*) FROM public.seo_landing_pages;
SELECT 'BASE seo_locations (must FAIL)' AS probe, count(*) FROM public.seo_locations;
SELECT 'BASE seo_validation_issues (must FAIL)' AS probe, count(*) FROM public.seo_validation_issues;

-- 3.3 anon view data respects published-only (no unpublished rows leak).
-- Expected: count = 0 both queries.
SELECT 'LEAK CHECK: unpublished metadata visible to anon (must be 0)' AS probe, count(*)
FROM public.seo_public_metadata WHERE status <> 'published' OR robots_index = false;
SELECT 'LEAK CHECK: unpublished turfs visible to anon via view (must be 0)' AS probe, count(*)
FROM public.seo_public_turfs WHERE status <> 'published';

-- 3.4 anon cannot call the worker RPCs.
-- Expected: permission denied / not found.
SELECT public.seo_worker_set_slug('turf_1', 'should-fail');
SELECT * FROM public.seo_claim_jobs(10);

-- 3.5 anon cannot write anything SEO.
-- Expected: permission denied.
INSERT INTO public.seo_redirects (from_path, status_code) VALUES ('/nope', 410);

-- ── As ADMIN (authenticated with an admin profile) ─────────────────────────

-- 3.6 admin CAN read base tables.
-- Expected: rows (or empty set) — NOT an error.
SELECT 'ADMIN seo_metadata' AS probe, count(*) FROM public.seo_metadata;
SELECT 'ADMIN seo_generation_jobs' AS probe, count(*) FROM public.seo_generation_jobs;

-- 3.7 trigger tombstone proof: (run as admin) delete a TEST turf, then:
-- Expected: exactly one 410 row in seo_redirects for the deleted slug.
-- INSERT INTO public.turfs (id, name, city, status) VALUES ('seo_test_turf', 'SEO Test Turf', 'Pune', 'published');
-- UPDATE public.turfs SET slug = 'seo-test-turf' WHERE id = 'seo_test_turf';
-- DELETE FROM public.turfs WHERE id = 'seo_test_turf';
-- SELECT from_path, status_code, reason FROM public.seo_redirects WHERE from_path = '/turf/seo-test-turf';
-- SELECT entity_id, op, status FROM public.seo_generation_jobs WHERE entity_id = 'seo_test_turf';

-- 3.8 GUC skip proof: (run as admin/service_role)
-- Expected: slug updates, NO new pending job appears with a new hash for
-- exactly this write (the update is skipped by the trigger).
-- SELECT public.seo_worker_set_slug('turf_1', 'greenfield-arena-turf-1');
-- SELECT entity_id, op, created_at FROM public.seo_generation_jobs ORDER BY created_at DESC LIMIT 3;
