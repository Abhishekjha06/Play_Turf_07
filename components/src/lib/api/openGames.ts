import type { Booking } from "@/data/seed";
import type { OpenGame, CreateGamePayload, GamePlayer } from "@/types/openGames";
import { requireSupabase } from "../supabase";
import { me } from "./auth";
import { distanceKm } from "./turfs";

async function assertUser() {
  const currentUser = await me();
  if (!currentUser) {
    throw new Error("Authentication required. Please sign in.");
  }
  return currentUser;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

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
  const duration =
    g.end_time && g.start_time
      ? computeDuration(g.start_time, g.end_time)
      : g.duration_hours ?? 1;

  return {
    id: g.id,
    sport: g.sport,
    venue: g.title || g.turf?.name || g.venue || "Turf",
    turf_id: g.turf_id ?? undefined,
    date: g.date,
    time: g.start_time || g.time,
    duration_hours: duration,
    price_per_slot: g.price_per_player || g.price_per_slot,
    total_amount: g.total_amount || (g.price_per_player * g.max_players),
    slots_total: g.max_players || g.slots_total,
    slots_filled: g.joined_players || g.slots_filled,
    status: g.status,
    distance: g.distance ?? 0,
    host_name: g.host_name || g.host?.full_name || "Host",
    host_avatar: g.host_avatar || g.host?.avatar || undefined,
    host_user_id: g.host_id || g.host_user_id,
    players,
    cancellation_policy: g.description || g.cancellation_policy || "",
    is_private: g.visibility === "private" || g.is_private,
    lat: g.turf?.lat ?? g.lat ?? undefined,
    lng: g.turf?.lng ?? g.lng ?? undefined,
  };
}

function toPlayer(p: any, hostId?: string): GamePlayer {
  return {
    id: p.id,
    user_id: p.user_id,
    name: p.profile?.full_name || p.name || "Player",
    avatar: p.avatar || "",
    payment_status: p.payment_status,
    payment_method: p.payment_method || undefined,
    booking_id: p.booking_id || null,
    joined_at: p.joined_at,
    is_host: hostId ? p.user_id === hostId : false,
  };
}

class RpcError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export async function listOpenGames(
  filters?: { sport?: string; date?: string; maxDistance?: number; userLocation?: { lat: number; lng: number } }
): Promise<OpenGame[]> {
  const supabase = await requireSupabase();

  let query = supabase
    .from("games")
    .select(`*, turf:turfs(name, image, lat, lng)`)
    .in("status", ["open", "full"]);

  if (filters?.sport && filters.sport !== "All") {
    query = query.eq("sport", filters.sport);
  }
  if (filters?.date) {
    query = query.eq("date", filters.date);
  }

  const { data: gamesData, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  if (!gamesData || gamesData.length === 0) return [];

  const gameIds = gamesData.map((g: any) => g.id);
  const { data: playersData, error: playersErr } = await supabase
    .from("game_players")
    .select(`*, profile:profiles(full_name)`)
    .in("game_id", gameIds);

  if (playersErr) throw playersErr;

  let result = gamesData.map((g: any) => {
    const players = (playersData || [])
      .filter((p: any) => p.game_id === g.id)
      .map((p: any) => toPlayer(p, g.host_id))
      .sort((a: GamePlayer, b: GamePlayer) => Number(b.is_host) - Number(a.is_host));
    return normalizeGameRow(g, players);
  });

  if (filters?.maxDistance && filters?.userLocation) {
    result = result.filter((g: OpenGame) => {
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
  const { data: g, error } = await supabase
    .from("games")
    .select(`*, turf:turfs(name, image, lat, lng)`)
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw error;
  if (!g) return null;

  const { data: playersData } = await supabase
    .from("game_players")
    .select(`*, profile:profiles(full_name)`)
    .eq("game_id", gameId)
    .order("joined_at", { ascending: true });

  const players = (playersData || [])
    .map((p: any) => toPlayer(p, g.host_id))
    .sort((a: GamePlayer, b: GamePlayer) => Number(b.is_host) - Number(a.is_host));
  return normalizeGameRow(g, players);
}

// ---------------------------------------------------------------------------
// GET GAME BY BOOKING ID
// ---------------------------------------------------------------------------

export async function getGameByBookingId(bookingId: string): Promise<OpenGame | null> {
  const supabase = await requireSupabase();
  const { data: game, error } = await supabase
    .from("games")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error || !game) return null;
  return getOpenGame(game.id);
}

// ---------------------------------------------------------------------------
// HOST
// ---------------------------------------------------------------------------

export async function hostOpenGame(payload: CreateGamePayload): Promise<{ game: OpenGame; booking: Booking }> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const slotsTotal = Math.max(2, payload.slots_total);
  const totalAmount = Math.max(100, payload.total_amount);
  const pricePerPlayer = Math.round(totalAmount / slotsTotal);
  const duration = Math.max(1, payload.duration_hours ?? 1);
  const time24 = convertTimeTo24(payload.time);

  const { data: turf } = await supabase.from("turfs").select("*").eq("id", payload.turf_id).maybeSingle();
  const turfId = payload.turf_id || turf?.id || "turf_1";
  const turfName = turf?.name || payload.venue;
  const turfImage =
    turf?.image ||
    payload.turf_image ||
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200";

  const isPrivate = payload.is_private ?? false;
  const rpcName = isPrivate ? "host_private_game" : "host_public_game";

  const { data: result, error } = await supabase.rpc(rpcName, {
    p_turf_id: turfId,
    p_date: payload.date,
    p_start_time: time24,
    p_hours: duration,
    p_sport: payload.sport,
    p_title: payload.venue,
    p_description: payload.cancellation_policy || "",
    p_max_players: slotsTotal,
    p_price_per_player: pricePerPlayer,
    p_allow_waitlist: true,
    p_allow_invites: true,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique_active_booking")) {
      throw new Error("This slot has already been booked.");
    }
    throw new Error(msg);
  }
  if (!result?.ok) {
    const reason = result?.reason || result?.error || "Failed to create game.";
    if (reason.toLowerCase().includes("duplicate") || reason.toLowerCase().includes("already booked") || reason.toLowerCase().includes("slot already")) {
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
      amount: pricePerPlayer,
      status: "confirmed",
      payment_id: `pay_${gameId}`,
      created_at: new Date().toISOString(),
    };
  }

  const game = await getOpenGame(gameId);
  return { game: game ?? ({} as OpenGame), booking };
}

// ---------------------------------------------------------------------------
// JOIN (public game)
// ---------------------------------------------------------------------------

export async function joinOpenGame(gameId: string, _paymentMethod = "UPI"): Promise<{ game: OpenGame; booking: Booking | null }> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("join_public_game", {
    p_game_id: gameId,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique_active_booking")) {
      throw new Error("This slot has already been booked.");
    }
    throw new Error(msg);
  }
  if (!result?.ok) {
    const reason = result?.reason || result?.error || "Failed to join game.";
    if (reason.toLowerCase().includes("duplicate") || reason.toLowerCase().includes("already booked")) {
      throw new Error("This slot has already been booked.");
    }
    throw new RpcError(reason);
  }

  const game = await getOpenGame(gameId);
  return { game: game ?? ({} as OpenGame), booking: null };
}

// ---------------------------------------------------------------------------
// REQUEST (private game)
// ---------------------------------------------------------------------------

export async function requestJoinOpenGame(gameId: string): Promise<{ game: OpenGame; ok: boolean }> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("request_join_private_game", {
    p_game_id: gameId,
  });
  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || result?.error || "Failed to send request.");

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

  const { data: result, error } = await supabase.rpc("approve_player_request", {
    p_game_id: gameId,
    p_player_id: playerId,
  });
  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || result?.error || "Failed to approve.");

  const game = await getOpenGame(gameId);
  return { game: game ?? ({} as OpenGame), booking: null };
}

// ---------------------------------------------------------------------------
// REJECT REQUEST
// ---------------------------------------------------------------------------

export async function rejectJoinRequest(gameId: string, playerId: string): Promise<{ game: OpenGame; ok: boolean }> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("reject_player_request", {
    p_game_id: gameId,
    p_player_id: playerId,
  });
  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || result?.error || "Failed to reject.");

  const game = await getOpenGame(gameId);
  return { game: game ?? ({} as OpenGame), ok: true };
}

// ---------------------------------------------------------------------------
// LEAVE
// ---------------------------------------------------------------------------

export async function leaveOpenGame(gameId: string): Promise<OpenGame> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("leave_game", {
    p_game_id: gameId,
  });
  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || result?.error || "Failed to leave game.");

  const game = await getOpenGame(gameId);
  return game ?? ({} as OpenGame);
}

// ---------------------------------------------------------------------------
// CANCEL (host / admin)
// ---------------------------------------------------------------------------

export async function cancelOpenGame(gameId: string): Promise<OpenGame> {
  const currentUser = await assertUser();
  const supabase = await requireSupabase();

  const { data: result, error } = await supabase.rpc("cancel_game", {
    p_game_id: gameId,
  });
  if (error) throw new Error(error.message);
  if (!result?.ok) throw new RpcError(result?.reason || result?.error || "Failed to cancel game.");

  const game = await getOpenGame(gameId);
  return game ?? ({} as OpenGame);
}

// ---------------------------------------------------------------------------
// PAY PRIVATE GAME SHARE
// ---------------------------------------------------------------------------

export async function payPrivateGameShare(
  gameId: string,
  _paymentMethod = "UPI"
): Promise<{ game: OpenGame; booking: Booking | null }> {
  // Payment flow is not yet implemented in v1.0 backend.
  // For now, return the game without a booking.
  const game = await getOpenGame(gameId);
  return { game: game ?? ({} as OpenGame), booking: null };
}
