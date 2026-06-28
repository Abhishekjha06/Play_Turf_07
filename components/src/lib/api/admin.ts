import type { Turf, Banner, Offer, Tournament, Booking } from "@/data/seed";
import { getSupabase } from "../supabase";
import { uid } from "./core";

export async function addTurf(t: Partial<Turf>): Promise<Turf> {
  const supabase = await getSupabase();
  const turf: Turf = {
    id: uid("turf"),
    name: t.name || "New Turf",
    city: t.city || "City",
    address: t.address || "Address",
    lat: t.lat,
    lng: t.lng,
    image: t.image || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200",
    gallery: t.gallery || [],
    rating: t.rating ?? 4.5,
    timing: t.timing || "06:00 AM – 11:00 PM",
    price_per_hour: t.price_per_hour ?? 1000,
    sport_types: t.sport_types || ["Football"],
    amenities: t.amenities || ["Floodlights"],
    videos: t.videos || [],
    description: t.description || "",
    is_popular: t.is_popular ?? false,
    is_nearby: t.is_nearby ?? false,
  };
  const { error } = await supabase.from("turfs").insert(turf);
  if (error) throw error;
  return turf;
}

export async function updateTurf(id: string, patch: Partial<Turf>): Promise<Turf> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("turfs")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Turf;
}

export async function deleteTurf(id: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("turfs")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function addBanner(b: Partial<Banner>): Promise<Banner> {
  const supabase = await getSupabase();
  const banner: Banner = {
    id: uid("ban"),
    title: b.title || "Banner",
    highlight: b.highlight || "",
    subtitle: b.subtitle || "",
    image: b.image || "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=1200",
    badge: b.badge || "NEW",
    cta_text: b.cta_text || "Explore",
    cta_link: b.cta_link || "/",
    order: b.order ?? 99,
  };
  const { error } = await supabase.from("banners").insert(banner);
  if (error) throw error;
  return banner;
}

export async function deleteBanner(id: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("banners")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function addOffer(o: Partial<Offer>): Promise<Offer> {
  const supabase = await getSupabase();
  const off: Offer = {
    id: uid("off"),
    title: o.title || "Offer",
    subtitle: o.subtitle || "",
    badge: o.badge || "DEAL",
    image: o.image || "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=600",
    discount: o.discount || "10%",
  };
  const { error } = await supabase.from("offers").insert(off);
  if (error) throw error;
  return off;
}

export async function deleteOffer(id: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("offers")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function addTournament(t: Partial<Tournament>): Promise<Tournament> {
  const supabase = await getSupabase();
  const tnt: Tournament = {
    id: uid("tnt"),
    name: t.name || "Tournament",
    sport: t.sport || "Football",
    location: t.location || "City",
    image: t.image || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200",
    date: t.date || new Date().toISOString().slice(0, 10),
    prize_pool: t.prize_pool || "₹10,000",
    teams: t.teams ?? 8,
    entry_fee: t.entry_fee ?? 1000,
    description: t.description || "",
  };
  const { error } = await supabase.from("tournaments").insert(tnt);
  if (error) throw error;
  return tnt;
}

export async function deleteTournament(id: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("tournaments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function listAllBookings(): Promise<Booking[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Booking[];
}

export async function listFeedback(): Promise<any[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("feedbacks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateFeedbackStatus(id: string, payload: { status?: string; priority?: string }): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("feedbacks")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
  
  // Log activity
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("feedback_activity").insert({
      feedback_id: id,
      action: payload.status ? "Status Update" : "Priority Update",
      new_status: payload.status || payload.priority,
      performed_by: user.id
    });
  }
}

// Beta Users
export async function listBetaUsers(): Promise<any[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("beta_users")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function inviteBetaUser(email: string, notes?: string): Promise<any> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("beta_users")
    .insert({ email, notes, status: "Invited" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBetaUserStatus(id: string, status: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("beta_users")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

// System Health
export async function getSystemHealth(): Promise<{ latency: number; realtime: string; db_status: string }> {
  const supabase = await getSupabase();

  const start = performance.now();
  const { error } = await supabase.from('turfs').select('id').limit(1);
  const latency = performance.now() - start;

  let realtimeStatus = 'Connecting...';
  try {
    const channel = supabase.channel('health_check');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 2000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          realtimeStatus = 'Connected';
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR') {
          realtimeStatus = 'Error';
          clearTimeout(timeout);
          reject(new Error("Channel Error"));
        }
      });
    });
    await supabase.removeChannel(channel);
  } catch (e) {
    realtimeStatus = 'Offline';
  }

  return {
    latency: Math.round(latency),
    realtime: realtimeStatus,
    db_status: error ? 'Error' : 'Healthy',
  };
}
