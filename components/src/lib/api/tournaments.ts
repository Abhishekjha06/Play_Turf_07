import { type Tournament } from "@/data/seed";
import { getSupabase, withTimeout } from "../supabase";

export async function listTournaments(): Promise<Tournament[]> {
  const supabase = await getSupabase();
  const { data, error } = await withTimeout(
    supabase.from("tournaments").select("*").order("date", { ascending: true })
  );
  if (error) throw error;
  return (data || []) as Tournament[];
}

export async function getTournament(id: string): Promise<Tournament> {
  const supabase = await getSupabase();
  const { data, error } = await withTimeout(
    supabase.from("tournaments").select("*").eq("id", id).single()
  );
  if (error) throw error;
  if (!data) throw new Error("Tournament not found");
  return data as Tournament;
}
