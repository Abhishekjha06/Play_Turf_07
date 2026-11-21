# Proposal: verified reviews for rating markup

Owner round-3 item 3 — **proposal only, awaiting approval. Nothing implemented;
booking tables and flows untouched.**

## Current state
- `reviews` rows are self-reported (client-side insert, `mock_user` fallback).
- Rating markup is hard-gated OFF (`seo_rating_markup_enabled`, default OFF) —
  even genuine rows produce no AggregateRating until this proposal ships AND
  the flag is turned on.

## Minimal change (one migration + one API touch)
1. Migration: `ALTER TABLE reviews ADD COLUMN booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;`
   + `ALTER TABLE reviews ADD COLUMN verified boolean NOT NULL DEFAULT false;`
   (reversible; no booking-table change).
2. Booking flow (single touch, NOT part of this engine): after a booking is
   marked COMPLETED, the receipt's "Rate this turf" action passes its
   `booking_id` when creating the review. Reviews with a completed-booking
   `booking_id` get `verified = true` (computed, not stored — a VIEW or a
   check at read time keeps it tamper-proof).
3. Worker/markup: aggregate counts **only `verified` rows**; the flag can then
   be enabled per environment.

## Explicitly out of scope
- No changes to bookings schema, payment flow, or auth.
- No retroactive verification of existing rows (they stay unverified forever
  unless the owner runs a one-off mapping).

Decision needed: approve (a) the migration and (b) the single receipt touch —
then Phase 5 flips the flag.
