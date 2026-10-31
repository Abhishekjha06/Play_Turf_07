import {
  type Booking,
} from "@/data/seed";

import { getSupabase } from "../supabase";
import { uid } from "./core";
import { addNotification } from "../notifications";



/* =========================================================
   CREATE BOOKING
   ========================================================= */

export async function createBooking(
  payload: {
    turf_id: string;
    date: string;
    start_time: string;
    hours: number;
    pitch_id?: number;
    sport?: string;

  },
  getTurfById: (id: string) => Promise<any>,
  userGetter: () => Promise<any>
): Promise<Booking> {

  const supabase = await getSupabase();

  /* ---------------- VALIDATION ---------------- */

  if (payload.hours < 1 || payload.hours > 12) {
    throw new Error(
      "Booking duration must be between 1 and 12 hours."
    );
  }

  const todayStr = new Date().toLocaleDateString("en-CA");

  if (payload.date < todayStr) {
    throw new Error(
      "Booking is not available for past dates. Please select a valid date."
    );
  }

  /* Same-day expired slot */

  if (payload.date === todayStr) {
    const [h, m] = payload.start_time
      .split(":")
      .map(Number);

    const now = new Date();

    if (
      now.getHours() > h ||
      (now.getHours() === h &&
        now.getMinutes() > m)
    ) {
      throw new Error(
        "This slot has already expired and cannot be booked."
      );
    }
  }

  /* Check booking end time */

  const [slotH, slotM] = payload.start_time
    .split(":")
    .map(Number);

  const slotDate = new Date(payload.date);

  slotDate.setHours(
    slotH,
    slotM,
    0,
    0
  );

  const slotEnd = new Date(
    slotDate.getTime() +
      payload.hours *
        60 *
        60 *
        1000
  );

  if (slotEnd < new Date()) {
    throw new Error(
      "This slot has already ended. Please select a future time."
    );
  }

  /* ---------------- USER ---------------- */

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const u = await userGetter();

  const userId =
    user?.id ||
    u?.user_id ||
    "mock_user";

  /* ---------------- TURF ---------------- */

  const turf = await getTurfById(
    payload.turf_id
  );

  if (!turf) {
    throw new Error("Turf not found.");
  }

  /* =====================================================
     CHECK WHETHER SELECTED PITCH IS ALREADY BOOKED
     ===================================================== */

  for (let i = 0; i < payload.hours; i++) {

    const checkHour =
      String(slotH + i).padStart(2, "0");

    const checkTime =
      `${checkHour}:${String(slotM).padStart(2, "0")}`;

    let query = supabase
      .from("bookings")
      .select("id")
      .eq("turf_id", turf.id)
      .eq("date", payload.date)
      .eq("start_time", checkTime)
      .neq("status", "cancelled");

    /*
      IMPORTANT:

      If a pitch/court was selected, only that
      pitch should block the booking.

      This allows:

      Court 1 → booked
      Court 2 → available
      Court 3 → available
    */

    if (payload.pitch_id != null) {
      query = query.eq(
        "pitch_id",
        payload.pitch_id
      );
    }

    const {
      data: existingSlot,
      error: slotError,
    } = await query.maybeSingle();

    if (slotError) {
      console.warn(
        "Pitch availability check error:",
        slotError
      );
    }

    if (existingSlot) {
      throw new Error(
        "This court is already booked for the selected slot."
      );
    }
  }

  /* =====================================================
     CHECK USER DUPLICATE BOOKING
     ===================================================== */

  for (let i = 0; i < payload.hours; i++) {

    const checkHour =
      String(slotH + i).padStart(2, "0");

    const checkTime =
      `${checkHour}:${String(slotM).padStart(2, "0")}`;

    let query = supabase
      .from("bookings")
      .select("id")
      .eq("user_id", userId)
      .eq("turf_id", turf.id)
      .eq("date", payload.date)
      .eq("start_time", checkTime)
      .neq("status", "cancelled");

    /*
      Same user can theoretically book another
      court at the same turf.

      Therefore pitch_id is included when supplied.
    */

    if (payload.pitch_id != null) {
      query = query.eq(
        "pitch_id",
        payload.pitch_id
      );
    }

    const {
      data: existingUserBooking,
      error: duplicateError,
    } = await query.maybeSingle();

    if (duplicateError) {
      console.warn(
        "Duplicate booking check error:",
        duplicateError
      );
    }

    if (existingUserBooking) {
      throw new Error(
        "You already have an active booking for this court and slot."
      );
    }
  }

  /* =====================================================
     CREATE BOOKING ROWS
     ===================================================== */

  const bookingsToInsert: Booking[] = [];

  const mainBookingId = uid("bkg");

  const [h, m] = payload.start_time
    .split(":")
    .map(Number);

  for (let i = 0; i < payload.hours; i++) {

    const slotHour =
      (h + i)
        .toString()
        .padStart(2, "0");

    const slotTime =
      `${slotHour}:${String(m).padStart(2, "0")}`;

    const endHour =
      (h + i + 1)
        .toString()
        .padStart(2, "0");

    bookingsToInsert.push({
      id:
        i === 0
          ? mainBookingId
          : uid("bkg"),

      user_id: userId,

      turf_id: turf.id,

      turf_name: turf.name,

      turf_image: turf.image,

      date: payload.date,

      start_time: slotTime,

      end_time:
        `${endHour}:${String(m).padStart(2, "0")}`,

      hours: 1,

      amount:
        i === 0
          ? turf.price_per_hour *
            payload.hours
          : 0,

      status: "pending",

      payment_id:
        i === 0
          ? null
          : `parent_${mainBookingId}`,

      created_at:
        new Date().toISOString(),

      /*
        Selected court/pitch
      */
      pitch_id:
        payload.pitch_id,
      sport:
        payload.sport,
    } as Booking);
  }

  /* ---------------- INSERT ---------------- */

  const {
    error,
  } = await supabase
    .from("bookings")
    .insert(bookingsToInsert);

  if (error) {

    const msg =
      error.message || "";

    if (
      msg
        .toLowerCase()
        .includes("duplicate") ||
      msg
        .toLowerCase()
        .includes(
          "unique_active_booking"
        )
    ) {
      throw new Error(
        "This court has already been booked."
      );
    }

    throw error;
  }

  return bookingsToInsert[0];
}


/* =========================================================
   GET PITCHES / COURTS
   ========================================================= */

export async function getPitches(
  turfId: string,
  sport: string
): Promise<any[]> {

  const supabase =
    await getSupabase();

  const {
    data,
    error,
  } = await supabase
    .from("pitches")
    .select("*")
    .eq("turf_id", turfId)
    .eq("sports", sport);

  if (error) {
    console.error(
      "getPitches error:",
      error
    );

    throw error;
  }

  return data || [];
}


/* =========================================================
   GET COURT AVAILABILITY
   ========================================================= */
export async function getCourtAvailability(
  turfDbId: number,
  date: string,
  sport: string
) {
  const supabase = await getSupabase();

  if (!supabase) {
    return {
      pitches: [],
      bookings: [],
    };
  }

  // Get all pitches belonging to this turf + sport
  const { data: pitches, error: pitchError } = await supabase
    .from("pitches")
    .select("*")
    .eq("turf_id", turfDbId)
    .eq("sports", sport);

  if (pitchError) {
    throw pitchError;
  }

  // Get the application's turf ID
  const { data: turf, error: turfError } = await supabase
    .from("turfs")
    .select("id")
    .eq("new_id", turfDbId)
    .single();

  if (turfError) {
    throw turfError;
  }

  if (!turf) {
    return {
      pitches: pitches || [],
      bookings: [],
    };
  }

  // Get bookings for this turf/date
  const { data: bookings, error: bookingError } = await supabase
    .from("booking_availability")
    .select(
      "pitch_id,start_time,hours,status"
    )
    .eq("turf_id", turf.id)
    .eq("date", date)
    .neq("status", "CANCELLED");

  if (bookingError) {
    throw bookingError;
  }

  return {
    pitches: pitches || [],
    bookings: bookings || [],
  };
}

/* =========================================================
   BOOKED SLOTS
   ========================================================= */

export async function bookedSlots(
  turfId: string,
  date: string,
  pitchId?: number
): Promise<string[]> {
  const supabase = await getSupabase();

  let query = supabase
    .from("booking_availability")
    .select("start_time, hours, status, created_at, pitch_id")
    .eq("turf_id", turfId)
    .eq("date", date)
    .neq("status", "cancelled")
    .neq("status", "completed");

  if (pitchId) {
    query = query.eq("pitch_id", pitchId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const staleAfter = Date.now() - 15 * 60 * 1000;
  const covered: string[] = [];

  (data || []).forEach((b: any) => {
    if (
      b.status === "pending" &&
      b.created_at &&
      new Date(b.created_at).getTime() < staleAfter
    ) {
      return;
    }

    const [h, m] = b.start_time.split(":").map(Number);
    const hours = Number(b.hours) || 1;

    for (let i = 0; i < hours; i++) {
      covered.push(
        `${String(h + i).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      );
    }
  });

  return covered;
}


/* =========================================================
   MOCK PAYMENT
   ========================================================= */

export async function payMock(
  bookingId: string
): Promise<Booking> {

  const supabase =
    await getSupabase();

  const {
    data: currentBooking,
    error: fetchError,
  } = await supabase
    .from("bookings")
    .select(
      "status,turf_name,date"
    )
    .eq("id", bookingId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (
    currentBooking.status ===
    "confirmed"
  ) {
    throw new Error(
      "This booking has already been paid for."
    );
  }

  const paymentId =
    uid("pay");

  const {
    data,
    error,
  } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      payment_id: paymentId,
    })
    .eq("id", bookingId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  /* Update secondary booking rows */

  await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      payment_id: paymentId,
    })
    .eq(
      "payment_id",
      `parent_${bookingId}`
    );

  addNotification({
    type: "booking_confirmed",

    title:
      "Booking Confirmed! 🎉",

    body:
      `Your booking for ${data.turf_name} on ${data.date} is confirmed!`,

    booking_id: bookingId,
  });

  return data as Booking;
}


/* =========================================================
   MY BOOKINGS
   ========================================================= */

export async function myBookings(
  userGetter: () => Promise<any>
): Promise<Booking[]> {

  const u =
    await userGetter();

  if (!u) {
    return [];
  }

  const supabase =
    await getSupabase();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  const userId =
    user?.id ||
    u.user_id;

  const {
    data,
    error,
  } =
    await supabase
      .from("bookings")
      .select("*")
      .eq(
        "user_id",
        userId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (error) {
    throw error;
  }

  return (data || []) as Booking[];
}


/* =========================================================
   UPCOMING BOOKINGS
   ========================================================= */

export async function upcomingBookings(
  userGetter: () => Promise<any>
): Promise<Booking[]> {

  const u =
    await userGetter();

  if (!u) {
    return [];
  }

  const supabase =
    await getSupabase();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  const userId =
    user?.id ||
    u.user_id;

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const {
    data,
    error,
  } =
    await supabase
      .from("bookings")
      .select("*")
      .eq(
        "user_id",
        userId
      )
      .eq(
        "status",
        "confirmed"
      )
      .gte(
        "date",
        today
      )
      .order(
        "date",
        {
          ascending: true,
        }
      );

  if (error) {
    throw error;
  }

  return (data || []) as Booking[];
}


/* =========================================================
   GET BOOKING
   ========================================================= */

export async function getBooking(
  id: string
): Promise<Booking> {

  const supabase =
    await getSupabase();

  const {
    data,
    error,
  } =
    await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "Booking not found"
    );
  }

  return data as Booking;
}


/* =========================================================
   CANCEL BOOKING
   ========================================================= */

export async function cancelBooking(
  id: string
): Promise<Booking> {

  const supabase =
    await getSupabase();

  const {
    data: booking,
    error: fetchErr,
  } =
    await supabase
      .from("bookings")
      .select(
        "created_at,status,payment_id,turf_name,date"
      )
      .eq("id", id)
      .single();

  if (fetchErr) {
    throw fetchErr;
  }

  if (
    booking.status === "confirmed" &&
    booking.payment_id
  ) {

    const createdAtTime =
      new Date(
        booking.created_at
      ).getTime();

    if (
      Date.now() -
        createdAtTime >
      15 * 60 * 1000
    ) {
      throw new Error(
        "This booking has been confirmed and can no longer be cancelled."
      );
    }
  }

  const {
    data,
    error,
  } =
    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
      })
      .eq("id", id)
      .select()
      .single();

  if (error) {
    throw error;
  }

  /* Cancel secondary rows */

  if (data.payment_id) {

    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
      })
      .eq(
        "payment_id",
        data.payment_id
      );
  }

  await supabase
    .from("bookings")
    .update({
      status: "cancelled",
    })
    .eq(
      "payment_id",
      `parent_${id}`
    );

  addNotification({
    type: "booking_cancelled",

    title:
      "Booking Cancelled ❌",

    body:
      `Your booking for ${data.turf_name} on ${data.date} has been cancelled.`,

    booking_id: id,
  });

  return data as Booking;
}