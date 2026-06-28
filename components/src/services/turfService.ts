import { getSupabase, withTimeout } from "@/lib/supabase";
import { type Turf } from "@/data/seed";

export async function getPopularTurfs(limit = 10): Promise<Turf[]> {
    const supabase = await getSupabase();
    const { data, error } = await withTimeout(
        supabase
          .from("turfs")
          .select("*")
          .eq("is_popular", true)
          .order("rating", { ascending: false })
          .limit(limit)
    );
    if (error) throw error;
    return (data || []) as Turf[];
}

export async function getNearbyTurfs(
    _userLocation?: { lat: number; lng: number } | null,
    limit = 10,
): Promise<Turf[]> {
    const supabase = await getSupabase();
    const { data, error } = await withTimeout(
        supabase
          .from("turfs")
          .select("*")
          .eq("is_nearby", true)
          .limit(limit)
    );
    if (error) throw error;
    return (data || []) as Turf[];
}

export async function getAllTurfs(filters?: {
    city?: string;
    sport?: string;
    maxPrice?: number;
    minRating?: number;
}): Promise<Turf[]> {
    const supabase = await getSupabase();
    let query = supabase.from("turfs").select("*");
    if (filters?.city) query = query.eq("city", filters.city);
    if (filters?.sport) query = query.contains("sport_types", [filters.sport]);
    if (filters?.maxPrice) query = query.lte("price_per_hour", filters.maxPrice);
    if (filters?.minRating) query = query.gte("rating", filters.minRating);
    const { data, error } = await withTimeout(query);
    if (error) throw error;
    return (data || []) as Turf[];
}
