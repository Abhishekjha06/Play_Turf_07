# PlayTurf — Production Readiness Runbook

Generated 2026-11-13. Companion files: `supabase_security_fixes.sql`, `supabase_admin_rbac.sql`, `supabase_rls_tests.sql` (repo root). This document is the owner's execution checklist for everything that requires credentials, business decisions or legal review — the code-side work is complete.

---

## 1. Migration review (both SQL files, audited line-by-line)

| Check | security_fixes | admin_rbac | Notes |
|---|---|---|---|
| Destructive statements | None (drops only policies it recreates) | None (ADD COLUMN / CREATE only) | No data is ever deleted |
| Idempotent | Yes (IF EXISTS / IF NOT EXISTS / drop-then-create) | Yes | Safe to re-run |
| Ordering dependency | **Must run FIRST** | **Second** | admin_rbac's `is_playturf_admin()` and role-guard re-application assume the base policies from security_fixes |
| Triggers created | profiles_role_guard | profiles_role_guard (re-applied), profiles_suspension_guard, trg_bookings_status_lowercase, trg_check_booking_overlap_and_expiry | Duplicate guards are idempotent (drop-then-create) |
| New tables | — | admin_audit_log, site_settings, seo_pages | All with RLS enabled |
| New columns | — | profiles.is_suspended, .suspension_reason; turfs.status, .ownership | Defaults keep existing rows working |
| RPCs | — | admin_cancel_game, log_admin_action (SECURITY DEFINER, JWT-derived actor) | log_admin_action replaced the client-side audit insert (spoofable actor) on 2026-11-13 |
| Known conflicts | Recreates "Admins can manage X" policies | Replaces those predicates with the extended role list | Run in order — no manual merging needed |
| Syntax risk | Low | Low | Both files use plain plpgsql/DO blocks; tested constructs only |
| Rollback | Policies: drop the recreated ones; index: recreate the original `unique_active_booking` definition | Drop new tables/columns (`ALTER TABLE … DROP COLUMN IF EXISTS`), drop triggers/RPCs | Full rollback script can be generated on request — **take a backup first** |

**Execution order:** backup → `supabase_security_fixes.sql` → `supabase_admin_rbac.sql` → `supabase_rls_tests.sql` (verification).

---

## 2. First Super Admin provisioning (one-time, controlled)

No public endpoint creates administrators. The bootstrap is a reviewed SQL operation:

1. **Create the auth user** — Supabase Dashboard → Authentication → Add user → enter the owner's real email + a strong password → **Auto Confirm User**. (Do not use a developer's personal email as the *business* contact without confirmation — but the admin LOGIN identity may be the owner's own email.)
2. **Get the user's UUID** — Authentication → Users → copy the id.
3. **Grant the role** (SQL Editor — replace the UUID):
   ```sql
   INSERT INTO public.profiles (id, full_name, phone, role)
   VALUES ('<UUID>', '<Owner Name>', '<10-digit-phone>', 'super_admin')
   ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
   ```
   If a profiles row already exists (the owner logged in as a player first): `UPDATE public.profiles SET role='super_admin' WHERE id='<UUID>';`
4. **Verify** — log in at `/admin/login` with that email → Overview must load.
5. **Enroll MFA immediately** — Security Center → My MFA → enroll authenticator. Once enrolled, every admin sign-in requires the TOTP code (AAL2) and the AdminRoute guard blocks non-MFA sessions.
6. **Audit** — the grant is a manual SQL step; record it (who, when, why) in the deployment notes. All subsequent admin provisioning should be done by this Super Admin via the same SQL pattern (UI role editing is intentionally not provided).
7. **Additional admins**: create auth users the same way, set `role` to one of `admin` / `finance_admin` / `content_admin` / `support_admin`, have each person enroll MFA at first login.

**Security notes:** the role-guard trigger blocks ANY user (including via the public API) from setting their own role; admin login re-verifies the role server-side and signs non-admins out; suspended admins are rejected at login and by AdminRoute.

---

## 3. Google Search Console setup (owner access required)

1. Go to [search.google.com/search-console](https://search.google.com/search-console) → Add property → **URL prefix** → `https://play-turf-git-main-abhishekjha06s-projects.vercel.app/` (or the permanent domain once configured).
2. Choose **HTML tag** verification → copy the `content` token.
3. Vercel → Project → Settings → Environment Variables → add `VITE_GSC_VERIFICATION = <token>` (Production) → redeploy. The meta tag is injected automatically by `src/lib/ga4.ts`.
4. Verify, then Sitemaps → submit `sitemap.xml`.
5. URL Inspection → request indexing for `/`, `/about`, `/contact`, `/privacy`, `/turfs`.
6. GA4 (optional, already env-gated): set `VITE_GA4_ID=G-…` → redeploy. PostHog remains the in-app analytics; do not double-track the same events in both tools without a consent plan.

**Pre-flight already verified live:** homepage indexable (`X-Robots-Tag: index, follow`), sitemap 200 with 33 canonical URLs, robots.txt 200 with sitemap reference, real 404s, trust pages 200.

---

## 4. Payment gateway comparison (owner decision required)

No gateway account exists and no credentials are configured — **nothing live has been implemented**. Comparison for the owner's selection (fees are indicative; confirm with each provider):

| Criterion | Razorpay | Cashfree | PayU |
|---|---|---|---|
| Standard fee | 2% | ~1.9–1.95% | 2% |
| Settlements | T+2 (T+1/instant paid options) | **T+1 standard**, instant ~15 min | T+2, instant paid |
| Marketplace/split | **Route** (mature, vendor onboarding) | **Easy Split** (strong payouts) | Split exists, less polished |
| UPI/checkout | Strong UPI success rates, best-documented APIs | Strong, good payout APIs | Competitive |
| Webhooks | Mature, signed | Signed, lifecycle events | Signed |
| Best fit here | Recommended default: Route matches the PlayTurf model (player pays platform → commission → venue settlement) | Pick if lowest fee + fastest payouts dominate | Pick only on negotiated pricing |

**Recommended model decision (owner must approve):** players pay PlayTurf (the platform collects), PlayTurf keeps a configurable commission and settles venue owners periodically (Razorpay Route or Cashfree Easy Split both support this). Alternative: direct-to-owner collection with platform billing — changes the architecture. Until approved, the Finance module keeps its honest SIMULATED labels.

**Implementation plan once the provider is selected** (server-authoritative, matches the audit requirements): order creation in a Vercel function (server computes amount from the booking), signed-webhook verification + idempotency (provider event id stored), atomic booking confirmation in a Postgres RPC transaction, `payments` + `refunds` tables (migration will be drafted for review), reservation expiry already handled by `expire_pending_bookings` cron. **No gateway code will be committed before the owner picks the provider and provides test-mode keys.**

---

## 5. Privacy / DPDP Act 2023 status

- The DPDP Rules 2025 were notified 13 Nov 2025; the full notice-and-consent obligations bind Data Fiduciaries from **~May 2027** (18-month tranche); Consent Manager registration opened at the 12-month mark (Nov 2026).
- **Implemented now:** the privacy page discloses real data flows — Supabase Auth (email/Google/OTP), profiles/bookings/games/feedback data, localStorage usage, PostHog analytics **with session recording (inputs masked)**, Sentry error monitoring with replay, Vercel hosting — plus DPDP-aligned rights (access/correction/erasure, consent withdrawal) and the grievance channel.
- **Requires legal review (do not treat as compliant yet):** notice-and-consent UX (consent before analytics/recording where required), children's-data provisions (the platform has no age gate), grievance-officer appointment (page promises publication), data-retention schedule, processor contracts (Supabase/Vercel/PostHog/Sentry DPAs), and the payment-processor disclosure once a gateway is live.

---

## 6. Vercel deployment classification

- The URL `play-turf-git-main-abhishekjha06s-projects.vercel.app` is a **git-main deployment**. Live response headers verified on 2026-11-13: homepage returns `X-Robots-Tag: index, follow, max-image-preview:large` (set by `api/serve.js`); `/admin` returns `noindex, follow`. Vercel's automatic preview-noindex was **not** observed on this URL.
- **Owner action:** confirm in the Vercel dashboard whether this project has a production domain assigned. If it is a preview, attach the permanent domain (or promote this project) — canonicals/OG/sitemap/llms.txt all read `VITE_SITE_ORIGIN` (or the default in `src/config/business.ts`), so switching domains is a one-env-var change + redeploy.

---

## 7. Outstanding owner decisions (blocking items)

| Decision | Blocks |
|---|---|
| Permanent production domain | Canonical URLs, GSC property, final indexing status |
| First Super Admin identity | All admin acceptance testing (MFA, RBAC-as-roles, audit) |
| Running both SQL migrations | Every admin data module (currently honest "migration required" states) |
| Approved business contact details | Organization contactPoint/address, Contact page |
| Privacy legal review | Final privacy policy status |
| Payment provider + settlement model + test keys | Real payments, settlements, refunds |
| Search Console account access | Verification, sitemap submission, indexing status |
