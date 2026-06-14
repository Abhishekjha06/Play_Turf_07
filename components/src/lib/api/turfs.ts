import {
  turfs as seedTurfs,
  type Turf,
  type Review,
} from "@/data/seed";
import { getSupabase } from "../supabase";
import { USE_MOCK, lsGet, lsSet, LS_TURFS, LS_FAVORITES, LS_REVIEWS, delay, http, uid, uid as makeUid } from "./core";

export function getMockTurfs(): Turf[] {
  const current = lsGet<Turf[]>(LS_TURFS, []);
  if (current.length === 0 || !current.some(t => t.city === "Virar")) {
    lsSet(LS_TURFS, seedTurfs);
    return seedTurfs;
  }
  return current;
}
export function setMockTurfs(v: Turf[]) { lsSet(LS_TURFS, v); }
export function getMockFavorites(): string[] { return lsGet<string[]>(LS_FAVORITES, []); }
export function setMockFavorites(v: string[]) { lsSet(LS_FAVORITES, v); }
export function getMockReviews(): Review[] { return lsGet<Review[]>(LS_REVIEWS, []); }
export function setMockReviews(v: Review[]) { lsSet(LS_REVIEWS, v); }

export function distanceKm(a?: { lat: number; lng: number }, b?: { lat?: number; lng?: number }) {
  if (!a || typeof b?.lat !== "number" || typeof b?.lng !== "number") return Number.POSITIVE_INFINITY;
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export function isOpenNow(timing: string) {
  const match = timing.match(/(\d{1,2}):(\d{2})\s*(AM|PM).*?(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return true;
  const toHour = (h: string, m: string, ap: string) => {
    const base = Number(h) % 12;
    return base + (ap.toUpperCase() === "PM" ? 12 : 0) + Number(m) / 60;
  };
  const start = toHour(match[1], match[2], match[3]);
  const end = toHour(match[4], match[5], match[6]);
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  return end < start ? hour >= start || hour <= end : hour >= start && hour <= end;
}

export async function listTurfs(opts: {
  popular?: boolean;
  nearby?: boolean;
  q?: string;
  city?: string;
  area?: string;
  sport?: string;
  amenity?: string;
  maxPrice?: number;
  minRating?: number;
  openNow?: boolean;
  userLocation?: { lat: number; lng: number };
} = {}): Promise<Turf[]> {
  if (USE_MOCK) {
    await delay(150);
    let list = getMockTurfs();
    if (opts.popular) list = list.filter((t) => t.is_popular);
    if (opts.nearby) list = list.filter((t) => t.is_nearby);
    if (opts.city) {
      const city = opts.city.toLowerCase();
      list = list.filter((t) => t.city.toLowerCase() === city);
    }
    if (opts.area) {
      const area = opts.area.toLowerCase();
      list = list.filter((t) => t.address.toLowerCase().includes(area));
    }
    if (opts.sport) list = list.filter((t) => t.sport_types.some((s) => s.toLowerCase() === opts.sport?.toLowerCase()));
    if (opts.amenity) list = list.filter((t) => t.amenities.some((a) => a.toLowerCase() === opts.amenity?.toLowerCase()));
    if (opts.maxPrice) list = list.filter((t) => t.price_per_hour <= Number(opts.maxPrice));
    if (opts.minRating) list = list.filter((t) => t.rating >= Number(opts.minRating));
    if (opts.openNow) list = list.filter((t) => isOpenNow(t.timing));
    if (opts.q) {
      const q = opts.q.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q) ||
          t.sport_types.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (opts.userLocation) {
      list = [...list].sort((a, b) => distanceKm(opts.userLocation, a) - distanceKm(opts.userLocation, b));
    }
    return list;
  }
  const params = new URLSearchParams();
  if (opts.popular) params.set("popular", "1");
  if (opts.nearby) params.set("nearby", "1");
  if (opts.q) params.set("q", opts.q);
  if (opts.city) params.set("city", opts.city);
  if (opts.area) params.set("area", opts.area);
  if (opts.sport) params.set("sport", opts.sport);
  if (opts.amenity) params.set("amenity", opts.amenity);
  if (opts.maxPrice) params.set("maxPrice", String(opts.maxPrice));
  if (opts.minRating) params.set("minRating", String(opts.minRating));
  if (opts.openNow) params.set("openNow", "1");
  const qs = params.toString();
  return http<Turf[]>(`/turfs${qs ? `?${qs}` : ""}`);
}

export async function getTurf(id: string): Promise<Turf> {
  if (USE_MOCK) {
    await delay(120);
    const t = getMockTurfs().find((x) => x.id === id);
    if (!t) throw new Error("Turf not found");
    return t;
  }
  return http<Turf>(`/turfs/${id}`);
}

export async function listFavorites(): Promise<string[]> {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user ? user.id : 'mock_user';
      const { data, error } = await supabase
        .from("favorites")
        .select("turf_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []).map((fav: any) => fav.turf_id);
    } catch (err) {
      console.warn("Failed to query favorites from Supabase:", err);
    }
  }
  if (USE_MOCK || supabase) { await delay(60); return getMockFavorites(); }
  return http<string[]>("/favorites");
}

export async function toggleFavorite(turfId: string): Promise<string[]> {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user ? user.id : 'mock_user';
      
      // Check if it already exists
      const { data: existing, error: checkError } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", userId)
        .eq("turf_id", turfId)
        .maybeSingle();
      if (checkError) throw checkError;

      if (existing) {
        // Delete it
        const { error: deleteError } = await supabase
          .from("favorites")
          .delete()
          .eq("id", existing.id);
        if (deleteError) throw deleteError;
      } else {
        // Insert it
        const { error: insertError } = await supabase
          .from("favorites")
          .insert({
            id: uid("fav"),
            user_id: userId,
            turf_id: turfId,
          });
        if (insertError) throw insertError;
      }
      
      // Return updated list
      return listFavorites();
    } catch (err) {
      console.warn("Failed to toggle favorite on Supabase:", err);
    }
  }
  if (USE_MOCK || supabase) {
    await delay(80);
    const favorites = getMockFavorites();
    const next = favorites.includes(turfId) ? favorites.filter((id) => id !== turfId) : [...favorites, turfId];
    setMockFavorites(next);
    return next;
  }
  return http<string[]>("/favorites/toggle", { method: "POST", body: JSON.stringify({ turf_id: turfId }) });
}

export async function listReviews(turfId: string): Promise<Review[]> {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("turf_id", turfId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Review[];
    } catch (err) {
      console.warn("Failed to list reviews from Supabase:", err);
    }
  }
  if (USE_MOCK || supabase) { await delay(80); return getMockReviews().filter((review) => review.turf_id === turfId); }
  return http<Review[]>(`/turfs/${turfId}/reviews`);
}

export async function addReview(turfId: string, rating: number, comment: string, userGetter: () => Promise<any>): Promise<Review> {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user ? user.id : 'mock_user';
      const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Player';
      
      const review: Review = {
        id: uid("rev"),
        turf_id: turfId,
        user_id: userId,
        user_name: userName,
        rating,
        comment,
        created_at: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from("reviews")
        .insert(review);
      if (error) throw error;
      return review;
    } catch (err) {
      console.warn("Failed to add review to Supabase:", err);
    }
  }
  if (USE_MOCK || supabase) {
    await delay(120);
    const user = await userGetter();
    if (!user) throw new Error("Please sign in first");
    const review: Review = {
      id: uid("rev"),
      turf_id: turfId,
      user_id: user.user_id,
      user_name: user.name,
      rating,
      comment,
      created_at: new Date().toISOString(),
    };
    setMockReviews([review, ...getMockReviews()]);
    return review;
  }
  return http<Review>(`/turfs/${turfId}/reviews`, { method: "POST", body: JSON.stringify({ rating, comment }) });
}
