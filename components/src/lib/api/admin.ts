import {
  banners as seedBanners,
  offers as seedOffers,
  tournaments as seedTournaments,
  type Turf,
  type Banner,
  type Offer,
  type Tournament,
  type Booking,
} from "@/data/seed";
import { getSupabase } from "../supabase";
import { USE_MOCK, delay, http, uid } from "./core";
import { getMockTurfs, setMockTurfs } from "./turfs";
import { getMockBanners, setMockBanners } from "./banners";
import { getMockBookings } from "./bookings";

export function getMockOffers(): Offer[] { return []; } // unused directly or imported via seed
export function setMockOffers(v: Offer[]) { }

export async function addTurf(t: Partial<Turf>, seedTurfsList: Turf[]): Promise<Turf> {
  const supabase = await getSupabase();
  if (supabase) {
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
  if (USE_MOCK) {
    const turf: Turf = {
      id: uid("turf"),
      name: t.name || "New Turf",
      city: t.city || "City",
      address: t.address || "Address",
      lat: t.lat,
      lng: t.lng,
      image: t.image || seedTurfsList[0]?.image || "",
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
    const next = [turf, ...getMockTurfs()];
    setMockTurfs(next);
    return turf;
  }
  return http<Turf>("/admin/turfs", { method: "POST", body: JSON.stringify(t) });
}

export async function updateTurf(id: string, patch: Partial<Turf>): Promise<Turf> {
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("turfs")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Turf;
  }
  if (USE_MOCK) {
    const list = getMockTurfs();
    const idx = list.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error("Turf not found");
    list[idx] = { ...list[idx], ...patch };
    setMockTurfs(list);
    return list[idx];
  }
  return http<Turf>(`/admin/turfs/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteTurf(id: string): Promise<void> {
  const supabase = await getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("turfs")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return;
  }
  if (USE_MOCK) { setMockTurfs(getMockTurfs().filter((t) => t.id !== id)); return; }
  await http<void>(`/admin/turfs/${id}`, { method: "DELETE" });
}

export async function addBanner(b: Partial<Banner>): Promise<Banner> {
  const supabase = await getSupabase();
  if (supabase) {
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
  if (USE_MOCK) {
    const banner: Banner = {
      id: uid("ban"), title: b.title || "Banner", highlight: b.highlight || "",
      subtitle: b.subtitle || "", image: b.image || seedBanners[0].image,
      badge: b.badge || "NEW", cta_text: b.cta_text || "Explore",
      cta_link: b.cta_link || "/", order: b.order ?? 99,
    };
    setMockBanners([...getMockBanners(), banner]);
    return banner;
  }
  return http<Banner>("/admin/banners", { method: "POST", body: JSON.stringify(b) });
}

export async function deleteBanner(id: string): Promise<void> {
  const supabase = await getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("banners")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return;
  }
  if (USE_MOCK) { setMockBanners(getMockBanners().filter((x) => x.id !== id)); return; }
  await http<void>(`/admin/banners/${id}`, { method: "DELETE" });
}

export async function addOffer(o: Partial<Offer>, seedOffersList: Offer[]): Promise<Offer> {
  const supabase = await getSupabase();
  if (supabase) {
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
  if (USE_MOCK) {
    const off: Offer = {
      id: uid("off"), title: o.title || "Offer", subtitle: o.subtitle || "",
      badge: o.badge || "DEAL", image: o.image || seedOffersList[0]?.image || "",
      discount: o.discount || "10%",
    };
    // seed offers are managed locally in seed file, no actual mock offers writable state stored in localstorage
    return off;
  }
  return http<Offer>("/admin/offers", { method: "POST", body: JSON.stringify(o) });
}

export async function deleteOffer(id: string): Promise<void> {
  const supabase = await getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("offers")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return;
  }
  if (USE_MOCK) { return; }
  await http<void>(`/admin/offers/${id}`, { method: "DELETE" });
}

export async function addTournament(t: Partial<Tournament>): Promise<Tournament> {
  const supabase = await getSupabase();
  if (supabase) {
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
  if (USE_MOCK) {
    const tnt: Tournament = {
      id: uid("tnt"), name: t.name || "Tournament", sport: t.sport || "Football",
      location: t.location || "City", image: t.image || seedTournaments[0].image,
      date: t.date || new Date().toISOString().slice(0, 10),
      prize_pool: t.prize_pool || "₹10,000", teams: t.teams ?? 8,
      entry_fee: t.entry_fee ?? 1000, description: t.description || "",
    };
    return tnt;
  }
  return http<Tournament>("/admin/tournaments", { method: "POST", body: JSON.stringify(t) });
}

export async function deleteTournament(id: string): Promise<void> {
  const supabase = await getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("tournaments")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return;
  }
  if (USE_MOCK) { return; }
  await http<void>(`/admin/tournaments/${id}`, { method: "DELETE" });
}

export async function listAllBookings(): Promise<Booking[]> {
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Booking[];
  }
  if (USE_MOCK) { await delay(100); return getMockBookings(); }
  return http<Booking[]>("/admin/bookings");
}
