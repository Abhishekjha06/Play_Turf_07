/**
 * Offer service – abstracts offer/deal data fetching.
 * When Supabase is configured the functions query the database;
 * otherwise they return mock data from seed.ts.
 *
 * To switch to Supabase:
 * 1. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * 2. Install @supabase/supabase-js
 * 3. Replace the mock fallbacks with real Supabase queries (search for TODO)
 */

import { getSupabase } from "@/lib/supabase";
import { offers as seedOffers, type Offer } from "@/data/seed";

/**
 * Fetch all active offers & deals.
 * TODO: Replace mock with Supabase query, e.g.:
 *   supabase.from("offers").select("*").eq("is_active", true).order("created_at", { ascending: false })
 */
export async function getOffers(limit = 10): Promise<Offer[]> {
    const supabase = await getSupabase();
    if (supabase) {
        try {
            const { data, error } = await supabase
              .from("offers")
              .select("*")
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(limit);
            if (error) throw error;
            if (data && data.length > 0) {
                return data as Offer[];
            }
        } catch (err) {
            console.warn("Failed to query offers from Supabase:", err);
        }
    }

    // Mock fallback
    return seedOffers.slice(0, limit);
}

/**
 * Fetch a single offer by ID.
 * TODO: Replace mock with Supabase query.
 */
export async function getOfferById(id: string): Promise<Offer | null> {
    const supabase = await getSupabase();
    if (supabase) {
        try {
            const { data, error } = await supabase
              .from("offers")
              .select("*")
              .eq("id", id)
              .single();
            if (error) throw error;
            if (data) {
                return data as Offer;
            }
        } catch (err) {
            console.warn("Failed to query offer by ID from Supabase:", err);
        }
    }

    // Mock fallback
    return seedOffers.find((o) => o.id === id) ?? null;
}
