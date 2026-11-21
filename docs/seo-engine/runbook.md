# Play Turf — SEO Engine Runbook

How to enable, disable, roll back and verify the Dynamic SEO Engine.
See `00-audit.md` for the audit/design that led to this file.

---

## 1. Apply order (Supabase dashboard → SQL Editor)

Migrations are dashboard-run (no CLI migrations in this repo). All files are
idempotent — safe to re-run.

1. `supabase_admin_rbac.sql` — **prerequisite** (already applied: provides `is_playturf_admin()`, `site_settings`).
2. `supabase_seo_engine.sql` — Phase 1 foundation (this engine).
3. Backfill slugs (see §3).
4. Phase 2+ migrations when they land (documented here as they ship).

## 2. Feature flags

| site_settings key | env mirror | Effect when ON |
|---|---|---|
| `seo_engine_enabled` | `SEO_ENGINE_ENABLED` | master switch — everything below is inert while OFF |
| `seo_ai_enabled` | `SEO_AI_ENABLED` | AI generation pipeline (Phase 5) |
| `seo_landing_pages_enabled` | `SEO_LANDING_PAGES_ENABLED` | landing page evaluation/publication (Phase 3) |
| `seo_sitemap_enabled` | `SEO_SITEMAP_ENABLED` | dynamic sitemap regeneration (Phase 2) |
| `seo_redirects_enabled` | `SEO_REDIRECTS_ENABLED` | 301/410 serving from `seo_redirects` (Phase 2) |

- **Env vars are the build/edge boundary** (Vercel → `api/serve.js`, prebuild
  scripts). `site_settings` values are what the admin can flip at runtime; the
  worker/build honor them on their next run.
- **Master OFF = the platform behaves exactly as before the engine** — no
  metadata rows are consumed, sitemaps/agent-content keep the pre-engine
  behaviour, serve.js ignores redirects. This is enforced by flag checks at
  every consumer and covered by tests.

## 3. Slug backfill (one-time, after applying `supabase_seo_engine.sql`)

```bash
cd components
# preview (no writes; works with anon key):
node scripts/backfill-seo-slugs.mjs --dry-run
# write (needs service key in env/.env.local):
node scripts/backfill-seo-slugs.mjs
```

- Batched (`bulkBatchSize`=50), resumable (re-runs skip rows with a slug;
  `--force` rewrites), per-item error capture (exit code 2 on failures).
- **Phase 1 writes the legacy pattern `{name}-{id}`** — byte-identical to the
  URLs already live, so nothing breaks. The master-prompt pattern
  `{name}-{locality}-{city}` ships in Phase 2 behind
  `seo_engine_enabled` + a 301 map from these legacy slugs in `seo_redirects`.

## 4. Runtime prerequisites for request-time SEO (Phase 2)

Set in **Vercel → Settings → Environment Variables** (server-side only, never
`VITE_`-prefixed):

| Var | Purpose |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | `api/serve.js` reads `seo_redirects` + per-turf metadata at request time (service_role bypasses RLS) |
| `SEO_ENGINE_ENABLED` | master flag for the edge layer |

Without them, serve.js falls back to build-time `agent-content.json` —
the pre-engine behaviour.

## 5. Disable / roll back

- **Turn off:** set `seo_engine_enabled` → `false` in `site_settings` (and/or
  remove the env vars). Everything reverts to pre-engine behaviour immediately.
- **Full rollback (destructive):** run the commented **DOWN** block at the
  bottom of `supabase_seo_engine.sql`. This drops every `seo_*` table, the
  triggers and the `turfs.slug`/`updated_at` columns. Take a backup first
  (Supabase → Database → Backups) — the master prompt requires a backup before
  any bulk job on real data.

## 6. Live-data quality checks (owner; addresses Phase 0 §9 pending items)

Run in the dashboard SQL editor; results feed the dashboard issues list:

```sql
-- turfs missing locality (address must follow the "Locality, City" convention)
SELECT id, name, address FROM turfs WHERE address IS NULL OR position(',' in address) = 0;

-- junk sport values (anything outside the seeded categories)
SELECT DISTINCT s FROM turfs, unnest(sport_types) s
WHERE s NOT IN (SELECT name FROM seo_sport_categories)
  AND s NOT IN (SELECT alias FROM seo_category_aliases);

-- turfs with no slug after backfill
SELECT id, name FROM turfs WHERE slug IS NULL;

-- coordinates that contradict their city (needs manual review)
SELECT id, name, city, lat, lng FROM turfs WHERE lat IS NULL OR lng IS NULL;

-- duplicate names (slug uniqueness still holds via id suffix)
SELECT name, count(*) FROM turfs GROUP BY name HAVING count(*) > 1;
```

## 7. Where things live

| Piece | Path |
|---|---|
| Central config (single source) | `components/src/config/seo-engine.config.mjs` |
| Typed app API | `components/src/lib/seo-engine/index.ts` |
| Slug service | `components/src/lib/seo-engine/slug.shared.mjs` |
| Canonical builder | `components/src/lib/seo-engine/canonical.shared.mjs` |
| Redirect resolver | `components/src/lib/seo-engine/redirects.shared.mjs` |
| Migration | `supabase_seo_engine.sql` |
| Slug backfill | `components/scripts/backfill-seo-slugs.mjs` |
| Tests | `components/src/test/seo-engine.test.ts` |
