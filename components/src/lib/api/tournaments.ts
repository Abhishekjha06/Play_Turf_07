import {
  tournaments as seedTournaments,
  type Tournament,
} from "@/data/seed";
import { getSupabase } from "../supabase";
import { USE_MOCK, lsGet, lsSet, LS_TOURNAMENTS, delay, http } from "./core";

export function getMockTournaments(): Tournament[] { return lsGet<Tournament[]>(LS_TOURNAMENTS, seedTournaments); }
export function setMockTournaments(v: Tournament[]) { lsSet(LS_TOURNAMENTS, v); }

export async function listTournaments(): Promise<Tournament[]> {
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from("tournaments").select("*").order("date", { ascending: true });
    if (error) throw error;
    return data as Tournament[];
  }
  if (USE_MOCK) { await delay(120); return getMockTournaments(); }
  return http<Tournament[]>("/tournaments");
}

export async function getTournament(id: string): Promise<Tournament> {
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).single();
    if (error) throw error;
    return data as Tournament;
  }
  if (USE_MOCK) {
    await delay(120);
    const t = getMockTournaments().find((x) => x.id === id);
    if (!t) throw new Error("Tournament not found");
    return t;
  }
  return http<Tournament>(`/tournaments/${id}`);
}
