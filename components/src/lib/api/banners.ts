import {
  banners as seedBanners,
  type Banner,
} from "@/data/seed";
import { getSupabase } from "../supabase";
import { USE_MOCK, lsGet, lsSet, LS_BANNERS, delay, http } from "./core";

export function getMockBanners(): Banner[] { return lsGet<Banner[]>(LS_BANNERS, seedBanners); }
export function setMockBanners(v: Banner[]) { lsSet(LS_BANNERS, v); }

export async function listBanners(): Promise<Banner[]> {
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from("banners").select("*").order("order", { ascending: true });
    if (error) throw error;
    return data as Banner[];
  }
  if (USE_MOCK) { await delay(150); return [...getMockBanners()].sort((a, b) => a.order - b.order); }
  return http<Banner[]>("/banners");
}
