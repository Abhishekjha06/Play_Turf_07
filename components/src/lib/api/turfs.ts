import {
  type Turf,
  type Review,
} from "@/data/seed";
import { getSupabase } from "../supabase";
import { uid } from "./core";
import {
  type RecommendationCandidate,
  type RecommendationResponse,
  INITIAL_RADIUS_KM,
  MAX_RECOMMENDATIONS,
  recommendSimilarTurfs,
} from "../recommendation";

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
  // SEO amendment 1 + owner round-2 req 1: archived / pending_approval turfs
  // must never surface on public surfaces (00-audit.md §5.9). STRICT by
  // default — a failing status-filtered read throws (see the try/catch below;
  // the unfiltered fallback requires SEO_ALLOW_UNFILTERED_TURFS on environments
  // whose database predates supabase_seo_001_foundation.sql).
  const runQuery = async (filtered: boolean): Promise<Turf[]> => {
    let query = supabase.from("turfs").select("*");
    if (filtered) query = query.eq("status", "published");

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

  // Filtered read first. Owner round-3 item 1: the BROWSER never hard-fails
  // on a missing status column — it degrades to the unfiltered read and logs
  // ONCE (the app must keep working pre-migration). The PREBUILD stays strict:
  // build scripts fail loud on the same error (they do not use this function).
  try {
    return await runQuery(true);
  } catch (err) {
    const msg = String((err as Error)?.message || "");
    if (/status|column|PGRST/i.test(msg)) {
      warnStatusMissingOnce();
      return await runQuery(false);
    }
    throw err;
  }
}

let _warnedStatusMissing = false;
function warnStatusMissingOnce() {
  if (_warnedStatusMissing) return;
  _warnedStatusMissing = true;
  console.warn(
    "[seo] turfs.status column unavailable — showing all rows. " +
      "Apply supabase_seo_001_foundation.sql to enable published-only filtering."
  );
}

/** Exposed for tests: has the once-only warning fired? */
export function statusWarningFired(): boolean {
  return _warnedStatusMissing;
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

export async function listReviews(turfId: string): Promise<Review[]> {  const supabase = await getSupabase();
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

// ── Play Turf Recommendation Engine V1 (Phases 14 + 16) ─────────────────────
// Prefers the hardened `get_similar_turfs` RPC (supabase_recommendation_engine.sql).
// Until that migration is run in the dashboard, it transparently falls back to
// the same algorithm executed client-side (src/lib/recommendation.ts).

const CACHE_TTL_MS = 5 * 60 * 1000; // Phase 16: short TTL — turfs change rarely, but do change
const recommendationCache = new Map<string, { expiresAt: number; value: RecommendationResponse }>();
const inFlight = new Map<string, Promise<RecommendationResponse>>();

/** Phase 16: explicit invalidation (e.g. after a review is added). */
export function clearRecommendationCache(turfId?: string): void {
  if (!turfId) {
    recommendationCache.clear();
    return;
  }
  for (const key of recommendationCache.keys()) {
    if (key.startsWith(`${turfId}::`)) recommendationCache.delete(key);
  }
}

function isValidRecommendationResponse(value: unknown): value is RecommendationResponse {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as RecommendationResponse).recommendations) &&
    !!(value as RecommendationResponse).metadata
  );
}

/** RPC result → RecommendationResponse (the SQL function already returns this shape). */
function mapRpcResponse(data: unknown): RecommendationResponse | null {
  if (!isValidRecommendationResponse(data)) return null;
  return {
    recommendations: (data.recommendations || []).map((r) => ({
      ...(r as RecommendationResponse["recommendations"][number]),
    })),
    metadata: { ...(data as RecommendationResponse).metadata },
  };
}

/** Client-side scoring fallback — same algorithm, no RPC required. */
async function getSimilarTurfsFallback(
  currentTurfId: string,
  selectedSport?: string | null
): Promise<RecommendationResponse> {
  const supabase = await getSupabase();
  const turfs = await listTurfs();
  const current = turfs.find((t) => t.id === currentTurfId);
  if (!current) throw new Error("Turf not found");

  // Review aggregates for every turf in one minimal query (id + rating only —
  // no comments, no customer columns). Replaced by the RPC once migrated.
  const { data: reviewRows, error: reviewError } = await supabase
    .from("reviews")
    .select("turf_id, rating");
  if (reviewError) throw reviewError;
  const reviewAgg = new Map<string, { count: number; sum: number }>();
  for (const row of (reviewRows || []) as { turf_id: string; rating: number }[]) {
    const agg = reviewAgg.get(row.turf_id) || { count: 0, sum: 0 };
    agg.count += 1;
    agg.sum += row.rating;
    reviewAgg.set(row.turf_id, agg);
  }

  // Popularity: confirmed bookings in the last 30 days — turf_id only, both
  // status casings (schema mixes 'confirmed'/'CONFIRMED'). If RLS blocks this
  // (pending security migrations), popularity is reported unavailable and its
  // weight is dropped instead of guessing.
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: bookingRows, error: bookingError } = await supabase
    .from("bookings")
    .select("turf_id")
    .or("status.eq.confirmed,status.eq.CONFIRMED")
    .gte("created_at", since30d);
  const bookingDataAvailable = !bookingError;
  const bookingCounts = new Map<string, number>();
  if (bookingDataAvailable) {
    for (const row of (bookingRows || []) as { turf_id: string }[]) {
      bookingCounts.set(row.turf_id, (bookingCounts.get(row.turf_id) || 0) + 1);
    }
  }

  const toCandidate = (t: Turf): RecommendationCandidate => {
    const agg = reviewAgg.get(t.id);
    return {
      id: t.id,
      name: t.name,
      city: t.city,
      image: t.image,
      lat: typeof t.lat === "number" ? t.lat : null,
      lng: typeof t.lng === "number" ? t.lng : null,
      price_per_hour: typeof t.price_per_hour === "number" ? t.price_per_hour : null,
      rating: agg && agg.count > 0 ? agg.sum / agg.count : null,
      review_count: agg?.count ?? 0,
      sport_types: Array.isArray(t.sport_types) ? t.sport_types : [],
      amenities: Array.isArray(t.amenities) ? t.amenities : [],
      confirmed_bookings_30d: bookingDataAvailable ? bookingCounts.get(t.id) ?? 0 : null,
      distance_km: null,
    };
  };

  const globalAvgRating =
    turfs.length > 0
      ? turfs.reduce((sum, t) => sum + (typeof t.rating === "number" ? t.rating : 0), 0) / turfs.length
      : 4.5;

  return recommendSimilarTurfs(toCandidate(current), turfs.map(toCandidate), {
    selectedSport: selectedSport ?? null,
    globalAvgRating,
    bookingDataAvailable,
  });
}

export async function getSimilarTurfs(
  currentTurfId: string,
  options: { selectedSport?: string | null } = {}
): Promise<RecommendationResponse> {
  const cacheKey = `${currentTurfId}::${options.selectedSport ?? ""}`;

  const cached = recommendationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  recommendationCache.delete(cacheKey);

  const existing = inFlight.get(cacheKey);
  if (existing) return existing; // Phase 16: prevent duplicate concurrent requests

  const request = (async (): Promise<RecommendationResponse> => {
    const supabase = await getSupabase();
    try {
      const { data, error } = await supabase.rpc("get_similar_turfs", {
        p_current_turf_id: currentTurfId,
        p_selected_sport_id: options.selectedSport ?? null,
        p_search_radius_km: INITIAL_RADIUS_KM,
        p_result_limit: MAX_RECOMMENDATIONS,
      });
      if (!error) {
        const mapped = mapRpcResponse(data);
        if (mapped) return mapped;
      }
      // RPC missing (not yet migrated) or malformed — fall through to client scoring.
    } catch {
      // RPC absent — fall through.
    }
    return getSimilarTurfsFallback(currentTurfId, options.selectedSport ?? null);
  })();

  inFlight.set(cacheKey, request);
  try {
    const result = await request;
    recommendationCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
    return result;
  } finally {
    inFlight.delete(cacheKey);
  }
}
