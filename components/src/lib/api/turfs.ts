import {
  type Turf,
  type Review,
} from "@/data/seed";
import { getSupabase } from "../supabase";
import { uid } from "./core";

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
  const supabase = await getSupabase();
  let query = supabase.from("turfs").select("*");

  if (opts.popular) {
    query = query.eq("is_popular", true);
  }
  if (opts.nearby) {
    query = query.eq("is_nearby", true);
  }
  if (opts.city) {
    query = query.eq("city", opts.city);
  }
  if (opts.area) {
    query = query.ilike("address", `%${opts.area}%`);
  }
  if (opts.sport) {
    query = query.contains("sport_types", [opts.sport]);
  }
  if (opts.amenity) {
    query = query.contains("amenities", [opts.amenity]);
  }
  if (opts.maxPrice) {
    query = query.lte("price_per_hour", opts.maxPrice);
  }
  if (opts.minRating) {
    query = query.gte("rating", opts.minRating);
  }
  if (opts.q) {
    const q = `%${opts.q}%`;
    query = query.or(`name.ilike.${q},city.ilike.${q},address.ilike.${q}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  let result = (data || []) as Turf[];

  if (opts.openNow) {
    result = result.filter((t) => isOpenNow(t.timing));
  }
  if (opts.userLocation) {
    result = [...result].sort((a, b) => distanceKm(opts.userLocation, a) - distanceKm(opts.userLocation, b));
  }
  return result;
}

export async function getTurf(id: string): Promise<Turf> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("turfs").select("*").eq("id", id).single();
  if (error) throw error;
  if (!data) throw new Error("Turf not found");
  return data as Turf;
}

export async function listFavorites(userGetter: () => Promise<any>): Promise<string[]> {
  const u = await userGetter();
  if (!u) return [];

  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user ? user.id : u.user_id;
  const { data, error } = await supabase
    .from("favorites")
    .select("turf_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((fav: any) => fav.turf_id);
}

export async function toggleFavorite(turfId: string, userGetter: () => Promise<any>): Promise<string[]> {
  const u = await userGetter();
  if (!u) {
    throw new Error("Authentication required to toggle favorites.");
  }

  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user ? user.id : u.user_id;
  
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
  
  return listFavorites(userGetter);
}

export async function listReviews(turfId: string): Promise<Review[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("turf_id", turfId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Review[];
}

export async function addReview(turfId: string, rating: number, comment: string, userGetter: () => Promise<any>): Promise<Review> {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const u = await userGetter();
  const userId = user ? user.id : (u?.user_id || 'mock_user');
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || u?.name || 'Player';
  
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
}
