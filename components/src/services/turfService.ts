/**
 * Turf service – abstracts data fetching so UI components never import
 * mock data directly.  When Supabase is configured the functions query
 * the database; otherwise they return mock data from seed.ts.
 *
 * To switch to Supabase:
 * 1. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * 2. Install @supabase/supabase-js
 * 3. Replace the mock fallbacks with real Supabase queries (search for TODO)
 */

import { getSupabase } from "@/lib/supabase";
import { turfs as seedTurfs, type Turf } from "@/data/seed";

/**
 * Fetch popular turfs (sorted by rating).
 * TODO: Replace mock with Supabase query, e.g.:
 *   supabase.from("turfs").select("*").eq("is_popular", true).order("rating", { ascending: false })
 */
export async function getPopularTurfs(limit = 10): Promise<Turf[]> {
    const supabase = await getSupabase();
    if (supabase) {
        const { data, error } = await supabase
          .from("turfs")
          .select("*")
          .eq("is_popular", true)
          .order("rating", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data as Turf[];
    }

    // Mock fallback
    return seedTurfs
        .filter((t) => t.is_popular)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, limit);
}

/**
 * Fetch nearby turfs.
 * TODO: Replace mock with Supabase geo query or PostGIS, e.g.:
 *   supabase.rpc("nearby_turfs", { lat, lng, radius_km })
 */
export async function getNearbyTurfs(
    _userLocation?: { lat: number; lng: number } | null,
    limit = 10,
): Promise<Turf[]> {
    const supabase = await getSupabase();
    if (supabase) {
        const { data, error } = await supabase
          .from("turfs")
          .select("*")
          .eq("is_nearby", true)
          .limit(limit);
        if (error) throw error;
        return data as Turf[];
    }

    // Mock fallback
    return seedTurfs.filter((t) => t.is_nearby).slice(0, limit);
}

/**
 * Fetch all turfs with optional filters.
 * TODO: Replace mock with Supabase query with filters.
 */
export async function getAllTurfs(filters?: {
    city?: string;
    sport?: string;
    maxPrice?: number;
    minRating?: number;
}): Promise<Turf[]> {
    const supabase = await getSupabase();
    if (supabase) {
        let query = supabase.from("turfs").select("*");
        if (filters?.city) query = query.eq("city", filters.city);
        if (filters?.sport) query = query.contains("sport_types", [filters.sport]);
        if (filters?.maxPrice) query = query.lte("price_per_hour", filters.maxPrice);
        if (filters?.minRating) query = query.gte("rating", filters.minRating);
        const { data, error } = await query;
        if (error) throw error;
        return data as Turf[];
    }

    // Mock fallback with basic filtering
    let result = [...seedTurfs];
    if (filters?.city) result = result.filter((t) => t.city === filters.city);
    if (filters?.sport) result = result.filter((t) => t.sport_types.includes(filters.sport!));
    if (filters?.maxPrice) result = result.filter((t) => t.price_per_hour <= filters.maxPrice!);
    if (filters?.minRating) result = result.filter((t) => t.rating >= filters.minRating!);
    return result;
}
