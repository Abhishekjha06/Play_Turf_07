import {
  tournaments as seedTournaments,
  type Tournament,
} from "@/data/seed";
import { getSupabase, withTimeout } from "../supabase";
import { USE_MOCK, lsGet, lsSet, LS_TOURNAMENTS, delay, http } from "./core";

export function getMockTournaments(): Tournament[] { return lsGet<Tournament[]>(LS_TOURNAMENTS, seedTournaments); }
export function setMockTournaments(v: Tournament[]) { lsSet(LS_TOURNAMENTS, v); }

export async function listTournaments(): Promise<Tournament[]> {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data, error } = await withTimeout(supabase.from("tournaments").select("*").order("date", { ascending: true }));
      if (error) throw error;
      if (data && data.length > 0) {
        return data as Tournament[];
      }
    } catch (err) {
      console.warn("Failed to query tournaments from Supabase:", err);
    }
  }
  if (USE_MOCK || supabase) { await delay(120); return getMockTournaments(); }
  return http<Tournament[]>("/tournaments");
}

export async function getTournament(id: string): Promise<Tournament> {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data, error } = await withTimeout(supabase.from("tournaments").select("*").eq("id", id).single());
      if (error) throw error;
      if (data) {
        return data as Tournament;
      }
    } catch (err) {
      console.warn("Failed to query tournament from Supabase:", err);
    }
  }
  if (USE_MOCK || supabase) {
    await delay(120);
    const t = getMockTournaments().find((x) => x.id === id);
    if (!t) throw new Error("Tournament not found");
    return t;
  }
  return http<Tournament>(`/tournaments/${id}`);
}
