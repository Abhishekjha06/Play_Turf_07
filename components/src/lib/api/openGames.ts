import type { Booking } from "@/data/seed";
import type { OpenGame, CreateGamePayload, GamePlayer } from "@/types/openGames";
import { getSupabase, requireSupabase } from "../supabase";
import { me } from "./auth";
import { distanceKm } from "./turfs";

async function assertUser() {
  let currentUser = await me();
  if (!currentUser) {
    // Fallback: try getSession directly in case getUser() is slow
    const supabase = await getSupabase();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const u = session.user;
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name, phone")
          .eq("id", u.id)
          .maybeSingle();
        const userRole = profile?.role || "user";
        currentUser = {
          user_id: u.id,
          email: u.email || "",
          name: profile?.full_name || u.user_metadata?.full_name || u.user_metadata?.name || "Player",
          picture: u.user_metadata?.avatar_url || u.user_metadata?.picture || "",
          is_admin: userRole === "super_admin" || userRole === "admin",
          role: userRole,
        };
      }
    } catch (e) {
      console.warn("assertUser getSession fallback failed:", e);
    }
  }
  if (!currentUser) {
    throw new Error("Authentication required. Please sign in.");
  }
  return currentUser;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export async function listOpenGames(
  filters?: { sport?: string; date?: string; maxDistance?: number; userLocation?: { lat: number; lng: number } }
): Promise<OpenGame[]> {
  const supabase = await requireSupabase();

  let query = supabase.from("open_games").select("*");

  if (filters?.sport && filters.sport !== "All") {
    query = query.eq("sport", filters.sport);
  }
  if (filters?.date) {
    query = query.eq("date", filters.date);
  }

  const { data: gamesData, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  if (!gamesData || gamesData.length === 0) return [];

  const gameIds = gamesData.map((g) => g.id);
  const { data: playersData, error: playersErr } = await supabase
    .from("open_game_players")
    .select("*")
    .in("open_game_id", gameIds);

  if (playersErr) throw playersErr;

  let result = gamesData.map((g) => {
    const players = (playersData || [])
      .filter((p) => p.open_game_id === g.id)
      .map(toPlayer)
      .sort((a, b) => Number(b.is_host) - Number(a.is_host));
    return normalizeGameRow(g, players);
  });

  // Real distance filter
  if (filters?.maxDistance && filters?.userLocation) {
    result = result.filter((g) => {
      if (g.lat == null || g.lng == null) return true;
      const d = distanceKm(filters.userLocation, { lat: g.lat, lng: g.lng });
      g.distance = Number(d.toFixed(1));
      return d <= (filters.maxDistance ?? 10);
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// GET ONE
// ---------------------------------------------------------------------------

export async function getOpenGame(gameId: string): Promise<OpenGame | null> {
  const supabase = await requireSupabase();
  const { data: g, error } = await supabase.from("open_games").select("*").eq("id", gameId).maybeSingle();
  if (error) throw error;
  if (!g) return null;

  const { data: playersData } = await supabase
    .from("open_game_players")
    .select("*")
    .eq("open_game_id", gameId)
    .order("joined_at", { ascending: true });

  const players = (playersData || []).map(toPlayer).sort((a, b) => Number(b.is_host) - Number(a.is_host));
  return normalizeGameRow(g, players);
}

// ---------------------------------------------------------------------------
// HOST
// ---------------------------------------------------------------------------

export async function hostOpenGame(payload: CreateGamePayload): Promise<{ game: OpenGame; booking: Booking }> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const slotsTotal = Math.max(2, payload.slots_total);
  const totalAmount = Math.max(100, payload.total_amount);
  const pricePerSlot = Math.round(totalAmount / slotsTotal);
  const duration = Math.max(1, payload.duration_hours ?? 1);
  const time24 = convertTimeTo24(payload.time);

  const { data: turf } = await supabase.from("turfs").select("*").eq("id", payload.turf_id).maybeSingle();
  const turfId = payload.turf_id || turf?.id || "turf_1";
  const turfName = turf?.name || payload.venue;
  const turfImage = turf?.image || payload.turf_image || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200";

  const { data: result, error } = await supabase.rpc("host_open_game", {
    p_sport: payload.sport,
    p_turf_id: turfId,
    p_turf_name: turfName,
    p_turf_image: turfImage,
    p_date: payload.date,
    p_start_time: time24,
    p_duration_hours: duration,
    p_total_amount: totalAmount,
    p_slots_total: slotsTotal,
    p_is_private: payload.is_private ?? false,
    p_cancellation: payload.cancellation_policy || "Refundable up to 2 hours before start.",
    p_host_user_id: currentUser.user_id,
    p_host_name: currentUser.name,
    p_host_avatar: currentUser.picture,
    p_lat: payload.lat ?? turf?.lat ?? null,
    p_lng: payload.lng ?? turf?.lng ?? null,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique_active_booking")) {
      throw new Error("This slot has already been booked.");
    }
    throw new Error(msg);
  }
  if (!result?.ok) {
    const reason = result?.reason || "Failed to create game.";
    if (reason.toLowerCase().includes("duplicate") || reason.toLowerCase().includes("already booked")) {
      throw new Error("This slot has already been booked.");
    }
    throw new Error(reason);
  }

  const gameId: string = result.game_id;
  const realBookingId: string | null = result.booking_id ?? null;

  let booking: Booking | null = null;
  if (realBookingId) {
    const { data: b } = await supabase.from("bookings").select("*").eq("id", realBookingId).maybeSingle();
    if (b) {
      booking = {
        id: b.id,
        user_id: b.user_id,
        turf_id: b.turf_id,
        turf_name: b.turf_name,
        turf_image: b.turf_image,
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
        hours: b.hours,
        amount: b.amount,
        status: b.status,
        payment_id: b.payment_id,
        open_game_id: b.open_game_id,
        is_split_booking: b.is_split_booking,
        created_at: b.created_at,
      };
    }
  }

  if (!booking) {
    const [h, m] = time24.split(":").map(Number);
    const endHour = String((h + duration) % 24).padStart(2, "0");
    const endTime = `${endHour}:${String(m).padStart(2, "0")}`;
    booking = {
      id: realBookingId || `host_${gameId}`,
      user_id: currentUser.user_id,
      turf_id: turfId,
      turf_name: turfName,
      turf_image: turfImage,
      date: payload.date,
      start_time: time24,
      end_time: endTime,
      hours: duration,
      amount: pricePerSlot,
      status: "CONFIRMED",
      payment_id: `pay_${gameId}`,
      open_game_id: gameId,
      is_split_booking: false,
      created_at: new Date().toISOString(),
    };
  }

  const game = await getOpenGame(gameId);
  return { game: game ?? ({} as OpenGame), booking };
}

// ---------------------------------------------------------------------------
// JOIN (public game)
// ---------------------------------------------------------------------------

export async function joinOpenGame(gameId: string, paymentMethod = "UPI"): Promise<{ game: OpenGame; booking: Booking | null }> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("join_open_game", {
    p_game_id: gameId,
    p_user_id: currentUser.user_id,
    p_name: currentUser.name,
    p_avatar: currentUser.picture,
    p_payment_method: paymentMethod,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique_active_booking")) {
      throw new Error("This slot has already been booked.");
    }
    throw new Error(msg);
  }
  if (!result?.ok) {
    const reason = result?.reason || "Failed to join game.";
    if (reason.toLowerCase().includes("duplicate") || reason.toLowerCase().includes("already booked")) {
      throw new Error("This slot has already been booked.");
    }
    throw new RpcError(reason);
  }

  const bookingId: string | null = result.booking_id ?? null;
  const game = await getOpenGame(gameId);

  let booking: Booking | null = null;
  if (bookingId) {
    const { data: b } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (b) {
      booking = {
        id: b.id,
        user_id: b.user_id,
        turf_id: b.turf_id,
        turf_name: b.turf_name,
        turf_image: b.turf_image,
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
        hours: b.hours,
        amount: b.amount,
        status: b.status,
        payment_id: b.payment_id,
        open_game_id: b.open_game_id,
        is_split_booking: b.is_split_booking,
        created_at: b.created_at,
      };
    }
  }

  return { game: game ?? ({} as OpenGame), booking };
}

// ---------------------------------------------------------------------------
// REQUEST (private game)
// ---------------------------------------------------------------------------

export async function requestJoinOpenGame(gameId: string): Promise<{ game: OpenGame; ok: boolean }> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("request_join_open_game", {
    p_game_id: gameId,
    p_user_id: currentUser.user_id,
    p_name: currentUser.name,
    p_avatar: currentUser.picture,
  });
  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || "Failed to send request.");

  const game = await getOpenGame(gameId);
  return { game: game ?? ({} as OpenGame), ok: true };
}

// ---------------------------------------------------------------------------
// HOST: approve / reject request
// ---------------------------------------------------------------------------

export async function approveJoinRequest(
  gameId: string,
  playerId: string
): Promise<{ game: OpenGame; booking: Booking | null }> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("approve_join_request", {
    p_game_id: gameId,
    p_player_id: playerId,
    p_host_user_id: currentUser.user_id,
  });
  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || "Failed to approve.");

  const game = await getOpenGame(gameId);
  return { game: game ?? ({} as OpenGame), booking: null };
}

// ---------------------------------------------------------------------------
// REJECT REQUEST
// ---------------------------------------------------------------------------

export async function rejectJoinRequest(gameId: string, playerId: string): Promise<{ game: OpenGame; ok: boolean }> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("reject_join_request", {
    p_game_id: gameId,
    p_player_id: playerId,
    p_host_user_id: currentUser.user_id,
  });
  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || "Failed to reject.");

  const game = await getOpenGame(gameId);
  return { game: game ?? ({} as OpenGame), ok: true };
}

// ---------------------------------------------------------------------------
// LEAVE
// ---------------------------------------------------------------------------

export async function leaveOpenGame(gameId: string): Promise<OpenGame> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("leave_open_game", {
    p_game_id: gameId,
    p_user_id: currentUser.user_id,
  });
  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || "Failed to leave game.");

  const game = await getOpenGame(gameId);
  return game ?? ({} as OpenGame);
}

// ---------------------------------------------------------------------------
// CANCEL (host / admin)
// ---------------------------------------------------------------------------

export async function cancelOpenGame(gameId: string): Promise<OpenGame> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("cancel_open_game", {
    p_game_id: gameId,
    p_user_id: currentUser.user_id,
    p_is_admin: !!currentUser.is_admin,
  });
  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || "Failed to cancel game.");

  const game = await getOpenGame(gameId);
  return game ?? ({} as OpenGame);
}

// ---------------------------------------------------------------------------
// PAY PRIVATE GAME SHARE
// ---------------------------------------------------------------------------

export async function payPrivateGameShare(gameId: string, paymentMethod = "UPI"): Promise<{ game: OpenGame; booking: Booking | null }> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("pay_private_game_share", {
    p_game_id: gameId,
    p_user_id: currentUser.user_id,
    p_payment_method: paymentMethod,
  });

  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || "Failed to pay for game share.");

  const bookingId: string | null = result.booking_id ?? null;
  const game = await getOpenGame(gameId);

  let booking: Booking | null = null;
  if (bookingId) {
    const { data: b } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (b) {
      booking = {
        id: b.id,
        user_id: b.user_id,
        turf_id: b.turf_id,
        turf_name: b.turf_name,
        turf_image: b.turf_image,
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
        hours: b.hours,
        amount: b.amount,
        status: b.status,
        payment_id: b.payment_id,
        open_game_id: b.open_game_id,
        is_split_booking: b.is_split_booking,
        created_at: b.created_at,
      };
    }
  }

  return { game: game ?? ({} as OpenGame), booking };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function convertTimeTo24(timeStr: string): string {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return timeStr;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

function normalizeGameRow(g: any, players: GamePlayer[] = []): OpenGame {
  return {
    id: g.id,
    sport: g.sport,
    venue: g.venue,
    turf_id: g.turf_id ?? undefined,
    date: g.date,
    time: g.time,
    duration_hours: g.duration_hours ?? 1,
    price_per_slot: g.price_per_slot,
    total_amount: g.total_amount,
    slots_total: g.slots_total,
    slots_filled: g.slots_filled,
    status: g.status,
    distance: g.distance ?? 0,
    host_name: g.host_name,
    host_avatar: g.host_avatar ?? undefined,
    host_user_id: g.host_user_id,
    players,
    cancellation_policy: g.cancellation_policy ?? "",
    is_private: g.is_private ?? false,
    lat: g.lat ?? undefined,
    lng: g.lng ?? undefined,
  };
}

function toPlayer(p: any): GamePlayer {
  return {
    id: p.id,
    user_id: p.user_id,
    name: p.name,
    avatar: p.avatar ?? "",
    payment_status: p.payment_status,
    payment_method: p.payment_method ?? undefined,
    booking_id: p.booking_id ?? null,
    joined_at: p.joined_at,
    is_host: p.is_host ?? false,
  };
}

class RpcError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}
