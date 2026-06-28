import { type Banner } from "@/data/seed";
import { getSupabase, withTimeout } from "../supabase";

export async function listBanners(): Promise<Banner[]> {
  const supabase = await getSupabase();
  const { data, error } = await withTimeout(
    supabase.from("banners").select("*").order("order", { ascending: true })
  );
  if (error) throw error;
  return (data || []) as Banner[];
}
