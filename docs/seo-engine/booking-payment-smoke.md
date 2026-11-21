# Play Turf — Booking/Payment Smoke Checklist (manual)

Owner runs this BEFORE applying any `supabase_seo_*.sql` migration, and again
afterwards (master prompt §18.26: booking/payment regression must pass).
Runtime: dev build on `localhost:3030`, real Supabase project, payment is
**mock by design** — no real money flows anywhere.

Pre-flight: `git log --oneline -1` (note the commit), dev server running.

## Booking flow (guest + logged-in)

| # | Step | Expected |
|---|---|---|
| 1 | Home → Popular Turfs card → click card body | lands on `/turf/{name}-{id}` detail page |
| 2 | TurfDetail → Book Now | `?book=true` booking view opens, step 1 (Pick Match) |
| 3 | Pick date → slot picker | free/booked counts render, period headers collapse/expand |
| 4 | Select slot + duration → Continue | step 2 (Confirm & Pay) shows match summary with team cards |
| 5 | Team picker sheet | opens as bottom sheet, avatars render, selection sticks |
| 6 | Confirm → mock payment (slide-to-confirm) | step 3 receipt renders with booking ID, no fabricated refund lines |
| 7 | My Bookings | new booking listed with correct status |
| 8 | Booking detail → ticket modal | ticket renders (max-w-lg), booking ID matches |
| 9 | Repeat 2–6 logged-out (guest) | guest booking path still works, no auth redirect loop |

## Host / open games

| # | Step | Expected |
|---|---|---|
| 10 | Open Games → Host Game wizard | 3-step bottom sheet; court fee computed = venue rate × hours (never typed) |
| 11 | Publish → feed | game card appears, no dupes from double-submit |
| 12 | Join a game from another account | join sheet → mock pay → player added, slots_filled increments |

## Admin / owner panels

| # | Step | Expected |
|---|---|---|
| 13 | `/admin/login` (MFA) → Bookings module | list loads, filters work |
| 14 | AdminVenues → edit a venue (price) | saves; audit log entry written |
| 15 | `/client` (owner login) → Pricing | rate change persists, only own facilities editable |
| 16 | Realtime: two browsers, one joins game | other browser updates without reload |

## After migration 001 specifically

| # | Step | Expected |
|---|---|---|
| 17 | Repeat 2–6 | identical; booking writes never enqueue SEO jobs (`seo_generation_jobs` has no booking-triggered rows) |
| 18 | Save a venue in AdminVenues | exactly ONE pending row in `seo_generation_jobs` for that turf (content_hash dedupe) |
| 19 | Home page lists | archived/pending turfs absent (listTurfs published filter) |
| 20 | `/sitemap.xml` | returns XML (DB-backed or fallback), no 500 |

Failure on any row = STOP, do not apply further migrations, report the failing
row with screenshots.
