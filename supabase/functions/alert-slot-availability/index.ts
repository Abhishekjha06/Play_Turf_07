// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs

import { withSupabase } from "@supabase/server";

type Row = Record<string, any>;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status });

const norm = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

function timeMinutes(value: unknown): number | null {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeKey(value: unknown): string {
  const minutes = timeMinutes(value);
  if (minutes === null) return "";
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function bookingSlots(booking: Row): string[] {
  const start = timeMinutes(booking.start_time);
  if (start === null) return [];

  let end = timeMinutes(booking.end_time);

  if (end !== null && end < start) end += 24 * 60;

  if (end === null || end === start) {
    const hours = Number(booking.hours);
    end = start + (Number.isFinite(hours) && hours > 0 ? hours : 1) * 60;
  }

  const slots: string[] = [];
  for (let minute = start; minute < end; minute += 60) {
    slots.push(
      `${String(Math.floor((minute % 1440) / 60)).padStart(2, "0")}:${String((minute % 60)).padStart(2, "0")}`
    );
  }
  return slots;
}

function blocksSlot(booking: Row): boolean {
  return ![
    "cancelled",
    "canceled",
    "rejected",
    "failed",
    "expired",
    "payment_failed",
    "refunded",
  ].includes(norm(booking.status));
}

function bookingSport(
  booking: Row,
  pitchById: Map<string, Row>
): string {
  // Use the sport saved directly in the bookings table.
  const savedSport = norm(booking.sport);

  if (savedSport) {
    return savedSport;
  }

  // Fallback for older bookings where sport is NULL.
  const pitch = pitchById.get(
    String(booking.pitch_id ?? "")
  );

  return norm(pitch?.sports);
}

function isFullyBooked(
  rows: Row[],
  sport: string,
  slot: string,
  sportPitches: Row[],
  hasAnyPitches: boolean,
  pitchById: Map<string, Row>
): boolean {
  const relevantBookings = rows.filter(
    (booking) =>
      blocksSlot(booking) &&
      bookingSport(booking, pitchById) === sport &&
      bookingSlots(booking).includes(slot)
  );

  // A turf without pitch records has a single shared slot capacity.
  if (!hasAnyPitches) return relevantBookings.length > 0;

  // This turf has pitches, but none for this sport.
  if (sportPitches.length === 0) return false;

  const occupied = new Set(
    relevantBookings
      .map((booking) => booking.pitch_id)
      .filter((id) => id !== null && id !== undefined)
      .map(String)
  );

  // The slot is fully booked only when every pitch for this sport is occupied.
  return sportPitches.every((pitch) => occupied.has(String(pitch.pitch_id)));
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return json({ error: "POST required" }, 405);
    }

    let payload: Row;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Invalid JSON payload" }, 400);
    }

    if (
      payload.type !== "UPDATE" ||
      payload.schema !== "public" ||
      payload.table !== "bookings"
    ) {
      return json({ ok: true, ignored: "Not a bookings UPDATE event" });
    }

    const oldBooking = payload.old_record as Row | null;
    const newBooking = payload.record as Row | null;

    if (!oldBooking || !newBooking) {
      return json({ error: "Missing old_record or record" }, 400);
    }

    // Run the detector only when a booking becomes cancelled.
    if (
      norm(oldBooking.status) === "cancelled" ||
      norm(newBooking.status) !== "cancelled"
    ) {
      return json({ ok: true, ignored: "Not a new cancellation" });
    }

    const affectedSlots = [...new Set(bookingSlots(oldBooking))];

    if (affectedSlots.length === 0) {
      console.warn("[slot-alert] Could not determine the cancelled booking's slots");
      return json({ ok: true, detected: 0, reason: "No affected slots" });
    }

    const db = ctx.supabaseAdmin;

    // bookings.turf_id is the app-facing turf ID.
    // slot_reminders and pitches use turfs.new_id.
    const { data: turf, error: turfError } = await db
      .from("turfs")
      .select("id, new_id, name")
      .eq("id", newBooking.turf_id)
      .maybeSingle();

    if (turfError || !turf) {
      console.error("[slot-alert] Turf lookup failed", turfError);
      return json({ error: "Could not map booking to turf" }, 500);
    }

    const { data: reminders, error: reminderError } = await db
      .from("slot_reminders")
      .select("id, turf_id, sport, reminder_date, start_time, status")
      .eq("turf_id", turf.new_id)
      .eq("reminder_date", oldBooking.date)
      .eq("status", "active");

    if (reminderError) {
      console.error("[slot-alert] Reminder lookup failed", reminderError);
      return json({ error: "Could not load active reminders" }, 500);
    }

    const candidates = (reminders ?? []).filter((reminder: Row) =>
      affectedSlots.includes(timeKey(reminder.start_time))
    );

    if (candidates.length === 0) {
      console.log("[slot-alert] No active reminders for affected slots", {
        turf_id: turf.new_id,
        date: oldBooking.date,
        affectedSlots,
      });

      return json({ ok: true, checked: 0, detected: 0 });
    }

    const [pitchResult, bookingResult] = await Promise.all([
      db
        .from("pitches")
        .select("pitch_id, turf_id, sports")
        .eq("turf_id", turf.new_id),

      db
        .from("bookings")
        .select(
          "id, turf_id, pitch_id, sport, date, start_time, end_time, hours, status"
        )
        .eq("turf_id", newBooking.turf_id)
        .eq("date", oldBooking.date),
    ]);

    if (pitchResult.error || bookingResult.error) {
      console.error("[slot-alert] Availability query failed", {
        pitches: pitchResult.error,
        bookings: bookingResult.error,
      });

      return json({ error: "Could not load availability data" }, 500);
    }

    const pitches: Row[] = pitchResult.data ?? [];
    const bookings: Row[] = bookingResult.data ?? [];

    const pitchById = new Map<string, Row>(
        pitches.map(
          (pitch): [string, Row] => [
            String(pitch.pitch_id),
            pitch,
          ]
        )
      );

    // Reconstruct the state before and after this particular cancellation.
    const otherBookings = bookings.filter(
      (booking) => String(booking.id) !== String(newBooking.id)
    );

    const bookingsBefore = [...otherBookings, oldBooking];
    const bookingsAfter = [...otherBookings, newBooking];

    const detected: Row[] = [];

    for (const reminder of candidates as Row[]) {
      const sport = norm(reminder.sport);
      const slot = timeKey(reminder.start_time);

      if (!sport || !slot) continue;

      const sportPitches = pitches.filter(
        (pitch) => norm(pitch.sports) === sport
      );

      if (pitches.length > 0 && sportPitches.length === 0) {
        console.log("[slot-alert] No pitches found for reminder sport", {
          sport,
          slot,
        });
        continue;
      }

      const wasFullyBooked = isFullyBooked(
        bookingsBefore,
        sport,
        slot,
        sportPitches,
        pitches.length > 0,
        pitchById
      );

      const isFullyBookedNow = isFullyBooked(
        bookingsAfter,
        sport,
        slot,
        sportPitches,
        pitches.length > 0,
        pitchById
      );

      console.log("[slot-alert] Availability check", {
        reminder_id: reminder.id,
        turf_id: turf.new_id,
        sport: reminder.sport,
        date: reminder.reminder_date,
        slot,
        pitch_count: sportPitches.length,
        wasFullyBooked,
        isFullyBookedNow,
      });

      // Detect only FULL -> AVAILABLE transitions.
      if (wasFullyBooked && !isFullyBookedNow) {
        const match = {
          reminder_id: reminder.id,
          turf_id: turf.new_id,
          sport: reminder.sport,
          date: reminder.reminder_date,
          slot,
        };

        detected.push(match);
        console.log("[slot-alert] MATCH", JSON.stringify(match));
      }
    }

    // Detector-only phase: deliberately no push, WhatsApp, or DB writes.
    return json({
      ok: true,
      checked: candidates.length,
      detected: detected.length,
      matches: detected,
    });
  }),
};


/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/alert-slot-availability' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/
