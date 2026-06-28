import { openGames as initialGames, turfs as seedTurfs, type Booking, type Turf } from "@/data/seed";
import type { OpenGame, CreateGamePayload, GamePlayer } from "@/types/openGames";
import { getSupabase } from "../supabase";
import { me } from "./auth";
import { getMockBookings, setMockBookings } from "./bookings";
import { getMockTurfs } from "./turfs";
import { distanceKm } from "./turfs";
import { uid } from "./core";
import { addNotification } from "../notifications";

// Bump this whenever the seed data changes so stale localStorage is refreshed.
const OPEN_GAMES_SEED_VERSION = 5;
const SEED_VERSION_KEY = "playturf:open_games_seed_version";

// ... rest of the file

// Local storage fallback for mock mode (allows sharing data across tabs/windows)
export function getLocalGames(): OpenGame[] {
  // If the seed version changed (or this is a first run), re-seed from the
  // latest initialGames so schema fixes (e.g. newly added turf_id) propagate
  // without requiring the user to clear their browser cache.
  const storedVersion = Number(localStorage.getItem(SEED_VERSION_KEY) || 0);
  const needsReseed = storedVersion !== OPEN_GAMES_SEED_VERSION;

  try {
    const stored = localStorage.getItem("playturf:open_games");
    if (stored && !needsReseed) {
      // Fresh cache matching current seed version — use as-is.
      return JSON.parse(stored);
    }
    if (stored && needsReseed) {
      // Stale cache. Preserve any games the USER created (ids not in the seed)
      // but overwrite the seeded ones with the latest definitions so schema
      // updates (turf_id, etc.) take effect.
      const cached: OpenGame[] = JSON.parse(stored);
      const seedIds = new Set(initialGames.map((g) => g.id));
      const userCreated = cached.filter((g) => !seedIds.has(g.id));
      const merged = [...initialGames, ...userCreated];
      localStorage.setItem("playturf:open_games", JSON.stringify(merged));
      localStorage.setItem(SEED_VERSION_KEY, String(OPEN_GAMES_SEED_VERSION));
      return merged;
    }
  } catch (e) {
    console.warn("Failed to parse local open games:", e);
  }
  // Initialize localStorage if it doesn't exist
  try {
    localStorage.setItem("playturf:open_games", JSON.stringify(initialGames));
    localStorage.setItem(SEED_VERSION_KEY, String(OPEN_GAMES_SEED_VERSION));
  } catch {}
  return [...initialGames];
}

export function saveLocalGames(games: OpenGame[]) {
  try {
    localStorage.setItem("playturf:open_games", JSON.stringify(games));
    // Dispatch custom event to notify listeners in the same window
    window.dispatchEvent(new CustomEvent("playturf:open_games_updated"));
  } catch (e) {
    console.warn("Failed to save local open games:", e);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate that a game date/time is not in the past. */
function validateGameSlot(date: string, time: string, durationHours = 1): { ok: boolean; reason?: string } {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA");
  
  // Parse slot time
  const [h, m] = time.split(":").map(Number);
  const slotDate = new Date(date);
  slotDate.setHours(h, m, 0, 0);
  const slotEnd = new Date(slotDate.getTime() + durationHours * 60 * 60 * 1000);
  
  // Past date check
  if (date < todayStr) {
    return { ok: false, reason: "Booking is not available for past dates. Please select a valid date." };
  }
  
  // Same-day expired slot check
  if (date === todayStr) {
    if (slotDate <= now) {
      return { ok: false, reason: "This slot has already started. Please select a future time." };
    }
  }
  
  // Game already ended
  if (slotEnd < now) {
    return { ok: false, reason: "This game has already ended." };
  }
  
  return { ok: true };
}

/** Check if a user has already joined or requested a game. */
function checkDuplicateJoin(game: OpenGame, userId: string): boolean {
  return game.players.some(
    (p) => p.user_id === userId && ["paid", "requested", "approved"].includes(p.payment_status)
  );
}

/** Check if user is the host. */
function isHost(game: OpenGame, userId: string): boolean {
  return game.host_user_id === userId;
}

/** Convert "07:00 PM" → "19:00". Leaves 24h strings unchanged. */
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

/** Normalize a raw open_games row from Supabase into the OpenGame shape. */
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

/** Map a players row to the GamePlayer shape. */
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

/** Throw a user-friendly error for an RPC result `{ ok:false, reason }`. */
class RpcError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

async function assertUser() {
  const currentUser = await me();
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
  const supabase = await getSupabase();

  if (supabase) {
    try {
      let query = supabase.from("open_games").select("*");

      if (filters?.sport && filters.sport !== "All") {
        query = query.eq("sport", filters.sport);
      }
      if (filters?.date) {
        query = query.eq("date", filters.date);
      }
      // NOTE: distance filtering is done client-side after computing real
      // haversine distance from the turf coordinates, NOT from the stored
      // `distance` column (which was random in the old code).

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
          if (g.lat == null || g.lng == null) return true; // keep legacy rows
          const d = distanceKm(filters.userLocation, { lat: g.lat, lng: g.lng });
          g.distance = Number(d.toFixed(1));
          return d <= (filters.maxDistance ?? 10);
        });
      }

      return result;
    } catch (e) {
      console.warn("Supabase listOpenGames failed, falling back to mock:", e);
    }
  }

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 300));
  let result = getLocalGames();
  if (filters?.sport && filters.sport !== "All") {
    result = result.filter((g) => g.sport.toLowerCase() === filters.sport?.toLowerCase());
  }
  if (filters?.date) {
    result = result.filter((g) => g.date === filters.date);
  }
  if (filters?.maxDistance) {
    result = result.filter((g) => g.distance <= (filters.maxDistance ?? 10));
  }
  return result;
}

// ---------------------------------------------------------------------------
// GET ONE
// ---------------------------------------------------------------------------

export async function getOpenGame(gameId: string): Promise<OpenGame | null> {
  const supabase = await getSupabase();
  if (supabase) {
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
  await new Promise((resolve) => setTimeout(resolve, 120));
  return getLocalGames().find((g) => g.id === gameId) ?? null;
}

// ---------------------------------------------------------------------------
// HOST
// ---------------------------------------------------------------------------

export async function hostOpenGame(payload: CreateGamePayload): Promise<{ game: OpenGame; booking: Booking }> {
  const currentUser = await assertUser();
  const supabase = await getSupabase();

  const slotsTotal = Math.max(2, payload.slots_total);
  const totalAmount = Math.max(100, payload.total_amount);
  const pricePerSlot = Math.round(totalAmount / slotsTotal);
  const duration = Math.max(1, payload.duration_hours ?? 1);
  const time24 = convertTimeTo24(payload.time);

  if (supabase) {
    // Resolve the turf + image directly by id (no fuzzy name matching).
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

    if (error) throw new Error(error.message);
    if (!result?.ok) throw new Error(result?.reason || "Failed to create game.");

    const gameId: string = result.game_id;
    const realBookingId: string | null = result.booking_id ?? null;

    // Fetch the REAL host booking that the RPC created (the old code
    // fabricated a fake "host_<gameId>" id, which made /booking/:id 404).
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

    // Fallback client-side booking object ONLY if the row couldn't be read back.
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

  // ---- Mock fallback ----
  await new Promise((resolve) => setTimeout(resolve, 600));

  // Date/Time validation (already computed: slotsTotal, totalAmount, duration, time24)
  const slotCheck = validateGameSlot(payload.date, time24, duration);
  if (!slotCheck.ok) throw new Error(slotCheck.reason!);

  const matchedTurf = getMockTurfs().find((t) => t.id === payload.turf_id) || getMockTurfs()[0];
  const turfId = matchedTurf?.id || "turf_1";
  const turfName = matchedTurf?.name || payload.venue;
  const turfImage = matchedTurf?.image || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200";

  const [h, m] = time24.split(":").map(Number);
  const endHour = String((h + duration) % 24).padStart(2, "0");
  const endTime = `${endHour}:${String(m).padStart(2, "0")}`;

  // Expiry check
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (payload.date === todayStr) {
    const now = new Date();
    if (now.getHours() > h || (now.getHours() === h && now.getMinutes() > m)) {
      throw new Error("This slot has already expired and cannot be booked.");
    }
  }

  // Overlap check
  const newStartMins = h * 60 + m;
  const newEndMins = newStartMins + duration * 60;
  
  const isOverlap = getMockBookings().some((b) => {
    if (b.turf_id !== turfId || b.date !== payload.date || b.status === "CANCELLED" || b.is_split_booking) {
      return false;
    }
    const [bh, bm] = b.start_time.split(":").map(Number);
    const bStartMins = bh * 60 + bm;
    const bEndMins = bStartMins + b.hours * 60;
    return (newStartMins < bEndMins && newEndMins > bStartMins);
  });

  if (isOverlap) {
    throw new Error("One or more slots in this time range are already booked.");
  }

  const bookingId = uid("bkg");

  const newGame: OpenGame = {
    id: uid("game"),
    sport: payload.sport,
    venue: turfName,
    turf_id: turfId,
    date: payload.date,
    time: time24,
    duration_hours: duration,
    price_per_slot: pricePerSlot,
    total_amount: totalAmount,
    slots_total: slotsTotal,
    slots_filled: 1,
    status: "open",
    distance: matchedTurf ? Number((Math.random() * 4 + 0.3).toFixed(1)) : 0,
    host_name: currentUser.name,
    host_avatar: currentUser.picture,
    host_user_id: currentUser.user_id,
    players: [
      {
        id: uid("gp"),
        user_id: currentUser.user_id,
        name: currentUser.name,
        avatar: currentUser.picture,
        payment_status: "paid",
        payment_method: "Host",
        booking_id: bookingId,
        joined_at: new Date().toISOString(),
        is_host: true,
      },
    ],
    cancellation_policy: payload.cancellation_policy || "Refundable up to 2 hours before start.",
    is_private: payload.is_private,
    lat: matchedTurf?.lat,
    lng: matchedTurf?.lng,
  };

  const newBooking: Booking = {
    id: bookingId,
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
    payment_id: uid("pay"),
    open_game_id: newGame.id,
    is_split_booking: false,
    created_at: new Date().toISOString(),
  };

  setMockBookings([newBooking, ...getMockBookings()]);
  const current = getLocalGames();
  current.unshift(newGame);
  saveLocalGames(current);
  return { game: newGame, booking: newBooking };
}

// ---------------------------------------------------------------------------
// JOIN (public game)
// ---------------------------------------------------------------------------

export async function joinOpenGame(gameId: string, paymentMethod = "UPI"): Promise<{ game: OpenGame; booking: Booking | null }> {
  const currentUser = await assertUser();
  const supabase = await getSupabase();

  if (supabase) {
    const { data: result, error } = await supabase.rpc("join_open_game", {
      p_game_id: gameId,
      p_user_id: currentUser.user_id,
      p_name: currentUser.name,
      p_avatar: currentUser.picture,
      p_payment_method: paymentMethod,
    });

    if (error) throw new Error(error.message);
    if (!result?.ok) throw new RpcError(result?.reason || "Failed to join game.");

    const bookingId: string | null = result.booking_id ?? null;
    const game = await getOpenGame(gameId);

    let booking: Booking | null = null;
    if (bookingId) {
      // Fetch the freshly created booking.
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

  // ---- Mock fallback ----
  await new Promise((resolve) => setTimeout(resolve, 800));
  const currentGames = getLocalGames();
  const game = currentGames.find((g) => g.id === gameId);
  if (!game) throw new Error("Game not found.");
  if (game.status === "cancelled") throw new Error("Cannot join a cancelled game.");
  if (game.is_private) throw new Error("This is a private game. Use the request flow.");
  if (game.slots_filled >= game.slots_total) throw new Error("This game is already full.");
  
  // Validate date/time hasn't expired
  const slotCheck = validateGameSlot(game.date, game.time, game.duration_hours);
  if (!slotCheck.ok) throw new Error(slotCheck.reason!);
  
  // Check if user is host
  if (isHost(game, currentUser.user_id)) {
    throw new Error("You are the host of this game.");
  }
  
  // Duplicate join check (by user_id, not just name)
  if (checkDuplicateJoin(game, currentUser.user_id)) {
    throw new Error("You have already joined or requested this game.");
  }

  const bookingId = uid("bkg");
  const [h, m] = game.time.split(":").map(Number);
  const duration = game.duration_hours ?? 1;
  const endHour = String((h + duration) % 24).padStart(2, "0");
  const endTime = `${endHour}:${String(m).padStart(2, "0")}`;

  const matchedTurf = getMockTurfs().find((t) => t.id === game.turf_id) || getMockTurfs()[0];
  const newBooking: Booking = {
    id: bookingId,
    user_id: currentUser.user_id,
    turf_id: game.turf_id || matchedTurf?.id || "turf_1",
    turf_name: game.venue,
    turf_image: matchedTurf?.image || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200",
    date: game.date,
    start_time: game.time,
    end_time: endTime,
    hours: duration,
    amount: game.price_per_slot,
    status: "CONFIRMED",
    payment_id: uid("pay"),
    open_game_id: game.id,
    is_split_booking: true,
    created_at: new Date().toISOString(),
  };

  game.slots_filled += 1;
  game.players.push({
    id: uid("gp"),
    user_id: currentUser.user_id,
    name: currentUser.name,
    avatar: currentUser.picture,
    payment_status: "paid",
    payment_method: paymentMethod,
    booking_id: bookingId,
    joined_at: new Date().toISOString(),
    is_host: false,
  });
  if (game.slots_filled >= game.slots_total) game.status = "full";

  saveLocalGames(currentGames);
  setMockBookings([newBooking, ...getMockBookings()]);
  return { game: { ...game }, booking: newBooking };
}

// ---------------------------------------------------------------------------
// REQUEST (private game)
// ---------------------------------------------------------------------------

export async function requestJoinOpenGame(gameId: string): Promise<{ game: OpenGame; ok: boolean }> {
  const currentUser = await assertUser();
  const supabase = await getSupabase();

  if (supabase) {
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

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 500));
  const currentGames = getLocalGames();
  const game = currentGames.find((g) => g.id === gameId);
  if (!game) throw new Error("Game not found.");
  if (!game.is_private) throw new Error("This is a public game. Use direct join instead.");
  if (game.slots_filled >= game.slots_total) throw new Error("This game is already full.");
  
  // Validate date/time
  const slotCheck = validateGameSlot(game.date, game.time, game.duration_hours);
  if (!slotCheck.ok) throw new Error(slotCheck.reason!);
  
  // Host cannot request own game
  if (isHost(game, currentUser.user_id)) {
    throw new Error("You are the host of this game.");
  }
  
  if (checkDuplicateJoin(game, currentUser.user_id)) {
    throw new Error("You have already joined or requested this game.");
  }
  game.players.push({
    id: uid("gp"),
    user_id: currentUser.user_id,
    name: currentUser.name,
    avatar: currentUser.picture,
    payment_status: "requested",
    joined_at: new Date().toISOString(),
    is_host: false,
  });
  saveLocalGames(currentGames);
  return { game: { ...game }, ok: true };
}

// ---------------------------------------------------------------------------
// HOST: approve / reject request
// ---------------------------------------------------------------------------

export async function approveJoinRequest(
  gameId: string,
  playerId: string
): Promise<{ game: OpenGame; booking: Booking | null }> {
  const currentUser = await assertUser();
  const supabase = await getSupabase();

  if (supabase) {
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

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 300));
  const currentGames = getLocalGames();
  const game = currentGames.find((g) => g.id === gameId);
  if (!game) throw new Error("Game not found.");
  if (game.host_user_id !== currentUser.user_id) throw new Error("Only the host can approve requests.");

  const player = game.players.find((p) => p.id === playerId && p.payment_status === "requested");
  if (!player) throw new Error("No such pending request.");

  if (game.slots_filled >= game.slots_total) throw new Error("Game is full — cannot approve.");
  game.slots_filled += 1;
  player.payment_status = "approved";
  if (game.slots_filled >= game.slots_total) game.status = "full";

  saveLocalGames(currentGames);
  return { game: { ...game }, booking: null };
}

export async function rejectJoinRequest(gameId: string, playerId: string): Promise<{ game: OpenGame; ok: boolean }> {
  const currentUser = await assertUser();
  const supabase = await getSupabase();

  if (supabase) {
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

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 300));
  const currentGames = getLocalGames();
  const game = currentGames.find((g) => g.id === gameId);
  if (!game) throw new Error("Game not found.");
  if (game.host_user_id !== currentUser.user_id) throw new Error("Only the host can reject requests.");
  
  const idx = game.players.findIndex((p) => p.id === playerId && (p.payment_status === "requested" || p.payment_status === "approved"));
  if (idx === -1) throw new Error("No such request.");
  const player = game.players[idx];
  
  if (player.payment_status === "approved") {
    game.slots_filled = Math.max(0, game.slots_filled - 1);
    if (game.status === "full" && game.slots_filled < game.slots_total) {
      game.status = "open";
    }
  }
  
  game.players.splice(idx, 1);
  saveLocalGames(currentGames);
  return { game: { ...game }, ok: true };
}

// ---------------------------------------------------------------------------
// LEAVE
// ---------------------------------------------------------------------------

export async function leaveOpenGame(gameId: string): Promise<OpenGame> {
  const currentUser = await assertUser();
  const supabase = await getSupabase();

  if (supabase) {
    const { data: result, error } = await supabase.rpc("leave_open_game", {
      p_game_id: gameId,
      p_user_id: currentUser.user_id,
    });
    if (error) throw new Error(error.message);
    if (!result?.ok) throw new RpcError(result?.reason || "Failed to leave game.");

    const game = await getOpenGame(gameId);
    return game ?? ({} as OpenGame);
  }

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 400));
  const currentGames = getLocalGames();
  const game = currentGames.find((g) => g.id === gameId);
  if (!game) throw new Error("Game not found.");
  const idx = game.players.findIndex((p) => p.name === currentUser.name);
  if (idx === -1) throw new Error("You are not part of this game.");
  const player = game.players[idx];
  if (player.is_host) throw new Error("Host cannot leave. Cancel the game instead.");

  // Cancel linked booking
  if (player.booking_id) {
    const list = getMockBookings();
    const bidx = list.findIndex((b) => b.id === player.booking_id);
    if (bidx > -1) {
      list[bidx] = { ...list[bidx], status: "CANCELLED" };
      setMockBookings(list);
    }
  }

  game.players.splice(idx, 1);
  if (player.payment_status !== "requested") {
    game.slots_filled = Math.max(0, game.slots_filled - 1);
    if (game.status === "full" && game.slots_filled < game.slots_total) game.status = "open";
  }
  saveLocalGames(currentGames);
  return { ...game };
}

// ---------------------------------------------------------------------------
// CANCEL (host / admin)
// ---------------------------------------------------------------------------

export async function cancelOpenGame(gameId: string): Promise<OpenGame> {
  const currentUser = await assertUser();
  const supabase = await getSupabase();

  if (supabase) {
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

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 400));
  const currentGames = getLocalGames();
  const game = currentGames.find((g) => g.id === gameId);
  if (!game) throw new Error("Game not found.");
  if (game.host_user_id !== currentUser.user_id && !currentUser.is_admin) {
    throw new Error("Only the host can cancel this game.");
  }
  game.status = "cancelled";

  // Cancel all linked bookings
  const list = getMockBookings();
  let changed = false;
  for (let i = 0; i < list.length; i++) {
    if (list[i].open_game_id === gameId && list[i].status !== "CANCELLED") {
      list[i] = { ...list[i], status: "CANCELLED" };
      changed = true;
    }
  }
  if (changed) setMockBookings(list);
  saveLocalGames(currentGames);
  return { ...game };
}

// ---------------------------------------------------------------------------
// PAY PRIVATE GAME SHARE (private game)
// ---------------------------------------------------------------------------

export async function payPrivateGameShare(gameId: string, paymentMethod = "UPI"): Promise<{ game: OpenGame; booking: Booking | null }> {
  const currentUser = await assertUser();
  const supabase = await getSupabase();

  if (supabase) {
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

  // ---- Mock fallback ----
  await new Promise((resolve) => setTimeout(resolve, 600));
  const currentGames = getLocalGames();
  const game = currentGames.find((g) => g.id === gameId);
  if (!game) throw new Error("Game not found.");
  const player = game.players.find((p) => p.user_id === currentUser.user_id);
  if (!player) throw new Error("Player request not found.");
  if (player.payment_status === "paid") throw new Error("Already paid.");
  if (player.payment_status !== "approved") throw new Error("Request is not approved by host yet.");

  const bookingId = uid("bkg");
  const [h, m] = game.time.split(":").map(Number);
  const duration = game.duration_hours ?? 1;
  const endHour = String((h + duration) % 24).padStart(2, "0");
  const endTime = `${endHour}:${String(m).padStart(2, "0")}`;

  const matchedTurf = getMockTurfs().find((t) => t.id === game.turf_id) || getMockTurfs()[0];
  const newBooking: Booking = {
    id: bookingId,
    user_id: currentUser.user_id,
    turf_id: game.turf_id || matchedTurf?.id || "turf_1",
    turf_name: game.venue,
    turf_image: matchedTurf?.image || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200",
    date: game.date,
    start_time: game.time,
    end_time: endTime,
    hours: duration,
    amount: game.price_per_slot,
    status: "CONFIRMED",
    payment_id: uid("pay"),
    open_game_id: game.id,
    is_split_booking: true,
    created_at: new Date().toISOString(),
  };

  player.payment_status = "paid";
  player.payment_method = paymentMethod;
  player.booking_id = bookingId;

  saveLocalGames(currentGames);
  setMockBookings([newBooking, ...getMockBookings()]);
  return { game: { ...game }, booking: newBooking };
}
