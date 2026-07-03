import {
  type Booking,
} from "@/data/seed";
import { getSupabase } from "../supabase";
import { uid } from "./core";
import { addNotification } from "../notifications";

export async function createBooking(
  payload: { turf_id: string; date: string; start_time: string; hours: number },
  getTurfById: (id: string) => Promise<any>,
  userGetter: () => Promise<any>
): Promise<Booking> {
  const supabase = await getSupabase();
  
  // ── VALIDATION: hours must be 1-12
  if (payload.hours < 1 || payload.hours > 12) {
    throw new Error("Booking duration must be between 1 and 12 hours.");
  }

  // ── VALIDATION: past date check
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (payload.date < todayStr) {
    throw new Error("Booking is not available for past dates. Please select a valid date.");
  }
  
  // ── VALIDATION: same-day expired slot
  if (payload.date === todayStr) {
    const [h, m] = payload.start_time.split(":").map(Number);
    const now = new Date();
    if (now.getHours() > h || (now.getHours() === h && now.getMinutes() > m)) {
      throw new Error("This slot has already expired and cannot be booked.");
    }
  }
  
  // ── VALIDATION: game already ended
  const [slotH, slotM] = payload.start_time.split(":").map(Number);
  const slotDate = new Date(payload.date);
  slotDate.setHours(slotH, slotM, 0, 0);
  const slotEnd = new Date(slotDate.getTime() + payload.hours * 60 * 60 * 1000);
  if (slotEnd < new Date()) {
    throw new Error("This slot has already ended. Please select a future time.");
  }

  const { data: { user } } = await supabase.auth.getUser();
  const u = await userGetter();
  const userId = user ? user.id : (u?.user_id || 'mock_user');
  const turf = await getTurfById(payload.turf_id);
  
  // ── VALIDATION: prevent duplicate active bookings for same slot
  const [startHour] = payload.start_time.split(":").map(Number);
  for (let i = 0; i < payload.hours; i++) {
    const checkHour = String(startHour + i).padStart(2, "0");
    const checkTime = `${checkHour}:${String(slotM).padStart(2, "0")}`;
    const { data: existing, error: dupErr } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", userId)
      .eq("turf_id", turf.id)
      .eq("date", payload.date)
      .eq("start_time", checkTime)
      .neq("status", "cancelled")
      .maybeSingle();
    if (dupErr) console.warn("Duplicate check query error:", dupErr);
    if (existing) {
      throw new Error("You already have an active booking for this slot.");
    }
  }
  
  const bookingsToInsert: Booking[] = [];
  const mainBookingId = uid("bkg");
  const [h, m] = payload.start_time.split(":").map(Number);
  
  for (let i = 0; i < payload.hours; i++) {
    const slotHour = (h + i).toString().padStart(2, "0");
    const slotTime = `${slotHour}:${String(m).padStart(2, "0")}`;
    const endHour = (h + i + 1).toString().padStart(2, "0");
    
    bookingsToInsert.push({
      id: i === 0 ? mainBookingId : uid("bkg"),
      user_id: userId,
      turf_id: turf.id,
      turf_name: turf.name,
      turf_image: turf.image,
      date: payload.date,
      start_time: slotTime,
      end_time: `${endHour}:${String(m).padStart(2, "0")}`,
      hours: 1,
      amount: i === 0 ? turf.price_per_hour * payload.hours : 0,
      status: "pending",
      payment_id: i === 0 ? null : `parent_${mainBookingId}`,
      created_at: new Date().toISOString(),
    });
  }
  
  const { error } = await supabase.from("bookings").insert(bookingsToInsert);
  if (error) {
    const msg = error.message || "";
    if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique_active_booking")) {
      throw new Error("This slot has already been booked.");
    }
    throw error;
  }
  return bookingsToInsert[0];
}

export async function bookedSlots(turfId: string, date: string): Promise<string[]> {
  const supabase = await getSupabase();
  // Schema stores status in LOWERCASE ('pending', 'confirmed', 'cancelled', 'completed').
  // Exclude cancelled/completed so released slots show as available.
  // Also drop abandoned pending bookings (>15 min old) so they don't block the UI.
  const { data, error } = await supabase
    .from("booking_availability")
    .select("start_time, hours, status, created_at")
    .eq("turf_id", turfId)
    .eq("date", date)
    .neq("status", "cancelled")
    .neq("status", "completed");
  if (error) throw error;

  const staleAfter = Date.now() - 15 * 60 * 1000;
  const covered: string[] = [];
  (data || []).forEach((b: any) => {
    // Skip abandoned pending bookings so the UI doesn't grey them out
    if (
      b.status === "pending" &&
      b.created_at &&
      new Date(b.created_at).getTime() < staleAfter
    ) {
      return;
    }
    const [h, m] = b.start_time.split(":").map(Number);
    const slotHours = Number(b.hours) || 1;
    for (let i = 0; i < slotHours; i++) {
      const slotHour = (h + i).toString().padStart(2, "0");
      covered.push(`${slotHour}:${String(m).padStart(2, "0")}`);
    }
  });
  return covered;
}

export async function payMock(bookingId: string): Promise<Booking> {
  const supabase = await getSupabase();
  
  const { data: currentBooking, error: fetchError } = await supabase
    .from("bookings")
    .select("status, turf_name, date")
    .eq("id", bookingId)
    .single();
    
  if (fetchError) throw fetchError;
  if (currentBooking.status === "confirmed") {
    throw new Error("This booking has already been paid for.");
  }

  const paymentId = uid("pay");
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "confirmed", payment_id: paymentId })
    .eq("id", bookingId)
    .select()
    .single();
  if (error) throw error;

  // Update secondary bookings
  await supabase
    .from("bookings")
    .update({ status: "confirmed", payment_id: paymentId })
    .eq("payment_id", `parent_${bookingId}`);

  addNotification({
    type: "booking_confirmed",
    title: "Booking Confirmed! 🎉",
    body: `Your booking for ${data.turf_name} on ${data.date} is confirmed!`,
    booking_id: bookingId,
  });

  return data as Booking;
}

export async function myBookings(userGetter: () => Promise<any>): Promise<Booking[]> {
  const u = await userGetter();
  if (!u) return [];

  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user ? user.id : u.user_id;
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Booking[];
}

export async function upcomingBookings(userGetter: () => Promise<any>): Promise<Booking[]> {
  const u = await userGetter();
  if (!u) return [];

  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user ? user.id : u.user_id;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("date", today)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data || []) as Booking[];
}

export async function getBooking(id: string): Promise<Booking> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Booking not found");
  return data as Booking;
}

export async function cancelBooking(id: string): Promise<Booking> {
  const supabase = await getSupabase();
  
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("created_at, status, payment_id, turf_name, date")
    .eq("id", id)
    .single();
    
  if (fetchErr) throw fetchErr;
  if (booking.status === "confirmed" && booking.payment_id) {
    const createdAtTime = new Date(booking.created_at).getTime();
    if (Date.now() - createdAtTime > 15 * 60 * 1000) {
      throw new Error("This booking has been confirmed and can no longer be cancelled.");
    }
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  
  if (data.payment_id) {
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("payment_id", data.payment_id);
  }
  
  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("payment_id", `parent_${id}`);

  addNotification({
    type: "booking_cancelled",
    title: "Booking Cancelled ❌",
    body: `Your booking for ${data.turf_name} on ${data.date} has been cancelled.`,
    booking_id: id,
  });
    
  return data as Booking;
}
