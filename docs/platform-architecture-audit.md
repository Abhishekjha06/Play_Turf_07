# PlayTurf — Platform Architecture Audit & Improvement Plan

**Date:** 2026-11-13 · **Scope:** full repository audit, read-only (no code modified for this report)
**Verification basis:** every claim below was checked against source code, live deployment responses, or both. Items marked *(assumed)* could not be verified without database/credentials access.

---

## SECTION A — Executive Summary

PlayTurf is a **working player-facing turf discovery and booking SPA** with a genuinely solid booking core (atomic multi-hour reservations, per-court availability, double-booking prevention at the database level) and a **brand-new Super Admin Control Center** with real RBAC/MFA/audit design. Around that core sit three structural weaknesses:

1. **The turf-owner (client) panel is a façade.** Its dashboard, slot management and booking management screens contain **zero database calls** — `ClientBookingManagement.tsx:16` renders a hardcoded array; slot blocking exists only in component state. Owners cannot actually operate their venues.
2. **The data model is single-venue-per-owner.** There is no Business entity, no staff, no facility hierarchy, no payments/settlement tables. The requested ONE BUSINESS → MULTIPLE LOCATIONS → MULTIPLE FACILITIES → MULTIPLE AREAS model cannot be expressed in the current schema.
3. **Money is simulated.** No gateway exists; bookings confirm through `payMock`. The Finance module labels everything honestly, but real revenue, commissions, settlements and refunds are unimplemented.

The player experience is production-quality; the owner experience is a prototype; the admin experience is newly rebuilt and awaits only its database migrations and first admin provisioning. The path to a multi-vendor ecosystem is a **business-first schema migration + real owner tooling + server-authoritative payments** — detailed in Sections N and P.

---

## SECTION B — Existing Project Architecture

**Frontend.** React 18 + TypeScript + Vite (SWC), Tailwind with a runtime **LuxuryThemeProvider** that injects four token namespaces per theme (Premium Teal / AMOLED Black / light variants). React Router v6 with ~45 lazy-loaded routes grouped into: public player app (`/`), SEO landing pages (`/turfs`, `/sports`, `/blog`, trust pages), admin (`/admin/*` + `/admin/login`), client (`/client/*`), auth routes. State: TanStack Query for data fetching (5-min stale time, custom retry), React contexts for auth and the booking team flow, localStorage for sessions/themes/notifications. framer-motion throughout; @react-pdf/jspdf for tickets; embla for carousels.

**Backend.** Supabase (Postgres + Auth + RLS + Realtime + Storage). All data access goes through a typed API layer (`src/lib/api/*` → `api.ts` facade). Security-sensitive writes use **SECURITY DEFINER RPCs** (`join_public_game`, `approve_player_request`, `cancel_game`, planned `log_admin_action`, `admin_cancel_game`). Two **Vercel serverless functions** in `api/serve.js` (agent/SEO serving layer: real 404s, markdown negotiation, crawler HTML) with build-time content generation.

**Database.** 15+2 tables live (profiles, turfs, bookings, games, game_players, reviews, favorites, offers, banners, tournaments, feedbacks, feedback_activity, beta_users, rate_limits, admin_logs + admin_audit_log/site_settings/seo_pages from the pending migration). RLS everywhere, with two pending migration files that fix world-writable policies and role self-elevation.

**Deployment.** Vercel (git-main auto-deploy), prebuild generates sitemap + agent content from live data; PWA with service worker; env-gated GA4/GSC/Sentry/PostHog.

---

## SECTION C — Current Feature Inventory

Classification: ✅ fully implemented · 🟡 partial · 🎨 UI-only · ❌ missing · ⚠️ broken/requires action.

### Player / Customer panel
| Feature | Status | Notes |
|---|---|---|
| Email/password signup + login | ✅ | Email confirmation enforced; duplicate-signup detection; resend cooldown — **signup currently fails in production due to SMTP config** ⚠️ (owner must configure SMTP or disable confirm-email) |
| Google OAuth | ✅ | PKCE, origin-bound redirect |
| Phone OTP | ✅ | signInWithOtp/verifyOtp + auto profile creation; no server-side rate limit 🟡 |
| Password recovery | 🟡 | ForgotPassword sends reset email; recovery-link landing handled via auth callback; no dedicated reset-password UI |
| Session persistence/logout | ✅ | Validated via `getUser()`; epoch-guard prevents stale revalidation |
| Turf discovery + filters | ✅ | Home (popular/nearby/search), SEO city/sport pages from live data |
| Turf details | ✅ | Photos, sports, amenities, hours, pricing, **real reviews (CRUD)**, favorites, realtime games at venue |
| Slot availability | ✅ | Per-court, per-hour, live; stale pending reservations (>15 min) hidden |
| Multi-hour booking | ✅ | Batch insert, consecutive slots, DB-level conflict prevention |
| Payment | 🎨 | **Simulated checkout (`payMock`)** — honestly labelled; no gateway |
| Booking confirmation + ticket | ✅ | Booking ID, PDF ticket with QR, calendar link |
| Cancellation | ✅ | 15-min post-booking window (matches DB `created_at` clock) |
| Refund tracking | ❌ | No gateway → copy states "per venue policy"; no refund records |
| My Bookings | ✅ | Real, status-tabbed, case-normalized |
| Open Games | ✅ | Host wizard, join (atomic RPC), private approvals, realtime |
| Tournaments | 🎨/🟡 | Public listing real; **registration flow missing** |
| Offers | ✅ | Real CRUD via admin |
| Saved turfs | ✅ | favorites table + heart UI |
| Notifications | ✅ | Local + realtime user channel + push settings |
| Support | ✅ | Feedback modal → feedbacks table (+activity log) |
| Player analytics/history | 🟡 | Booking history real; spending/loyalty absent |

### Turf-owner (client) panel
| Feature | Status | Notes |
|---|---|---|
| Client login (role=client, server-verified) | ✅ | Rejects non-clients |
| Profile & settings | ✅ | Real profile update + **real password change** (fixed 2026-10-31) |
| Business dashboard | 🎨 | `ClientDashboard.tsx` has **zero data calls** — stats/calendar are local mock state |
| Slot management (block/unblock) | 🎨 | `ClientSlotManagement.tsx` has **zero DB calls** — blocks live in component state only |
| Booking management | 🎨 | `ClientBookingManagement.tsx:16` renders a **hardcoded bookings array** |
| Photos / pricing / turf edit | 🎨 | ClientPlaceholder pages |
| Revenue, settlements, staff | ❌ | No tables exist |

### Admin panel (rebuilt 2026-11-13)
| Module | Status |
|---|---|
| Secure login + TOTP MFA + RBAC (5 roles, permission matrix) | ✅ code (MFA execution needs first admin) |
| Overview (real aggregates, charts) | ✅ |
| Users (search/suspend + audit) | ✅ code — **needs migration run** |
| Venues (lifecycle + ownership) | ✅ code — needs migration columns |
| Bookings (read-only + CSV) | ✅ |
| Open Games (moderation via server RPC) | ✅ code — needs RPC |
| Finance | 🟡 — real booking data, everything labelled SIMULATED |
| SEO Center / CMS / Tournaments / Offers / Support / Analytics | ✅ |
| Security Center (audit log, sessions, MFA enrollment) | ✅ code |
| Settings (reauth-gated) + System health + Beta | ✅ |

### Platform layer
SEO/AI-readiness (real 404s, markdown negotiation, crawler HTML, llms.txt, trust pages, sitemap/robots) ✅ verified live. PWA ✅. Rate limiting 🟡 (client-side only). Server-side admin API ❌ (future edge functions).

---

## SECTION D — Admin Panel Architecture

Current navigation (implemented): Overview · User Management · Venue Management · Bookings · Open Games · Payments & Finance · SEO Management · Content & Marketing · Tournaments · Offers · Support & Feedback · Analytics · Security & Permissions · System Settings — each permission-gated by role.

**Data needs per missing module:** Commission/Settlements require `payments`, `refunds`, `commission_rules`, `settlements` tables (none exist). Staff Management requires `businesses`+`business_members`. Advertising requires `ad_campaigns`/`ad_creatives`. Coupons require `coupons`+`coupon_redemptions`. Tournament registrations require `tournament_registrations`. Booking status history requires `booking_status_history` (currently only `created_at` + audit entries).

**Recommendation:** keep the current 14-item sidebar but group into 4 sections — **Operations** (Overview, Bookings, Open Games), **Marketplace** (Venues, Users, Clients→Businesses), **Money** (Payments, Settlements, Refunds), **Growth** (SEO, CMS, Marketing, Tournaments) — plus **Platform** (Support, Analytics, Security, Settings). This mirrors the future business model instead of a flat list.

---

## SECTION E — Turf-Owner Panel Architecture (the big gap)

**Current reality:** one `profiles.role='client'` user ↔ turfs table rows with **no ownership column at all**. There is no way to express which client owns which turf; the owner dashboard ignores the database entirely.

**Target model (verified against your requirement):**
```
businesses (owner=profile)          ← the legal/vendor entity
 ├── business_members (staff)       ← role per member: owner/manager/receptionist/ground_staff
 └── locations (business_id, city)  ← a venue address
      └── turfs (location_id)       ← a facility: cricket turf 1, football ground…
           ├── turf_areas           ← playing areas/courts (replaces loose pitch_id)
           ├── turf_schedules       ← per-facility opening hours
           └── turf_pricing         ← per-facility, per-sport, peak/off-peak
```
This resolves **Business ≠ Location ≠ Facility ≠ Playing Area** — four distinct entities currently collapsed into one `turfs` row. Migration plan in Section N.

**Owner modules to build (priority order):** My Facilities (real CRUD) → Booking Calendar (real bookings for owned turfs) → Slot blocking (persist `blocked_slots`) → Pricing (per-facility) → Revenue (from payments once real) → Staff invitations → Settlements (post-gateway).

**Operational independence:** once owners can block slots, edit pricing and see real bookings, the admin's role shrinks to approvals and disputes — the current design (venue `status` lifecycle + ownership column in the pending migration) already anticipates this.

---

## SECTION F — Player Panel Architecture

Current flow is strong: Home → TurfDetail (SEO slug URLs) → 3-step booking wizard (teams → date/time/court → confirm) → simulated pay → ticket. **Friction points found:**
1. **Signup is broken in production** (email confirmation ON, SMTP failing — GoTrue rolls the user back). This is the #1 conversion blocker; fix SMTP or disable confirmation.
2. No guest browsing-to-booking handoff: booking requires sign-in at checkout — consider OTP-first login (already built) surfaced inside the booking flow.
3. No saved payment methods / one-tap rebooking (needs real gateway first).
4. Cancellation copy and refund expectation are now honest but there is no self-serve refund status (needs gateway).
5. Favorites/loyalty exist minimally; repeat-booking nudges (notifications) are in place.

---

## SECTION G — Database Architecture

**Live tables (verified):** profiles, turfs, bookings, games, game_players, reviews, favorites, offers, banners, tournaments, feedbacks, feedback_activity, beta_users, rate_limits, admin_logs (+ pending: admin_audit_log, site_settings, seo_pages). **Legacy/unused naming:** `open_games`/`open_game_players` in `supabase_schema.sql` vs the `games`/`game_players` the app actually uses; `game_waitlist` exists only in v1_0 SQL. ⚠️ Two divergent schema files — consolidate into one canonical migration history.

**Key tables:**
- `profiles` — id=auth.users.id, full_name, phone(10-digit check), role, is_admin, avatar_id (+ pending is_suspended). RLS: own-row only; role guard trigger pending.
- `turfs` — the facility row: name, city, address, image/gallery, rating, timing(text!), price_per_hour(scalar), sport_types(text[]), amenities(text[]), lat/lng, is_popular/is_nearby (+ pending status/ownership). **Structural problems:** no owner column; schedule is free text; pricing is one scalar; gallery/amenities as text arrays instead of normalized tables; rating denormalized (updated by review triggers *assumed*).
- `bookings` — id (client-generated `bkg_*` text), user_id, turf_id/turf_name/turf_image (denormalized), date, start_time, end_time, hours=1 per row, amount on first row, status, payment_id, open_game_id, is_split_booking, pitch_id (in live DB — **missing from repo schema's view definition** ⚠️), pitch/sport columns. Integrity: `unique_active_booking` partial unique index + `check_booking_overlap_and_expiry` trigger (Asia/Kolkata). Multi-hour = N rows sharing `payment_id: parent_<id>`. **No booking_status_history; no `updated_at`.**
- `games`/`game_players` — open games + participation with payment_status per player; status open/full/cancelled.
- No payments/refunds/ledger/settlements/commissions/coupons/ads/staff/businesses tables — all ❌.

**ERD (target):**
```
profiles 1─n business_members n─1 businesses 1─n locations 1─n turfs 1─n turf_areas
                                     turfs 1─n bookings n─1 players(profiles)
                                     turfs 1─n turf_pricing / turf_schedules
bookings 1─1 payments 1─n refunds          payments n─1 settlements(settlement_items)
games 1─n game_players n─1 profiles        reviews n─1 turfs/profiles
coupons 1─n coupon_redemptions n─1 bookings
```

---

## SECTION H — Authentication & Permissions

**Implemented roles:** player (`user`), turf owner (`client`), admins (`super_admin`, `admin`, `finance_admin`, `content_admin`, `support_admin`) — server-verified at their respective logins; role changes guarded by trigger (pending migration); admin MFA/AAL2; suspension columns pending.

**Gaps vs the requested staff hierarchy (operations/finance/support/marketing managers, receptionist, booking operator, ground staff):** staff invitations, business membership, facility-scoped permissions all ❌. Current RBAC is platform-level only.

**Permission matrix (current, verified by unit tests):** super_admin = all; admin = venues/games/CMS/support/analytics; finance = finance/bookings/analytics/settings-config; content = SEO/CMS/analytics; support = users/support/bookings-view/analytics; client = own client panel (broken until owner tooling is real); user = player features.

**Critical invariant (holds by design, verify after migrations):** a business owner can only ever see their own bookings/financials — requires the `business_members` RLS chain to be built; today there is nothing to leak because owners have no real data access at all.

---

## SECTION I — Booking & Payment Workflows

**Booking lifecycle (implemented, verified):** select venue → local-timezone date strip → slot grid (live availability from `bookedSlots`, stale pending >15 min ignored for display) → court picker (per-pitch availability) → duration 1–12 h → `createBooking`: auth-required, past-date/expiry validation, cross-midnight rejection, per-hour conflict checks that **fail closed**, batch insert → DB trigger re-validates overlap + expiry → `pending` rows → `payMock` confirms with atomic `status='pending'` guard → confirmation + ticket. Cancellation: 15-min window (confirmed+paid), case-insensitive, child rows cancelled, errors surfaced. Expiry: `expire_pending_bookings()` + pg_cron (pending migration).

**₹1,000 illustrative flow (target model, currently simulated):** player pays ₹1,000 → gateway fee ≈ ₹20 (2%) → platform commission (configurable %, captured at booking time so historical rates survive changes) → owner settlement = 1,000 − commission − gateway share (± agreed) → taxes per CA advice. **Today:** ₹1,000 books the slot, no money moves, `payment_id` is a random string, Finance shows it labelled SIMULATED.

**Recommendations:** (1) server-side order creation + signed webhooks + idempotent event table; (2) `payments`/`refunds` ledger tables with immutable rows; (3) commission snapshotted onto each booking; (4) settlement runs as generated statements, never live arithmetic; (5) keep double-booking prevention exactly as is — it is the strongest part of the system; (6) tax treatment requires a CA.

---

## SECTION J — Missing Features (prioritized)

1. Real owner tooling (facilities CRUD, real calendar, slot blocking persistence, pricing)
2. Payment gateway + payments/refunds/ledger + webhooks
3. Business/staff entities + facility-scoped RLS
4. Commission + settlements engine
5. Tournament registrations
6. Coupons/campaigns
7. Advertising platform (banners exist; campaigns/scheduling/sponsors don't)
8. Booking status history + check-in/QR verification
9. Server-side rate limiting + admin API (edge functions)
10. Dedicated password-reset page; review moderation queue

---

## SECTION K — Technical Problems

**P0 (deployment-critical):** both SQL migrations unapplied → role self-elevation + world-writable policies live until run (documented in docs/production-readiness.md §1); signup SMTP broken.
**P1:** owner panel mock screens expose fake data (removed from real workflows but visible); no owner↔turf ownership column; client-side rate limiting only; `payMock` reachable on booking detail (kept, labelled, guarded pending gateway).
**P2:** dual divergent schema files; free-text `timing`/`price_per_hour` scalar blocks per-facility pricing; no `booking_status_history`/`updated_at`; client-generated booking IDs; OTP unsanitized phone formatting (+91 prefix on any input); Tournaments page uses fallback seed data when DB is empty (labelled).
**P3:** rating denormalization; `is_popular` manual curation; several `ClientPlaceholder` routes.

---

## SECTION L — Improvement Recommendations (top 8, with business rationale)

1. **Ship the two pending migrations** — unlocks every admin module and closes the privilege-escalation hole. Dependency: backup. Risk: low (idempotent, additive).
2. **Business-first schema (businesses/locations/turf_areas/business_members)** — enables multi-facility vendors, staff, and eventually franchise growth. Requires new tables + `turfs.location_id` backfill; frontend owner panel rebuild on top.
3. **Real owner panel v1** — facilities + calendar + slot blocking + pricing. This is what makes the marketplace self-operating.
4. **Razorpay Route (or Cashfree Easy Split) integration** per the audit's server-authoritative design — turns Finance from simulated to real.
5. **Fix signup SMTP** — immediate conversion win, zero code.
6. **Server-side admin API (edge functions)** for rate limiting + user admin — closes client-side enforcement gaps.
7. **Consolidate schema files** into one migration history (supabase/migrations) — ends the games/open_games divergence.
8. **Booking status history + check-in QR** — cheap, high operational value for owners.

---

## SECTION M — Development Roadmap

- **P1 Critical foundation:** run migrations; fix SMTP; first Super Admin + MFA; schema consolidation.
- **P2 Core operations:** business/location/facility tables; owner panel v1 (facilities, calendar, slots, pricing); staff invitations.
- **P3 Financial management:** gateway integration, payments/refunds ledger, commission snapshot, settlements, Finance module on real data.
- **P4 Dashboards & reporting:** owner revenue/occupancy; admin platform analytics on ledger; aggregated nightly rollups.
- **P5 Marketing & monetization:** coupons, campaigns, sponsored listings/ads pipeline.
- **P6 Advanced sports ecosystem:** tournament registrations/teams, leagues, ratings/rankings, loyalty.

---

## SECTION N — Database Migration Plan

**Modify:** `turfs` (+location_id, +maintenance windows), `bookings` (+status_history split-out, +commission_snapshot, +payment FK), `profiles` (no change beyond pending). **Create:** businesses, business_members, locations, turf_areas, turf_schedules, turf_pricing, blocked_slots, booking_status_history, payments, refunds, financial_ledger, commission_rules, settlements(+items), coupons(+redemptions), tournament_registrations, support_tickets. **Never touch:** bookings' existing integrity index/trigger semantics. All new work as forward-only migration files reviewed in staging first (same pattern as the two pending files).

---

## SECTION O — Testing Strategy

Current: vitest (RBAC/validators), serve-function harness, live HTTP suite, `supabase_rls_tests.sql` (ready). Add: RLS matrix in CI after migrations; booking-concurrency integration tests (parallel inserts against a staging DB); payment webhook contract tests with the chosen gateway's test mode; Playwright E2E for signup→booking→cancel and host→join flows; owner-panel CRUD tests once real. Keep the existing rule: nothing is marked passing without execution.

---

## SECTION P — Final Recommended Architecture

**Player SPA** (current, keep) → **typed API layer** (current, extend) → **Supabase Postgres with business-scoped RLS** (migrate to business-first model) → **Edge functions** for payments/webhooks/admin ops and server-side rate limits → **Vercel static+function serving layer** (current agent-readiness design, keep) → **Admin control center** (current, extend with Money + Marketplace sections) → **Owner panel** (rebuild on real data) → observability (Sentry/PostHog/GA4) env-gated. This preserves every working subsystem while replacing the two mock surfaces (owner panel, payments) with real ones — the definition of a scalable multi-vendor sports booking ecosystem rather than a turf booking app.

---

*Verified-sources: source inspection of `src/` (all routes/API/pages), `supabase_schema.sql` + `supabase_schema_v1_0.sql` + pending migrations, live deployment HTTP checks (2026-11-13), unit/live test runs. Assumptions are marked inline.*
