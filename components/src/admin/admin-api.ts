/**
 * Admin data layer — every value shown in the admin panel comes from these
 * real Supabase queries. Nothing here fabricates statistics.
 *
 * Tables that require the `supabase_admin_rbac.sql` migration
 * (admin_audit_log, site_settings, seo_pages, profiles.is_suspended) degrade
 * gracefully: the UI shows a "run migration" banner instead of fake data.
 */
import { getSupabase } from "@/lib/supabase";
import { hasPermission, isAdminRole, type AdminRole } from "./admin-rbac";

/** Thrown by PostgREST when a migration table/column doesn't exist yet. */
export function isMissingSchemaError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    e?.code === "42P01" || // undefined table
    e?.code === "42703" || // undefined column
    /Could not find the table|Could not find the .* column|schema cache/i.test(
      e?.message || ""
    )
  );
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

export type AuditEntry = {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  record_id: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  created_at: string;
};

/**
 * Runs a privileged mutation, then records who did what (and old/new values)
 * via the log_admin_action SECURITY DEFINER RPC — the actor is derived from
 * the JWT server-side, so attribution cannot be spoofed from the client.
 * Audit failures never block the action itself but are surfaced in the
 * Security Center as "audit logging inactive".
 */
export async function withAudit<T>(
  opts: { action: string; recordId?: string | null; reason?: string; oldValue?: unknown },
  mutation: () => Promise<T>,
  role?: string | null
): Promise<T> {
  const result = await mutation();
  try {
    const supabase = await getSupabase();
    const newValue =
      result && typeof result === "object" ? JSON.parse(JSON.stringify(result)) : result ?? null;
    const oldValue =
      opts.oldValue && typeof opts.oldValue === "object"
        ? JSON.parse(JSON.stringify(opts.oldValue))
        : opts.oldValue ?? null;
    const { error } = await supabase.rpc("log_admin_action", {
      p_action: opts.action,
      p_record_id: opts.recordId ?? null,
      p_old_value: oldValue,
      p_new_value: newValue,
      p_reason: opts.reason ?? null,
    });
    if (error) throw error;
  } catch (err) {
    // Missing migration (RPC/table absent) — visible in the Security Center.
    console.warn(`[audit] could not record "${opts.action}":`, err);
  }
  return result;
}

export async function listAuditLog(limit = 100): Promise<{ rows: AuditEntry[]; missingSchema: boolean }> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingSchemaError(error)) return { rows: [], missingSchema: true };
    throw error;
  }
  return { rows: (data || []) as AuditEntry[], missingSchema: false };
}

// ---------------------------------------------------------------------------
// Overview statistics (real aggregates)
// ---------------------------------------------------------------------------

export type BookingRow = {
  id: string;
  status: string | null;
  date: string | null;
  start_time: string | null;
  amount: number | null;
  turf_id: string | null;
  turf_name: string | null;
  user_id: string | null;
  payment_id: string | null;
  created_at: string | null;
};

/** One fetch, many aggregates — bookings table is small enough today. */
export async function fetchBookingRows(): Promise<BookingRow[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("id,status,date,start_time,amount,turf_id,turf_name,user_id,payment_id,created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data || []) as BookingRow[];
}

export type TurfRow = {
  id: string;
  name: string;
  city: string;
  address: string;
  image: string;
  price_per_hour: number;
  sport_types: string[] | null;
  amenities: string[] | null;
  timing: string;
  description: string;
  is_popular: boolean | null;
  status: string | null; // requires migration: pending_approval | published | archived
  ownership: string | null; // requires migration: company | partner
  created_at: string | null;
};

export async function fetchTurfsAdmin(): Promise<{ rows: TurfRow[]; missingSchema: boolean }> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("turfs")
    .select("*")
    .order("created_at", { ascending: false, nullFirst: false })
    .limit(1000);
  if (error) {
    if (isMissingSchemaError(error)) return { rows: [], missingSchema: true };
    throw error;
  }
  return { rows: (data || []) as unknown as TurfRow[], missingSchema: false };
}

export async function getOverviewStats() {
  const supabase = await getSupabase();
  type Filter = { col: string; op: "eq" | "gte" | "in"; val: string | number | string[] };
  const count = async (table: string, filters?: Filter[]) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    for (const f of filters || []) {
      if (f.op === "eq") q = q.eq(f.col, f.val);
      else if (f.op === "gte") q = q.gte(f.col, f.val);
      else if (f.op === "in") q = q.in(f.col, f.val as string[]);
    }
    const { count: n, error } = await q;
    if (error) throw error;
    return n ?? 0;
  };

  const today = new Date().toLocaleDateString("en-CA");
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    totalUsers, newUsers7d, turfOwners, admins,
    totalVenues, totalBookings, games,
    todayBookings, upcomingBookings,
  ] = await Promise.all([
    count("profiles"),
    count("profiles", [{ col: "created_at", op: "gte", val: weekAgo }]),
    count("profiles", [{ col: "role", op: "eq", val: "client" }]),
    count("profiles", [{ col: "role", op: "in", val: ["admin", "super_admin", "finance_admin", "content_admin", "support_admin"] }]),
    count("turfs"),
    count("bookings"),
    count("games", [{ col: "status", op: "in", val: ["open", "full"] }]),
    count("bookings", [{ col: "date", op: "eq", val: today }]),
    count("bookings", [{ col: "date", op: "gte", val: today }]),
  ]);

  const bookingRows = await fetchBookingRows();
  const norm = (s: string | null) => (s || "").toLowerCase();
  const statusCount = (s: string) => bookingRows.filter((b) => norm(b.status) === s).length;
  const confirmed = bookingRows.filter((b) => norm(b.status) === "confirmed");
  // Venue revenue = confirmed booking amounts. Payments run through the
  // simulated checkout — this is booking value, NOT settled revenue.
  const bookingValue = confirmed.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const attempts = confirmed.length + statusCount("pending");
  const conversion = attempts > 0 ? Math.round((confirmed.length / attempts) * 100) : 0;

  return {
    totalUsers, newUsers7d, turfOwners, admins,
    totalVenues, totalBookings, games,
    todayBookings, upcomingBookings,
    pendingBookings: statusCount("pending"),
    completedBookings: statusCount("completed"),
    cancelledBookings: statusCount("cancelled"),
    confirmedBookings: confirmed.length,
    bookingValue,
    conversion,
    bookingRows,
  };
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export type ProfileRow = {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  is_admin: boolean | null;
  avatar_id: string;
  is_suspended: boolean | null; // requires migration
  suspension_reason: string | null; // requires migration
  created_at: string;
};

export async function listProfiles(opts: { search?: string; page?: number; pageSize?: number } = {}) {
  const supabase = await getSupabase();
  const { search = "", page = 0, pageSize = 25 } = opts;
  let q = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`full_name.ilike.${s},phone.ilike.${s}`);
  }
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: (data || []) as unknown as ProfileRow[], total: count ?? 0 };
}

/** Email addresses live in auth.users and need service-role access — not
 *  available from the browser. Searching by email requires the future
 *  server-side admin API. */
export async function setUserSuspended(id: string, suspended: boolean, reason: string, role?: string | null) {
  return withAudit(
    { action: suspended ? "user.suspend" : "user.reactivate", recordId: id, reason },
    async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("profiles")
        .update({ is_suspended: suspended, suspension_reason: suspended ? reason : null })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    role
  );
}

// ---------------------------------------------------------------------------
// Venue management
// ---------------------------------------------------------------------------

export async function updateVenueAdmin(id: string, patch: Record<string, unknown>, role?: string | null, oldValue?: unknown) {
  return withAudit(
    { action: "venue.update", recordId: id, oldValue },
    async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase.from("turfs").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    role
  );
}

export async function createVenueAdmin(payload: Record<string, unknown>, role?: string | null) {
  return withAudit(
    { action: "venue.create" },
    async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase.from("turfs").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    role
  );
}

// ---------------------------------------------------------------------------
// Open games moderation (requires admin_cancel_game RPC from the migration)
// ---------------------------------------------------------------------------

export async function adminCancelGame(gameId: string, reason: string, role?: string | null) {
  return withAudit(
    { action: "game.cancel", recordId: gameId, reason },
    async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase.rpc("admin_cancel_game", {
        p_game_id: gameId,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    role
  );
}

// ---------------------------------------------------------------------------
// Site settings (site_settings table — requires migration)
// ---------------------------------------------------------------------------

export type SiteSettings = Record<string, unknown>;

export async function getSiteSettings(): Promise<{ settings: SiteSettings; missingSchema: boolean }> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("site_settings").select("key,value");
  if (error) {
    if (isMissingSchemaError(error)) return { settings: {}, missingSchema: true };
    throw error;
  }
  const settings: SiteSettings = {};
  (data || []).forEach((row: { key: string; value: unknown }) => {
    settings[row.key] = row.value;
  });
  return { settings, missingSchema: false };
}

export async function updateSiteSetting(key: string, value: unknown, role?: string | null, oldValue?: unknown) {
  return withAudit(
    { action: "settings.update", recordId: key, oldValue },
    async () => {
      const supabase = await getSupabase();
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key, value, updated_by: (await supabase.auth.getUser()).data.user?.id ?? null });
      if (error) throw error;
      return { key, value };
    },
    role
  );
}

// ---------------------------------------------------------------------------
// SEO pages (seo_pages table — requires migration)
// ---------------------------------------------------------------------------

export type SeoPageRow = {
  id: string;
  page_type: string; // location | sport | location_sport
  slug: string;
  title: string;
  description: string;
  h1: string;
  content: string;
  robots: string; // index | noindex
  enabled: boolean;
  updated_at: string;
};

export async function listSeoPages(): Promise<{ rows: SeoPageRow[]; missingSchema: boolean }> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("seo_pages")
    .select("*")
    .order("page_type", { ascending: true });
  if (error) {
    if (isMissingSchemaError(error)) return { rows: [], missingSchema: true };
    throw error;
  }
  return { rows: (data || []) as unknown as SeoPageRow[], missingSchema: false };
}

export async function upsertSeoPage(row: Partial<SeoPageRow> & { page_type: string; slug: string }, role?: string | null) {
  return withAudit(
    { action: "seo.page.upsert", recordId: `${row.page_type}:${row.slug}` },
    async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("seo_pages")
        .upsert(row, { onConflict: "page_type,slug" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    role
  );
}

export async function deleteSeoPage(id: string, role?: string | null) {
  return withAudit(
    { action: "seo.page.delete", recordId: id },
    async () => {
      const supabase = await getSupabase();
      const { error } = await supabase.from("seo_pages").delete().eq("id", id);
      if (error) throw error;
    },
    role
  );
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Permission-checked mutation guard (defense in depth on the client)
// ---------------------------------------------------------------------------

export function assertPermission(role: string | null | undefined, permission: Parameters<typeof hasPermission>[1]): void {
  if (!hasPermission(role, permission)) {
    throw new Error("Your admin role does not permit this action.");
  }
}

export function isAdmin(role: string | null | undefined): boolean {
  return isAdminRole(role);
}

export type { AdminRole };
