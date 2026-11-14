# Play Turf Recommendation Engine V1 — Repository Audit (Phase 1)

Date: 2026-11-14 · Auditor: pre-implementation audit, read-only. No DB changes made during this phase.

## 1. Existing Supabase configuration

- Client: `components/src/lib/supabase.ts` — single anon-key browser client via `getSupabase()` + `withTimeout()`. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_*` in `components/.env.local`. **No service-role key anywhere in the webapp.**
- Data access is facaded through `src/lib/api.ts` → `src/lib/api/{turfs,bookings,auth,admin,clientPanel,openGames,...}.ts`.

## 2. Actual tables and columns (from `supabase_schema.sql`, the canonical schema file)

| Table | Relevant columns |
|---|---|
| `turfs` | `id text PK`, `name`, `city`, `address`, `lat double precision NULL`, `lng double precision NULL`, `image`, `gallery text[]`, `rating double precision DEFAULT 4.5`, `timing text`, `price_per_hour double precision NOT NULL`, `sport_types text[]`, `amenities text[]`, `videos text[]`, `description`, `is_popular bool`, `is_nearby bool`, `created_at timestamptz` |
| `reviews` | `id text PK`, `turf_id → turfs(id)`, `user_id`, `user_name`, `rating`, `comment`, `created_at` |
| `bookings` | `id text PK`, `user_id`, `turf_id → turfs(id)`, `turf_name`, `turf_image`, `date text` (local `YYYY-MM-DD`), `start_time`, `end_time`, `hours`, `amount`, `status text DEFAULT 'PENDING'`, `payment_id`, `open_game_id`, `is_split_booking`, `created_at` |
| `favorites` | `id`, `user_id`, `turf_id` |

Pending (awaiting dashboard run, per project convention): `supabase_security_fixes.sql`, `supabase_admin_rbac.sql`, `supabase_client_panel.sql` (adds `turfs.owner_id`, `blocked_slots`, owner RLS). **The engine must not depend on these.**

## 3. Geographic functionality

- **No PostGIS** anywhere in SQL files or source. No spatial index.
- Client-side haversine exists: `distanceKm()` in `src/lib/api/turfs.ts:8` — returns `Infinity` for missing coordinates (good defensive default).
- `turfs.lat/lng` are nullable; **8 of 11 seed turfs have coordinates, 3 do not** → eligibility filtering on valid coordinates is a real, exercised path.

## 4. Sports / facilities / pricing structure

- **No sports mapping table.** `turfs.sport_types` is a `text[]` of display names (`Football`, `Futsal`, `Cricket`, `Basketball`, …). Normalization must be a lowercase-slug comparison; "stable sport IDs" do not exist and will not be invented.
- **Data-quality finding:** `turf_1.sport_types` contains the junk value `"seed data"` (`components/src/data/seed.ts`). Normalization handles it, but the row should be cleaned.
- **No pricing tables** (no peak/sport-specific pricing) — single `price_per_hour`. Phase 5's "equivalent areas/durations" cannot be computed; score uses the actual starting hourly price per turf, which is what the product sells.
- Amenities are `text[]` display names (`Floodlights`, `Parking`, `Washroom`, `Drinking water`, `Cafe`, `Locker`, `AC`, `LED`, `Nets`).

## 5. Ratings

- `turfs.rating` is a **denormalized scalar with no sync trigger from `reviews`** → it can drift from the real review aggregate. Audit finding.
- `reviews` table is the source of truth for **review counts** (verified-user reviews: inserts require an authenticated user).
- Engine policy: **Bayesian rating uses the per-turf review aggregate computed live from `reviews`** (R = AVG(rating), v = COUNT) rather than trusting the drifting scalar; global prior C uses AVG(`turfs.rating`) across all turfs.

## 6. Booking statuses

- Mixed casing in code: `'PENDING'`, `'CANCELLED'`, `'confirmed'`, `'CONFIRMED'` (bookings.ts:778 already treats them case-insensitively). The popularity query must normalize with `lower(status) = 'confirmed'`.
- No `failed`/`expired` status values exist in code; excluding cancelled is sufficient. `is_split_booking` and `open_game_id` rows are real confirmed bookings of the venue.

## 7. Active/inactive status

- **No `is_active`/`status`/soft-delete column on `turfs`.** Deletion is physical (`ON DELETE CASCADE` from bookings/reviews). Eligibility rule "active/publicly bookable, not soft-deleted" therefore reduces to *row exists*; a future `is_active` column can be AND-ed in without signature changes (documented in the RPC).

## 8. RLS policies

- Public SELECT on `turfs`, `reviews`, `bookings` (schema lines ~186-200); user-scoped INSERT on `reviews`; user-scoped all on `favorites`. Pending migrations tighten/extend this — engine must work under **both** current and pending policies.

## 9. Existing indexes

`idx_bookings_user_id`, `idx_bookings_turf_id`, `idx_bookings_status`, `idx_reviews_turf_id`, `idx_favorites_user_id`, `idx_open_game_players_*`. **Missing for this engine:** composite `bookings(turf_id, status, created_at)` for the 30-day popularity window; `turfs(city)`; coordinate support (`(lat,lng)` btree now, GiST if PostGIS is adopted later).

## 10. Existing turf details page & integration point

- `components/src/pages/TurfDetail.tsx` — "Similar Turfs Nearby" section currently = naive same-city `api.listTurfs()` filter rendered with `CompactTurfCard` (no distance, no scoring). This is the section the engine replaces.
- The booking flow (`/booking/new/:turfId`, sport popup, `?date=` passthrough) is **out of scope and untouched**.

## 11. Required migrations (created in Phase 13)

1. `get_similar_turfs(...)` RPC — **pure-SQL haversine** (no PostGIS dependency; audit found none, and Phase 3 says not to introduce one without inspection). Structured so a PostGIS `ST_DWithin` variant can replace the distance predicate later.
2. Composite popularity index + city index. (Coordinate btree optional; documented.)
3. Hardened function privileges (locked `search_path`, `REVOKE ... FROM public`, `GRANT EXECUTE TO anon, authenticated`).

## 12. Security & performance risks found

| Risk | Handling in this work |
|---|---|
| Public SELECT on `bookings` exposes customer rows | RPC returns **only aggregate counts**; no customer columns in any output |
| `SECURITY DEFINER` surface | Locked `search_path`, input validation, bounded radius/limit, revoke default EXECUTE |
| Drifting `turfs.rating` | Live Bayesian aggregate from `reviews` (see §5) |
| 3 turfs without coordinates | Excluded from candidates; completeness metadata reports it |
| Junk sport value `"seed data"` | Slug normalization + documented data-cleanup recommendation |
| `bookings.date` is text | Popularity uses `created_at` (timestamptz) — reliable |
| N+1 / full-history scans | Single SQL aggregation over indexed 30-day window; client fallback fetches turfs once and scores in-memory |
