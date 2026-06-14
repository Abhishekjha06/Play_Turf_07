import {
  type Booking,
} from "@/data/seed";
import { getSupabase } from "../supabase";
import { USE_MOCK, lsGet, lsSet, LS_BOOKINGS, delay, http, uid } from "./core";
import { getMockTurfs } from "./turfs";
import { addNotification } from "../notifications";


export function getMockBookings(): Booking[] { return lsGet<Booking[]>(LS_BOOKINGS, []); }
export function setMockBookings(v: Booking[]) { lsSet(LS_BOOKINGS, v); }

export async function createBooking(payload: {
  turf_id: string; date: string; start_time: string; hours: number;
}, getTurfById: (id: string) => Promise<any>, userGetter: () => Promise<any>): Promise<Booking> {
  const supabase = await getSupabase();
  
  // Validation for both mock and real modes
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (payload.date === todayStr) {
    const [h, m] = payload.start_time.split(":").map(Number);
    const now = new Date();
    if (now.getHours() > h || (now.getHours() === h && now.getMinutes() > m)) {
      throw new Error("This slot has already expired and cannot be booked.");
    }
  }

  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user ? user.id : 'mock_user';
    const turf = await getTurfById(payload.turf_id);
    
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
        status: "PENDING",
        payment_id: i === 0 ? null : `parent_${mainBookingId}`,
        created_at: new Date().toISOString(),
      });
    }
    
    const { error } = await supabase.from("bookings").insert(bookingsToInsert);
    if (error) throw error;
    return bookingsToInsert[0];
  }
  if (USE_MOCK) {
    await delay(200);
    const user = await userGetter();
    if (!user) throw new Error("Not signed in");
    const turf = getMockTurfs().find((t) => t.id === payload.turf_id);
    if (!turf) throw new Error("Turf missing");

    // Overlap validation for mock mode
    const [newH, newM] = payload.start_time.split(":").map(Number);
    const newStartMins = newH * 60 + newM;
    const newEndMins = newStartMins + payload.hours * 60;
    
    const isOverlap = getMockBookings().some((b) => {
      if (b.turf_id !== payload.turf_id || b.date !== payload.date || b.status === "CANCELLED") {
        return false;
      }
      const [bh, bm] = b.start_time.split(":").map(Number);
      const bStartMins = bh * 60 + bm;
      const bEndMins = bStartMins + b.hours * 60;
      return (newStartMins < bEndMins && newEndMins > bStartMins);
    });

    if (isOverlap) {
      throw new Error("One or more slots in this time range are already booked.");
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
        user_id: user.user_id,
        turf_id: turf.id,
        turf_name: turf.name,
        turf_image: turf.image,
        date: payload.date,
        start_time: slotTime,
        end_time: `${endHour}:${String(m).padStart(2, "0")}`,
        hours: 1,
        amount: i === 0 ? turf.price_per_hour * payload.hours : 0,
        status: "PENDING",
        payment_id: i === 0 ? null : `parent_${mainBookingId}`,
        created_at: new Date().toISOString(),
      });
    }
    
    setMockBookings([...bookingsToInsert, ...getMockBookings()]);
    return bookingsToInsert[0];
  }
  return http<Booking>("/bookings", { method: "POST", body: JSON.stringify(payload) });
}

export async function bookedSlots(turfId: string, date: string): Promise<string[]> {
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("bookings")
      .select("start_time, hours")
      .eq("turf_id", turfId)
      .eq("date", date)
      .neq("status", "CANCELLED");
    if (error) throw error;
    
    const covered: string[] = [];
    (data || []).forEach((b: any) => {
      const [h, m] = b.start_time.split(":").map(Number);
      for (let i = 0; i < b.hours; i++) {
        const slotHour = (h + i).toString().padStart(2, "0");
        covered.push(`${slotHour}:${String(m).padStart(2, "0")}`);
      }
    });
    return covered;
  }
  if (USE_MOCK) {
    await delay(80);
    const covered: string[] = [];
    getMockBookings()
      .filter((booking) => booking.turf_id === turfId && booking.date === date && booking.status !== "CANCELLED")
      .forEach((b) => {
        const [h, m] = b.start_time.split(":").map(Number);
        for (let i = 0; i < b.hours; i++) {
          const slotHour = (h + i).toString().padStart(2, "0");
          covered.push(`${slotHour}:${String(m).padStart(2, "0")}`);
        }
      });
    return covered;
  }
  return http<string[]>(`/turfs/${turfId}/booked-slots?date=${encodeURIComponent(date)}`);
}

export async function payMock(bookingId: string): Promise<Booking> {
  const supabase = await getSupabase();
  if (supabase) {
    // Audit: Prevent duplicate payments
    const { data: currentBooking, error: fetchError } = await supabase
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .single();
      
    if (fetchError) throw fetchError;
    if (currentBooking.status === "CONFIRMED") {
      throw new Error("This booking has already been paid for.");
    }

    const paymentId = uid("pay");
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "CONFIRMED", payment_id: paymentId })
      .eq("id", bookingId)
      .select()
      .single();
    if (error) throw error;

    // Update secondary bookings
    await supabase
      .from("bookings")
      .update({ status: "CONFIRMED", payment_id: paymentId })
      .eq("payment_id", `parent_${bookingId}`);

    addNotification({
      type: "booking_confirmed",
      title: "Booking Confirmed! 🎉",
      body: `Your booking for ${data.turf_name} on ${data.date} is confirmed!`,
      booking_id: bookingId,
    });

    return data as Booking;
  }
  if (USE_MOCK) {
    await delay(800);
    const list = getMockBookings();
    const idx = list.findIndex((b) => b.id === bookingId);
    if (idx < 0) throw new Error("Booking missing");
    
    const paymentId = uid("pay");
    list[idx] = { ...list[idx], status: "CONFIRMED", payment_id: paymentId };
    
    // Update secondary bookings in mock list
    for (let i = 0; i < list.length; i++) {
      if (list[i].payment_id === `parent_${bookingId}`) {
        list[i] = { ...list[i], status: "CONFIRMED", payment_id: paymentId };
      }
    }
    
    setMockBookings(list);

    addNotification({
      type: "booking_confirmed",
      title: "Booking Confirmed! 🎉",
      body: `Your booking for ${list[idx].turf_name} on ${list[idx].date} is confirmed!`,
      booking_id: bookingId,
    });

    return list[idx];
  }
  return http<Booking>(`/bookings/${bookingId}/pay-mock`, { method: "POST" });
}

export async function myBookings(userGetter: () => Promise<any>): Promise<Booking[]> {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user ? user.id : 'mock_user';
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Booking[];
    } catch (err) {
      console.warn("Failed to query myBookings from Supabase:", err);
    }
  }
  if (USE_MOCK || supabase) {
    await delay(120);
    const u = await userGetter();
    if (!u) return [];
    return getMockBookings().filter((b) => b.user_id === u.user_id);
  }
  return http<Booking[]>("/bookings/me");
}

export async function upcomingBookings(userGetter: () => Promise<any>): Promise<Booking[]> {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user ? user.id : 'mock_user';
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "CONFIRMED")
        .gte("date", today)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as Booking[];
    } catch (err) {
      console.warn("Failed to query upcomingBookings from Supabase:", err);
    }
  }
  if (USE_MOCK || supabase) {
    await delay(100);
    const u = await userGetter();
    if (!u) return [];
    const today = new Date().toISOString().slice(0, 10);
    return getMockBookings().filter(
      (b) => b.user_id === u.user_id && b.status === "CONFIRMED" && b.date >= today
    );
  }
  return http<Booking[]>("/bookings/upcoming");
}

export async function getBooking(id: string): Promise<Booking> {
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Booking;
  }
  if (USE_MOCK) {
    await delay(100);
    const b = getMockBookings().find((b) => b.id === id);
    if (!b) throw new Error("Booking not found");
    return b;
  }
  return http<Booking>(`/bookings/${id}`);
}

export async function cancelBooking(id: string): Promise<Booking> {
  const supabase = await getSupabase();
  if (supabase) {
    // Check 15-min cancellation deadline
    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("created_at, status, payment_id")
      .eq("id", id)
      .single();
      
    if (fetchErr) throw fetchErr;
    if (booking.status === "CONFIRMED" && booking.payment_id) {
      const createdAtTime = new Date(booking.created_at).getTime();
      if (Date.now() - createdAtTime > 15 * 60 * 1000) {
        throw new Error("This booking has been confirmed and can no longer be cancelled.");
      }
    }

    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    
    if (data.payment_id) {
      await supabase
        .from("bookings")
        .update({ status: "CANCELLED" })
        .eq("payment_id", data.payment_id);
    }
    
    await supabase
      .from("bookings")
      .update({ status: "CANCELLED" })
      .eq("payment_id", `parent_${id}`);

    addNotification({
      type: "booking_cancelled",
      title: "Booking Cancelled ❌",
      body: `Your booking for ${data.turf_name} on ${data.date} has been cancelled.`,
      booking_id: id,
    });
      
    return data as Booking;
  }
  if (USE_MOCK) {
    await delay(300);
    const list = getMockBookings();
    const idx = list.findIndex((b) => b.id === id);
    if (idx < 0) throw new Error("Booking not found");
    if (list[idx].status === "CANCELLED") throw new Error("Already cancelled");
    
    if (list[idx].status === "CONFIRMED" && list[idx].payment_id) {
      const createdAtTime = new Date(list[idx].created_at).getTime();
      if (Date.now() - createdAtTime > 15 * 60 * 1000) {
        throw new Error("This booking has been confirmed and can no longer be cancelled.");
      }
    }

    const targetPaymentId = list[idx].payment_id;
    list[idx] = { ...list[idx], status: "CANCELLED" };
    
    for (let i = 0; i < list.length; i++) {
      if (
        (targetPaymentId && list[i].payment_id === targetPaymentId) ||
        list[i].payment_id === `parent_${id}`
      ) {
        list[i] = { ...list[i], status: "CANCELLED" };
      }
    }
    
    setMockBookings(list);

    addNotification({
      type: "booking_cancelled",
      title: "Booking Cancelled ❌",
      body: `Your booking for ${list[idx].turf_name} on ${list[idx].date} has been cancelled.`,
      booking_id: id,
    });
    
    return list[idx];
  }
  return http<Booking>(`/bookings/${id}/cancel`, { method: "POST" });
}
