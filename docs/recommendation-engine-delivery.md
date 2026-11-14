# Play Turf Recommendation Engine V1 — Delivery Report (Phase 18)

Date: 2026-11-14 · Status: **implemented and tested** (unit tests executed; SQL-side tests are in the migration file and must be run in the Supabase dashboard per project convention — the RPC is not yet applied to the database, so the app currently uses the documented client-side fallback path).

## 1. Schema audit
See [recommendation-engine-audit.md](recommendation-engine-audit.md). Key facts: tables `turfs` / `reviews` / `bookings` / `favorites`; no PostGIS; no sports-ID table; `turfs.rating` is a drifting denormalized scalar; no active/soft-delete column on turfs; booking statuses case-mixed (`confirmed` / `CONFIRMED`).

## 2. Tables and columns used
- `turfs`: id, name, city, image, lat, lng, price_per_hour, sport_types[], amenities[], rating (global prior only)
- `reviews`: turf_id, rating, created_at (live per-turf aggregate — source of truth)
- `bookings`: turf_id, status, created_at (aggregate counts only — **no customer columns ever leave the function**)

## 3. New migrations
`supabase_recommendation_engine.sql` — **awaiting dashboard run** (project convention). Adds:
- `idx_bookings_turf_created (turf_id, created_at DESC)` — 30-day popularity window
- `idx_turfs_city (city)`
- `public._pl_turf_distance_km()` — immutable haversine (PostGIS-free; documented GiST/ST_DWithin upgrade path in the file)
- `public._pl_similar_turfs_pass()` — private scoring pass (REVOKE ALL FROM PUBLIC)
- `public.get_similar_turfs(p_current_turf_id, p_selected_sport_id DEFAULT NULL, p_search_radius_km DEFAULT 10, p_result_limit DEFAULT 10)` — SECURITY DEFINER, `SET search_path = public, pg_temp`, EXECUTE granted to `anon, authenticated` only, inputs validated (radius 1–50, limit 1–10), §6 test suite included (T1–T8)

## 4. Formula (identical in SQL and TS)

```
score = Σ(wᵢ·sᵢ) / Σ(wᵢ)   over components with data (re-normalized)

distance   (0.35) 100·max(0, 1 − km/radius)          haversine, 10 km → fallback 20 km
sports     (0.30) 100·Jaccard(sports)                 slug-normalized; selected sport
                                                             = 50% primary + 50% Jaccard
price      (0.15) 100·max(0, 1 − |Δ|/current)          missing/zero → unavailable
rating     (0.10) ((v/(v+m))·R + (m/(v+m))·C), m=5     normalized (BR−1)/4×100
facilities (0.05) 100·Jaccard(amenities)               missing → unavailable
popularity (0.05) 100·count/poolMax                    confirmed bookings, last 30 days
```
Tie-break: score DESC → sports DESC → distance ASC → Bayesian DESC → turf_id ASC. Diversity: same normalized name+city collapses to one slot. Cap: 10 results.

## 5. Missing-data handling (Phase 9 — implemented, tested)
- Unavailable component → `null` score, weight dropped from the denominator, availability reported in `completeness.available/missing`.
- Missing coordinates → candidate excluded outright (never bypasses geo filter).
- No reviews → neutral Bayesian prior in scoring, but `rating: null` in the response and never a "Highly rated" label.
- Missing price (null/zero/non-finite) → component unavailable, never scored as 0.
- Booking source unavailable (e.g. RLS-tightening migration) → popularity `null` for all candidates + `metadata.booking_data_available: false`.
- Seed data-quality finding: `turf_1.sport_types` contains junk `"seed data"` — recommended cleanup, not silently dropped by the engine.

## 6. Backend files changed
- `supabase_recommendation_engine.sql` (new)
- `components/src/lib/api/turfs.ts` — `getSimilarTurfs()` (RPC-first → client fallback), `clearRecommendationCache()`, 5-min TTL cache keyed by turf+sport, in-flight dedupe (Phase 16)
- `components/src/lib/api.ts` — facade additions only

## 7. Frontend files changed
- `components/src/turf/SimilarTurfsNearby.tsx` (new) — heading, subtitle, cards (photo lazy-loaded, name, **approx.** distance, price, rating+count or "New venue", sports, grounded label, match %, View Details), loading skeleton / honest empty / retry error states
- `components/src/pages/TurfDetail.tsx` — section swapped to the engine; review submit now invalidates the recommendation cache; booking flow untouched

## 8. Test results (Phase 17)
- **Vitest: 50/50 pass** (39 new in `src/test/recommendation.test.ts` + 11 existing). Spec map: cases 1–8, 10–16, 21 covered in unit tests; 9 (no `is_active` column exists — documented), 17 (no availability filter by design), 18–20 (SQL-side, in migration §6 T1–T8), 22 (below).
- Validation asserted: component and total scores within 0–100, weights sum to 1, spec Jaccard examples exact, Bayesian ordering (2-review 5.0 < 300-review 4.7), deterministic results, no filler venues, self-exclusion, coordinate/blank-name eligibility, 10→20 km fallback, 10-cap, diversity dedupe.
- During test runs two **test bugs** (not engine bugs) were found and fixed: shared fixture names colliding with the diversity rule and two hand-computed expectations (blend = 75, Jaccard({A,B},{A}) = 50).

## 9. Query performance (measured)
- Client fallback (active today): 3 minimal queries — `turfs *`, `reviews(turf_id, rating)`, confirmed bookings last-30d `(turf_id)` — then in-memory scoring; measured end-to-end render of recommendations < 1 s on the dev server with 11 venues. Scales via the RPC: single round-trip, set-based scoring, no full booking history fetched, no N+1 (LATERAL aggregates + the new composite index).
- Cache: 5-minute TTL + explicit invalidation on review submit; duplicate concurrent requests deduped.

## 10. Security findings
- RPC is SECURITY DEFINER **only** so aggregate booking counts survive the pending RLS-tightening migrations; search_path locked to `public, pg_temp`; EXECUTE revoked from `public`, granted to `anon`/`authenticated`; radius/limit bounded; private pass function non-executable (T8).
- No service-role key introduced; no customer or private booking data in any response (aggregate counts only).
- Existing risk (documented, unchanged): `bookings` currently has a public SELECT policy in `supabase_schema.sql` — tightening is already covered by the pending `supabase_security_fixes.sql`.

## 11. Verified in the app (real data)
- Skyline Rooftop Turf → Arena 360 (approx. 15.9 km, "Similar pricing", 41% match, "New venue" — no invented rating), "within 20 km" fallback metadata shown.
- Arena 360 → Skyline Rooftop Turf (46%) + Nine Stars Turfs X SportVot (approx. 13.6 km) — cross-navigation works both ways; geographically consistent (Nine Stars is >20 km from Skyline and is correctly absent there).
- Card click navigates to the existing turf-details route; themes: AMOLED black + Premium Teal + desktop/narrow widths all verified.

## 12. Remaining issues
1. **Run `supabase_recommendation_engine.sql` in the Supabase dashboard** (and §6 tests) to move from the client fallback to the hardened RPC. The app works today without it, identically scored.
2. `turf_1.sport_types` contains `"seed data"` — clean the row.
3. `turfs.rating` has no review-sync trigger — the engine ignores it for candidates, but screens that display `turfs.rating` (e.g. identity card) can drift from `reviews`; a sync trigger is a separate, recommended follow-up.
4. `turfs` has no `is_active`/soft-delete column — when one is added, add `AND is_active` to the candidate WHERE clause (one line, signature unchanged).
5. PostGIS adoption is optional (documented path in the SQL file) — worthwhile only if the venue count grows large.
