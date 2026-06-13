import {
  type Booking,
} from "@/data/seed";
import { getSupabase } from "../supabase";
import { USE_MOCK, lsGet, lsSet, LS_BOOKINGS, delay, http, uid } from "./core";
import { getMockTurfs } from "./turfs";

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
    
    const [h, m] = payload.start_time.split(":").map(Number);
    const endH = (h + payload.hours).toString().padStart(2, "0");
    
    const booking: Booking = {
      id: uid("bkg"),
      user_id: userId,
      turf_id: turf.id,
      turf_name: turf.name,
      turf_image: turf.image,
      date: payload.date,
      start_time: payload.start_time,
      end_time: `${endH}:${String(m).padStart(2, "0")}`,
      hours: payload.hours,
      amount: turf.price_per_hour * payload.hours,
      status: "PENDING",
      payment_id: null,
      created_at: new Date().toISOString(),
    };
    
    const { error } = await supabase.from("bookings").insert(booking);
    if (error) throw error;
    return booking;
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

    const [h, m] = payload.start_time.split(":").map(Number);
    const endH = (h + payload.hours).toString().padStart(2, "0");
    const booking: Booking = {
      id: uid("bkg"),
      user_id: user.user_id,
      turf_id: turf.id,
      turf_name: turf.name,
      turf_image: turf.image,
      date: payload.date,
      start_time: payload.start_time,
      end_time: `${endH}:${String(m).padStart(2, "0")}`,
      hours: payload.hours,
      amount: turf.price_per_hour * payload.hours,
      status: "PENDING",
      payment_id: null,
      created_at: new Date().toISOString(),
    };
    setMockBookings([booking, ...getMockBookings()]);
    return booking;
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
    return data as Booking;
  }
  if (USE_MOCK) {
    await delay(800);
    const list = getMockBookings();
    const idx = list.findIndex((b) => b.id === bookingId);
    if (idx < 0) throw new Error("Booking missing");
    list[idx] = { ...list[idx], status: "CONFIRMED", payment_id: uid("pay") };
    setMockBookings(list);
    return list[idx];
  }
  return http<Booking>(`/bookings/${bookingId}/pay-mock`, { method: "POST" });
}

export async function myBookings(userGetter: () => Promise<any>): Promise<Booking[]> {
  const supabase = await getSupabase();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user ? user.id : 'mock_user';
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Booking[];
  }
  if (USE_MOCK) {
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
  }
  if (USE_MOCK) {
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
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Booking;
  }
  if (USE_MOCK) {
    await delay(300);
    const list = getMockBookings();
    const idx = list.findIndex((b) => b.id === id);
    if (idx < 0) throw new Error("Booking not found");
    if (list[idx].status === "CANCELLED") throw new Error("Already cancelled");
    list[idx] = { ...list[idx], status: "CANCELLED" };
    setMockBookings(list);
    return list[idx];
  }
  return http<Booking>(`/bookings/${id}/cancel`, { method: "POST" });
}
