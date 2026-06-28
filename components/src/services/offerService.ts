import { getSupabase, withTimeout } from "@/lib/supabase";
import { type Offer } from "@/data/seed";

export async function getOffers(limit = 10): Promise<Offer[]> {
    const supabase = await getSupabase();
    const { data, error } = await withTimeout(
        supabase
          .from("offers")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(limit)
    );
    if (error) throw error;
    return (data || []) as Offer[];
}

export async function getOfferById(id: string): Promise<Offer | null> {
    const supabase = await getSupabase();
    const { data, error } = await withTimeout(
        supabase
          .from("offers")
          .select("*")
          .eq("id", id)
          .single()
    );
    if (error) throw error;
    return data as Offer | null;
}
