import { getSupabase, withTimeout } from "../supabase";

export type EventBannerStatus = "active" | "inactive";

export interface EventBanner {
  id: string;
  title: string | null;
  image_url: string;
  status: EventBannerStatus;
  display_order: number;
  created_at: string;
}

const TABLE = "event_banners";

/**
 * Active event banners for the home Events Banner area, in display order.
 * Error-tolerant on purpose: while supabase_event_banners.sql has not been
 * run in the dashboard, the header degrades to its themed gradient instead
 * of breaking the Home page.
 */
export async function listActiveEventBanners(): Promise<EventBanner[]> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await withTimeout(
      supabase
        .from(TABLE)
        .select("*")
        .eq("status", "active")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true })
    );
    if (error) throw error;
    return (data || []) as EventBanner[];
  } catch (e) {
    console.warn("event_banners unavailable:", e);
    return [];
  }
}

// ── Admin ──────────────────────────────────────────────────────────────────

export async function listAllEventBanners(): Promise<EventBanner[]> {
  const supabase = await getSupabase();
  const { data, error } = await withTimeout(
    supabase.from(TABLE).select("*").order("display_order", { ascending: true })
  );
  if (error) throw error;
  return (data || []) as EventBanner[];
}

export async function addEventBanner(input: {
  title?: string;
  image_url: string;
  display_order?: number;
}): Promise<EventBanner> {
  const supabase = await getSupabase();
  const row = {
    title: input.title?.trim() || null,
    image_url: input.image_url,
    status: "active" as EventBannerStatus,
    display_order: input.display_order ?? 0,
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return data as EventBanner;
}

export async function updateEventBanner(
  id: string,
  patch: Partial<Pick<EventBanner, "title" | "status" | "display_order">>
): Promise<EventBanner> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from(TABLE).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as EventBanner;
}

export async function deleteEventBanner(id: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function reorderEventBanners(orderedIds: string[]): Promise<void> {
  const supabase = await getSupabase();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from(TABLE).update({ display_order: index }).eq("id", id)
    )
  );
}

/** Uploads a PNG to the public `event-banners` storage bucket (see supabase_event_banners.sql). */
export async function uploadEventBannerImage(file: File): Promise<string> {
  if (file.type !== "image/png") {
    throw new Error("Event banners must be PNG images.");
  }
  const supabase = await getSupabase();
  const fileName = `event-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = `event-banners/${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from("event-banners")
    .upload(filePath, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage
    .from("event-banners")
    .getPublicUrl(filePath);
  return data.publicUrl;
}
