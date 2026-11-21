# Play Turf — Dynamic SEO Engine · Phase 0 Audit

Date: 2026-11-21 · Branch: `feat/seo-engine` · Status: **audit complete, design below**

---

## 0. Project facts (detected from codebase — not guessed)

| Field | Value found |
|---|---|
| Stack | React 18 + Vite SPA (TypeScript, Tailwind) · Supabase (Postgres + RLS + Edge Functions) · Vercel hosting |
| Rendering today | **CSR SPA** with a build-time prerender layer: `prebuild` generates `sitemap.xml` + `api/agent-content.json`; `api/serve.js` serves bots a full no-JS HTML page + `text/markdown` negotiation, real 404s, private-path noindex. **No SSR/SSG per-request.** |
| Queue / worker | **None.** Live Supabase tables only. Smallest safe option proposed in §8. |
| Public domain | `VITE_SITE_ORIGIN` env, hardcoded fallback `https://play-turf-git-main-abhishekjha06s-projects.vercel.app` in 6 places (`seo.ts:28`, `business.ts:11`, `index.html:26`, `public/robots.txt:27`, `generate-sitemap.mjs:41`, `generate-agent-content.mjs:19`). `playturf.app` is dead. |
| Admin dashboard | `/admin` (RBAC: roles admin/super_admin/finance/content/support via `is_playturf_admin()`); existing SEO module at `/admin/seo` (4 tabs) |
| AI provider | **None configured** (no keys in code; GA4/GSC/Sentry/PostHog are env-gated). Phase 5 ships flag-OFF. |
| Market | Spec says "India, Pune first" — **live data is actually Mumbai / Vasai-Virar / Nalasopara / Bangalore / Hyderabad / Delhi**. Engine is built market-agnostic; no Pune-specific logic. Timezone Asia/Kolkata, INR ✔ (matches existing `₹` formatting, `en-IN`). |

---

## 1. Architecture

- App code: `components/` (Vite root). Repo root holds SQL migrations applied manually via Supabase dashboard.
- Routing: react-router SPA (`components/App.tsx`), lazy routes, `/turf/:slug` resolves via `matchTurfParam` (accepts legacy raw id OR `{name}-{id}` slug).
- Public page serving: `vercel.json` rewrites all non-static paths to `/api/serve` (`api/serve.js`): browsers get the SPA shell; bots (50+ UAs) get static no-JS HTML from `api/agent-content.json` (build artifact: per-route title/description/h1/robots/sections/links); `Accept: text/markdown` gets markdown; unknown paths get real 404; private prefixes get `X-Robots-Tag: noindex`.
- This bot-HTML layer is the only place "server-rendered metadata" can exist today — the SEO engine must feed it **per-entity, DB-backed** data (currently it only knows build-time snapshots).

## 2. Database schema (as applied via dashboard SQL)

`turfs` (supabase_schema.sql:31-50 + ALTERs in supabase_admin_rbac.sql:103-108, supabase_client_panel.sql:24):
`id text PK, name, city, address, lat, lng, image, gallery text[], rating (static, default 4.5), timing (free-text), price_per_hour, sport_types text[], amenities text[], videos text[], description, is_popular, is_nearby, created_at, + status ('published'|'pending_approval'|'archived'), ownership, owner_id`.

- **No `slug` column** — slug synthesized at runtime in 3 duplicated copies (`seo.ts:60-64`, `generate-sitemap.mjs:45-52`, `generate-agent-content.mjs:33-40`).
- **No `updated_at`** — only `created_at`.
- **No locality column** — locality = `address.split(",")[0]` convention ("Indiranagar, Virar"); TS type declares `land_mark/landmark_lat/landmark_long` (seed.ts:21-23) but **no SQL columns exist**.
- **No normalized location tables** (country/state/city/locality) and **no sports/category taxonomy tables** — `sport_types text[]` free text incl. junk value `"seed data"` (seed.ts:161).
- `reviews` table exists (schema.sql:94-102); `turfs.rating` is **never recomputed** from reviews (static default 4.5).
- No soft delete (`deleteTurf` hard-deletes, lib/api/admin.ts:43-50); read RLS is `USING (true)` **without** a `status='published'` filter (schema.sql:216) → archived/pending turfs are publicly readable.
- Dual-schema divergence confirmed: **live** games schema = `games/game_players/game_waitlist` (supabase_schema_v1_0.sql:243-330); `open_games*` files are stale/retired.
- `seo_pages` table exists (admin_rbac.sql:242-262: page_type location|sport|location_sport, slug, title, description, h1, content, robots, enabled) + `site_settings` KV (215-220) — both **written by AdminSeo but consumed by nothing at runtime**.
- No `seo_redirects`, no metadata/versions/landing/log tables, no image captions/alt, no phone column.

## 3. Turf write paths (every entry point the SEO trigger must cover)

| # | Entry point | Location | Notes |
|---|---|---|---|
| 1 | Admin venue create | `admin/admin-api.ts:280-291` `createVenueAdmin` | wrapped in `withAudit` |
| 2 | Admin venue update / archive | `admin/admin-api.ts:267-278` `updateVenueAdmin`; archive = `status:"archived"` flip | |
| 3 | Legacy admin API | `lib/api/admin.ts:26/34/43` `addTurf/updateTurf/deleteTurf` | live but currently uncalled; **hard delete** |
| 4 | Owner facility update | `lib/api/clientPanel.ts:44-59` `updateMyFacility` (whitelist: name, city, address, image, price, timing, sport_types, amenities, description, is_popular) | owner-scoped by `owner_id` |
| 5 | Bulk backfill | `supabase_admin_rbac.sql:107-108` bulk UPDATE | one-off |
| — | Bookings | `lib/api/bookings.ts` writes only `bookings` | **confirmed: no turf writes** — booking activity will never trigger SEO work ✔ |

Writes are scattered across 3 client modules → **only a DB-level trigger on `turfs` covers every path** (client-side hooks would miss the legacy API).

## 4. Existing SEO code inventory (reusable)

- `lib/seo.ts`: idempotent `applySeo()` head manager (title/description/robots/canonical/OG/Twitter + page-scoped JSON-LD via `textContent`, safe escaping); builders for Organization, WebSite, BreadcrumbList, **SportsActivityLocation** (`turfJsonLd`, real-data-only guards: rating only from real reviews, amenities only from stored fields), Article; `openingHoursFromTiming` regex parser; `slugify/buildTurfSlug/turfPath/matchTurfParam/slugMatches`; `useSeo` hook. Used by Home, TurfDetail, Trust, Tournaments, Offers, OpenGames, NotFound, all 9 SEO landing pages.
- `scripts/generate-sitemap.mjs` (prebuild): static routes + blog + `/turfs/{city}` + one turf URL per venue (with image extension) + `/sports/{sport}/{city}` (junk-sport filtered); **lastmod = build date for every URL** (no real lastmod); no index/splitting.
- `scripts/generate-agent-content.mjs` → `api/agent-content.json` → `api/serve.js` bot HTML/markdown, private noindex, real 404s, `Vary: Accept`.
- `public/robots.txt`: sensible disallows (admin/client/auth/booking/receipt/theme/more), sitemap ref (hardcoded origin).
- `pages/seo/`: TurfsIndex, TurfsCity, TurfsLocality, SportsIndex, SportCity, OpenGamesCity, BlogIndex, BlogPostPage + shared shell (Breadcrumbs, QuickFacts, VenueGrid, CityLinks, EmptySeoState) with **anti-doorway noindex rules already in place** (city with no venues → noindex; locality needs ≥1 venue match; SportCity needs sport match; junk sports filtered).
- Admin: `/admin/seo` tabs (global settings → `site_settings`, pages CRUD → `seo_pages`, venues read-only preview, technical static preview). Known gap: settings/pages are **write-only** today (nothing consumes them at runtime; AdminSeo.tsx:71 admits it).
- vercel.json: trailingSlash:true, rewrite to /api/serve, HSTS/caching. GA4 + GSC meta env-gated (`lib/ga4.ts` — note: GSC verification meta is JS-injected, invisible to crawler-based verification). web-vitals beacon posts to `/api/vitals` which **does not exist** (silently dropped).

## 5. Data quality findings

1. Sport strings polluted: `"seed data"` junk value; consistent set otherwise: Cricket, Football, Futsal, Basketball (needs an alias/normalization map; sitemap already regex-filters junk).
2. No locality column — "Locality, City" address convention is unchecked; area filter parses `address.split(",")[0]`.
3. lat/lng inconsistent with city in seed (Virar turf has Bangalore coords) — distance claims unreliable.
4. `rating` default 4.5 static — never review-aggregated.
5. No phone/contact anywhere; `timing` free-text (regex-parsed today, OK-ish for hours schema only when parseable).
6. Images: unsplash hotlinks + local webp mock; gallery = bare URL array (no captions/alt).
7. Names unique in seed but **no DB uniqueness constraint**; dual-ID system (text `id` vs numeric `new_id` referenced in bookings.ts:464) — canonical URL choice must pin to `id`-based slug.
8. Address can be empty (admin form validates only name+city).
9. `listTurfs` ignores `status` → archived/pending turfs leak into public lists, sitemap and landing pages (turfs.ts:54).

## 6. Gap analysis vs. spec (section 5 of the master prompt)

| Spec table/feature | Verdict |
|---|---|
| `seo_metadata` + versions | **Add** (nothing equivalent; `seo_pages` is a per-landing-page content override, kept as the admin-override surface for landing pages) |
| `seo_category_associations` | **Adapt**: no category tables exist → `seo_sport_categories` (normalizing sport_types) + associations. Alias/mapping table = spec-mandated. |
| `seo_location_associations` + `seo_locations` | **Add** `seo_locations` (type/parent/name/slug/aliases/lat/lng) — no normalized hierarchy exists. |
| `seo_landing_pages` | **Add** (landing pages exist only as URL patterns today). `seo_pages` remains the content-override + approval surface joined by slug. |
| `seo_redirects` | **Add** + middleware in serve.js. |
| `seo_generation_logs`, `seo_validation_issues` | **Add**. |
| Triggers on turf writes | **Add** DB trigger → outbox job table (covers all 5 entry points incl. legacy hard delete). |
| Slug column + updated_at on turfs | **Add** (reversible ALTERs + backfill). |
| Feature flags | **Add** `site_settings` keys + env mirrors; master off = exact pre-change behaviour. |
| AI pipeline | Phase 5, flag OFF (no provider configured). |

## 7. Design (reusing what exists)

1. **Deterministic generation stays in the app layer** (template builder in TS, unit-testable) writing through `seo_metadata`; the SPA consumes `seo_metadata` via `useSeo` (extends existing applySeo); the **bot layer** gets per-turf data at request time.
2. **Request-time bot HTML**: `api/serve.js` gains a Supabase read (env `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, service-role only server-side) for `/turf/:slug` → 301 from `seo_redirects` → 410 for deleted → per-turf title/meta/robots/canonical/JSON-LD HTML. Falls back to build-time agent-content when the DB is unreachable or flags are off. **This is the SSR-equivalent for this stack.**
3. **Trigger → outbox → worker**: `turfs` AFTER INSERT/UPDATE/DELETE trigger enqueues `seo_generation_jobs` (idempotent, debounced by `content_hash`); a Supabase Edge Function (`seo-worker`) processes jobs (deterministic generation; AI flagged off) and updates sitemap state; **`prebuild` regeneration remains the always-on safety net** on every deploy.
4. **Flags read at two boundaries**: build scripts + serve.js read env (`SEO_ENGINE_ENABLED` etc.); admin can flip `site_settings.seo_engine_*` which the build/worker honor. Master flag off ⇒ pre-change behaviour byte-for-byte.
5. **Admin override wins**: `locked_fields` on `seo_metadata`; regeneration skips locked fields; every admin edit snapshots a version row.
6. **Indexability thresholds** (landing_min_listings=3, unique words 150, cannibalization 0.8) computed by the worker into `seo_landing_pages`; the SPA + sitemap + serve.js all honor `is_indexable`.
7. **Truthfulness guards**: deterministic templates use only stored fields; the existing real-data-only JSON-LD guards are extended; no ratings from the static `rating` column unless it equals the live review aggregate (worker computes and stores the aggregate).

## 8. Queue decision (no worker system exists)

**Chosen:** Postgres trigger → `seo_generation_jobs` outbox (idempotent, `content_hash` dedupe) + Supabase Edge Function worker (`seo-worker`, schedule via Supabase cron or invoked from admin "Run now") + prebuild regeneration on every deploy as the guaranteed refresh. Rationale: zero new infra, survives the "migrations run manually in dashboard" constraint, booking flow untouched (jobs are async, failures logged, saves unaffected).

## 9. Pending verifications (honesty list)

- Current Google guidance to verify before Phase 2 markup (self-serving reviews, rel=next/prev deprecation, FAQ restrictions, sitemap limits): **listed in the final report after the checks are actually done** — not assumed here.
- Live-DB data quality (real rows, not seed files): needs dashboard access — owner runs the audit queries in `docs/seo-engine/runbook.md` (Phase 1) or grants a read-only connection.
- Supabase service-role env vars on Vercel (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SEO_ENGINE_ENABLED`): must be set by owner before request-time bot HTML goes live.
- No automated regression suite exists for booking/payment today (manual regression = manual checks list).

## 10. Risks

- Migrations are dashboard-run by the owner (no CLI migrations) — SQL must be idempotent, reversible, and order-documented.
- CSR SPA: nothing "server-side" exists beyond serve.js; AEO/agent-content parity must be maintained for bot HTML.
- Junk sport values & missing locality will produce landing-page candidates that must noindex until data improves (thresholds handle this).
