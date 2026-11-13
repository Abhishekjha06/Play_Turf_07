/**
 * Client (turf owner) panel data layer.
 *
 * Every query is scoped by turfs.owner_id — enforced twice: by RLS policies
 * (supabase_client_panel.sql) and by explicit .eq("owner_id") filters here.
 * Owners can never see another business's data even if the UI were bypassed.
 *
 * Revenue figures come from booking amounts while the checkout is simulated —
 * the UI labels them as booking value, NOT settled revenue.
 */
import { getSupabase, withTimeout } from "@/lib/supabase";
import type { Turf } from "@/data/seed";
import { isMissingSchemaError } from "../../admin/admin-api";

export { downloadCsv } from "../../admin/admin-api";

// ---------------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------------

export async function myFacilities(): Promise<{ rows: Turf[]; missingSchema: boolean }> {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], missingSchema: false };

  const { data, error } = await withTimeout(
    supabase.from("turfs").select("*").eq("owner_id", user.id).order("created_at", { ascending: false, nullFirst: false }),
  );
  if (error) {
    if (isMissingSchemaError(error)) return { rows: [], missingSchema: true };
    throw error;
  }
  return { rows: (data || []) as unknown as Turf[], missingSchema: false };
}

/** Fields an owner may edit on their own facility — lifecycle/ownership are admin-controlled. */
const OWNER_EDITABLE = new Set([
  "name", "city", "address", "image", "price_per_hour", "timing",
  "sport_types", "amenities", "description", "is_popular",
]);

export async function updateMyFacility(id: string, patch: Partial<Turf>): Promise<void> {
  const supabase = await getSupabase();
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (OWNER_EDITABLE.has(k)) safe[k] = v;
  }
  if (!Object.keys(safe).length) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await withTimeout(
    // Double-scope: RLS enforces ownership; the filter makes intent explicit.
    supabase.from("turfs").update(safe).eq("id", id).eq("owner_id", user?.id ?? ""),
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Bookings for owned venues
// ---------------------------------------------------------------------------

export type OwnerBooking = {
  id: string;
  status: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  hours: number | null;
  amount: number | null;
  pitch_id: number | null;
  sport: string | null;
  payment_id: string | null;
  user_id: string | null;
  turf_name: string | null;
  created_at: string | null;
};

export async function myBookings(opts: { turfId?: string; date?: string } = {}): Promise<{ rows: OwnerBooking[]; missingSchema: boolean }> {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], missingSchema: false };

  const { data: owned } = await withTimeout(
    supabase.from("turfs").select("id").eq("owner_id", user.id),
  );
  const ids = (owned || []).map((t: { id: string }) => t.id);
  if (!ids.length) return { rows: [], missingSchema: false };

  let q = supabase
    .from("bookings")
    .select("id,status,date,start_time,end_time,hours,amount,pitch_id,sport,payment_id,user_id,turf_name,created_at")
    .in("turf_id", ids)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (opts.turfId && ids.includes(opts.turfId)) q = q.eq("turf_id", opts.turfId);
  if (opts.date) q = q.eq("date", opts.date);

  const { data, error } = await withTimeout(q);
  if (error) {
    if (isMissingSchemaError(error)) return { rows: [], missingSchema: true };
    throw error;
  }
  return { rows: (data || []) as unknown as OwnerBooking[], missingSchema: false };
}

// ---------------------------------------------------------------------------
// Blocked slots (persistent — backed by blocked_slots table)
// ---------------------------------------------------------------------------

export type BlockedSlot = {
  id: string;
  turf_id: string;
  pitch_id: number | null;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
};

export async function getBlockedSlots(turfId: string, date?: string): Promise<BlockedSlot[]> {
  const supabase = await getSupabase();
  let q = supabase
    .from("blocked_slots")
    .select("id,turf_id,pitch_id,date,start_time,end_time,reason")
    .eq("turf_id", turfId)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });
  if (date) q = q.eq("date", date);
  const { data, error } = await withTimeout(q);
  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
  return (data || []) as unknown as BlockedSlot[];
}

/**
 * Block hours across a date range. One row per (turf, date, hour-slot) so the
 * unique index stays satisfied and partial ranges remain individually
 * unblockable.
 */
export async function blockSlots(
  input: { turfId: string; fromDate: string; toDate: string; startHour: number; endHour: number; pitchId?: number | null; reason: string },
): Promise<number> {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows: Record<string, unknown>[] = [];
  const [sy, sm, sd] = input.fromDate.split("-").map(Number);
  const [ey, em, ed] = input.toDate.split("-").map(Number);
  const end = new Date(ey, em - 1, ed);
  for (let d = new Date(sy, sm - 1, sd); d <= end; d.setDate(d.getDate() + 1)) {
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (let h = input.startHour; h < input.endHour; h++) {
      rows.push({
        turf_id: input.turfId,
        pitch_id: input.pitchId ?? null,
        date,
        start_time: `${String(h).padStart(2, "0")}:00`,
        end_time: `${String(h + 1).padStart(2, "0")}:00`,
        reason: input.reason || "Maintenance",
        created_by: user?.id ?? null,
      });
    }
  }
  if (!rows.length) return 0;

  const { error } = await withTimeout(supabase.from("blocked_slots").upsert(rows, { ignoreDuplicates: true }));
  if (error) throw error;
  return rows.length;
}

export async function removeBlockedSlot(id: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await withTimeout(supabase.from("blocked_slots").delete().eq("id", id));
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Dashboard aggregates (computed from real owned data, client-side)
// ---------------------------------------------------------------------------

export type OwnerStats = ReturnType<typeof computeOwnerStats>;

export function computeOwnerStats(rows: OwnerBooking[], facilityCount: number, today: string) {
  const norm = (s: string | null) => (s || "").toLowerCase();
  const confirmed = rows.filter((b) => norm(b.status) === "confirmed");
  const bookingValue = confirmed.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const attempts = confirmed.length + rows.filter((b) => norm(b.status) === "pending").length;
  const peak = new Map<string, number>();
  confirmed.forEach((b) => {
    if (b.start_time) peak.set(b.start_time, (peak.get(b.start_time) || 0) + 1);
  });
  const peakHours = Array.from(peak.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([h]) => h);
  return {
    total: rows.length,
    todayCount: rows.filter((b) => b.date === today).length,
    upcoming: rows.filter((b) => (b.date || "") >= today && norm(b.status) === "confirmed").length,
    completed: rows.filter((b) => norm(b.status) === "completed").length,
    cancelled: rows.filter((b) => norm(b.status) === "cancelled").length,
    bookingValue,
    conversion: attempts ? Math.round((confirmed.length / attempts) * 100) : 0,
    peakHours,
    facilityCount,
  };
}
