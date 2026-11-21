# Play Turf — SEO Engine Runbook

How to enable, disable, roll back and verify the Dynamic SEO Engine.
See `00-audit.md` (design) and `booking-payment-smoke.md` (pre-migration
regression). Amended 2026-11-21 per owner review (11 amendments).

---

## 1. Migration order (Supabase dashboard → SQL Editor)

Migrations are **numbered, idempotent and have explicit down scripts**.
⚠️ Apply on a **staging project first**; take a backup before every application
on the production project.

| Order | File | Status |
|---|---|---|
| 0 | `supabase_admin_rbac.sql` | prerequisite (`is_playturf_admin()`, `site_settings`) |
| 1 | `supabase_seo_001_foundation.sql` (+ `_down.sql`) | engine tables, outbox trigger, views, flags — **default OFF** |
| 2 | `supabase_seo_002_rls_tightening.sql` (+ `_down.sql`) | ⚠️ **PREPARED, DO NOT APPLY without explicit owner confirmation** — tightens turfs anon read to `status='published'` (owner/booking-holder/admin access kept) |
| 3 | backfill slugs (§3) | one-time |

Code-side safeguards (listTurfs published filter, generators) degrade
gracefully on pre-migration databases — they retry unfiltered, so applying the
code before the SQL is safe.

## 2. Site origin (amendment 2)

- **Single source:** `components/src/lib/seo-engine/canonical.shared.mjs`
  `siteOrigin(env)` → `VITE_SITE_ORIGIN` env, else the documented fallback.
- **Production builds FAIL** when the origin resolves to `*.vercel.app`
  (`assertProductionOrigin` runs in prebuild). Dev/preview builds never fail.
- Before merging to main: set `VITE_SITE_ORIGIN` (Vercel env + local `.env`)
  to the real production domain `[YOUR DOMAIN]` and run `npm run build` locally
  once to sync `index.html` / `robots.txt`.
- **Preview deployments are noindexed at the edge** (`api/serve.js` reads
  `VERCEL_ENV` / the generated `seo-config.json`; every HTML response gets
  `X-Robots-Tag: noindex, nofollow` on previews).

## 3. Slug backfill (one-time, after 001)

```bash
cd components
node scripts/backfill-seo-slugs.mjs --dry-run   # preview (anon key is enough)
node scripts/backfill-seo-slugs.mjs             # writes (needs service key)
```

- Id-suffixed slugs (`{name}-{id}`) are **kept** (amendment 7) — zero URL
  changes. Slugs land in `turfs.slug` with a unique index; legacy forms
  (raw-id `/turf/turf_1`) get 301s in Phase 2's serve.js redirect layer.
- Batched (50), resumable, `--force` to rewrite, exit code 2 on failures.

## 4. Feature flags

| site_settings key | env mirror | Effect when ON |
|---|---|---|
| `seo_engine_enabled` | `SEO_ENGINE_ENABLED` | master switch |
| `seo_ai_enabled` | `SEO_AI_ENABLED` | AI pipeline (Phase 5) |
| `seo_landing_pages_enabled` | `SEO_LANDING_PAGES_ENABLED` | landing page evaluation (Phase 3) |
| `seo_sitemap_enabled` | `SEO_SITEMAP_ENABLED` | DB-backed sitemap part |
| `seo_redirects_enabled` | `SEO_REDIRECTS_ENABLED` | 301/410 serving (Phase 2) |

Env wins at the build/edge boundary; `site_settings` is what the admin flips at
runtime. **Master OFF = exact pre-engine behaviour** (covered by tests).

## 5. Runtime env for the edge (serve.js — amendment 4/5)

Vercel env vars (server-side, never `VITE_`-prefixed, **no service-role key in
the request path**):

| Var | Purpose |
|---|---|
| `SUPABASE_URL` (+ `SUPABASE_ANON_KEY`) | serve.js reads the published-only VIEWS with the anon key, `AbortSignal.timeout(2000)`, build-time fallback on any failure |
| `SEO_ENGINE_ENABLED`, `SEO_SITEMAP_ENABLED`, `SEO_REDIRECTS_ENABLED` | edge flags |

Views (001): `seo_public_metadata` (published+indexable only), `seo_public_turfs`
(published only), `seo_public_landing_pages`, `seo_public_categories`,
`seo_public_locations`, `seo_public_redirects`. Base `seo_*` tables have **no
public policies at all** — admin writes via `is_playturf_admin()`, worker via
service-role (outbox processing only, never request path).

## 6. Sitemap without a deploy (amendment 5)

`/sitemap.xml` is a forced rewrite to `/api/serve` which reads the DB
(2s timeout) and the prebuild static routes, cached at the CDN
(`s-maxage=3600, stale-while-revalidate=86400`). Turf URLs get real
`updated_at` lastmod. DB down / flags off → falls back to the prebuild data.
The static `public/sitemap.xml` remains as the prebuild artifact.

## 7. Disable / roll back

- **Turn off:** `seo_engine_enabled` → `false` (runtime env + site_settings).
- **Partial:** flip only the sub-flag you want off.
- **Full rollback:** run `supabase_seo_001_foundation_down.sql` (then, if 002
  was applied, `supabase_seo_002_rls_tightening_down.sql`). Backup first.

## 8. Known intentional warnings

- Supabase linter will flag the `seo_public_*` views as "views bypass RLS" —
  intended (they are the published-only public read surface; base tables are
  locked).
- `listTurfs`/generators log a warning about "status column unavailable" until
  migration 001 is applied — expected pre-migration degradation, not an error.

## 9. Live-data quality checks (owner)

Run in the dashboard SQL editor after 001 (feeds the dashboard review queue):

```sql
-- turfs missing locality (address must follow "Locality, City")
SELECT id, name, address FROM turfs WHERE address IS NULL OR position(',' in address) = 0;

-- derived localities pending review (queue feeds AdminSeo in Phase 4)
SELECT id, name, address FROM turfs WHERE locality IS NULL AND address LIKE '%,%';

-- junk sport values (never silently mapped; aliases added by admin)
SELECT DISTINCT s FROM turfs, unnest(sport_types) s
WHERE s NOT IN (SELECT name FROM seo_sport_categories)
  AND s NOT IN (SELECT alias FROM seo_category_aliases);

-- turfs with no slug after backfill
SELECT id, name FROM turfs WHERE slug IS NULL;

-- coordinate sanity (engine omits geo + nearby links when implausible)
SELECT id, name, city, lat, lng FROM turfs WHERE lat IS NULL OR lng IS NULL;

-- duplicate names (slug uniqueness still holds via id suffix)
SELECT name, count(*) FROM turfs GROUP BY name HAVING count(*) > 1;
```

## 9a. Reviews: data source, cache window, moderation (round-2 item 5)

- **Single data source:** the genuine `reviews` table rows. AggregateRating/Review
  markup is built ONLY from those rows (never the static turfs.rating column).
  All three surfaces read the same table: the build artifact (agent-content,
  refreshed per deploy), the request-time bot HTML, and the SPA (live fetch).
- **Cache window:** bot HTML for turf pages is CDN-cached (s-maxage=3600 +
  stale-while-revalidate) — a new review appears in bot markup within ~1h (or
  at the next deploy for the artifact). The SPA always shows live data. The
  sitemap lastmod uses turfs.updated_at, not review time.
- **Moderation (current truth, no fabrication):** reviews are self-reported
  (user_id + user_name), inserted client-side; there is NO moderation pipeline
  and no booking linkage today. The engine therefore (a) emits aggregates only
  when genuine rows exist, (b) never invents or round-ends ratings, and
  (c) treats review counts as reportable but unverified. Wiring reviews to
  bookings (booking_id FK + verified flag) needs a migration — a Phase 4
  decision for the owner.

## 9b. Deploy order (round-2 item 6)

1. Set `VITE_SITE_ORIGIN` = [YOUR DOMAIN] (Vercel env + local .env).
   Production builds FAIL while it resolves to *.vercel.app — that is the guard.
2. Apply `supabase_seo_001_foundation.sql` on PRODUCTION (after the staging
   pass and a backup).
3. Run the slug backfill on production.
4. THEN merge feat/seo-engine to main (Vercel auto-deploys).
5. Set `SEO_ENGINE_ENABLED` / `SEO_SITEMAP_ENABLED` / `SEO_REDIRECTS_ENABLED` = 1
   (Vercel env + site_settings) when ready to serve engine output.

**Temporary fallback `VITE_SEO_ALLOW_UNFILTERED_TURFS=1`** (client-visible env):
- ALLOWED only in the window BETWEEN merging the engine code and applying
  migration 001 on that environment — it restores the pre-engine unfiltered
  turfs read so the site does not break pre-migration.
- REMOVE it immediately after 001 is applied (listTurfs fails loud without it —
  a failing filtered read is then a real signal, not a missing column).
- Never set it on an environment whose database has migration 001 applied.

## 10. Phase 2 staging setup (owner review round 2, item 5)

Phase 2 (worker + per-turf bot HTML) requires **exactly one migration** on the
staging project:

| Migration | Provides |
|---|---|
| `supabase_seo_001_foundation.sql` (+ the prerequisite `supabase_admin_rbac.sql`, already applied) | outbox trigger + `seo_generation_jobs`, `seo_claim_jobs` / `seo_worker_set_slug` RPCs, `seo_resolve_redirect`, published views, `turfs.slug/locality/updated_at` |

No new migrations ship with Phase 2 — review aggregates are computed at
read/build time from genuine `reviews` rows (item 7), never stored.

Staging discipline:

```bash
# .env.staging (never commit) — worker + harness point at staging only:
#   SUPABASE_URL=https://<staging-ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=<staging service key>
#   VITE_SITE_ORIGIN=<staging domain>          # production guard still applies
#   SEO_ENGINE_ENABLED=1  SEO_SITEMAP_ENABLED=1  SEO_REDIRECTS_ENABLED=1

node scripts/seo-worker.mjs --dry-run --once   # preview jobs (staging env active)
node scripts/seo-worker.mjs --once             # drain one batch
node scripts/serve-harness.mjs sitemap.xml bot # live-style route checks
node scripts/serve-harness.mjs turf/<slug> bot # per-turf bot HTML check
```

Production runs of the worker are explicit owner actions after the smoke
checklist passes on staging.

## 11. Where things live

| Piece | Path |
|---|---|
| Central config (single source) | `components/src/config/seo-engine.config.mjs` |
| Typed app API | `components/src/lib/seo-engine/index.ts` |
| Slug service | `components/src/lib/seo-engine/slug.shared.mjs` |
| Canonical + origin guard | `components/src/lib/seo-engine/canonical.shared.mjs` |
| Redirect resolver | `components/src/lib/seo-engine/redirects.shared.mjs` |
| Locality/geo plausibility | `components/src/lib/seo-engine/locality.shared.mjs` |
| Migrations | `supabase_seo_001_foundation.sql` (+down), `supabase_seo_002_rls_tightening.sql` (+down) |
| Slug backfill | `components/scripts/backfill-seo-slugs.mjs` |
| Origin sync (index.html/robots.txt) | `components/scripts/sync-site-origin.mjs` (prebuild) |
| Edge runtime config artifact | `api/seo-config.json` (prebuild) |
| Tests | `components/src/test/seo-engine.test.ts`, `components/src/test/seo-parity.test.ts` |
| Booking/payment smoke | `docs/seo-engine/booking-payment-smoke.md` |
