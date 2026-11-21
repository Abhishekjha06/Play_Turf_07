# Proposal (rev 2): verified reviews via a COMPUTED view

Owner round-3 item 8 — **proposal only. Nothing implemented; booking tables
and flows untouched. The receipt touch is a SEPARATE later PR.**

## Confirmed facts (from supabase_schema_v1_0.sql)
- `bookings.id` is **uuid** (v1_0:158, `gen_random_uuid()`), `turf_id text`
  references turfs, `user_id uuid` references auth.users, and the table
  carries a completion status (`status` text — 'completed' included in the
  app's status set).
- `reviews` rows today are self-reported; `turfs.rating` is a static default.

## Design (no stored `verified` column)
A **computed view** determines verification at read time — no denormalized
flag to keep honest, no booking-table changes:

```sql
CREATE OR REPLACE VIEW public.reviews_verified AS
SELECT r.id, r.turf_id, r.user_id, r.user_name, r.rating, r.comment, r.created_at,
       (r.booking_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM bookings b
                    WHERE b.id = r.booking_id
                      AND b.user_id = r.user_id
                      AND b.turf_id = r.turf_id
                      AND lower(b.status) = 'completed')) AS verified
FROM reviews r;
```

View-level enforcement instead of stored columns:
- `booking_id` is nullable on reviews; the view marks a row verified only when
  the booking matches user + turf + completed status (unforgeable by simple
  client writes because the view recomputes from bookings).
- `unique(booking_id)` on reviews: one review per completed booking — enforced
  with a partial unique index `CREATE UNIQUE INDEX reviews_booking_id_key ON
  reviews (booking_id) WHERE booking_id IS NOT NULL;` plus a CHECK that a
  row carrying booking_id names the same turf (`turf_id` must match the
  booking's turf — enforced via trigger or a composite FK
  `reviews(booking_id) REFERENCES bookings(id)`; the booking itself already
  binds user+turf).

## RLS
- anon/authenticated: SELECT only rows where `verified = true` (view) —
  unverified reviews stay visible in the user's own account pages via the
  base-table policies already present.
- Writes stay on the base `reviews` table with its existing policies; the
  receipt PR adds the booking_id parameter.

## The receipt touch (SEPARATE later PR)
One parameter: the turf-page "Rate this turf" flow (and the booking receipt's
rate action) pass `booking_id` when the user comes from a completed booking.
No booking schema/flow change.

## Effect on markup
`seo_rating_markup_enabled` (default OFF) + this view together gate
AggregateRating/Review JSON-LD: emitted only when verified rows exist and the
count meets `reviews_min_count_for_schema`. Note: self-serving review stars
are not shown by Google for LocalBusiness/Organization (verified guidance,
item 9) — markup accuracy is the goal, not star eligibility.
