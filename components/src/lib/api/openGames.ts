import { openGames as initialGames } from "@/data/seed";
import type { OpenGame, CreateGamePayload } from "@/types/openGames";
import { getSupabase } from "../supabase";
import { me } from "./auth";

// Maintain a fallback mutable in-memory copy of games during session
const localGames = [...initialGames];

export async function listOpenGames(filters?: { sport?: string; date?: string; maxDistance?: number }): Promise<OpenGame[]> {
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
      if (filters?.maxDistance) {
        query = query.lte("distance", filters.maxDistance);
      }
      
      const { data, error } = await query;
      if (!error && data) {
        return data as OpenGame[];
      }
      if (error) {
        console.warn("Supabase open_games query error, falling back:", error);
      }
    } catch (e) {
      console.warn("Failed to query open_games from Supabase, falling back:", e);
    }
  }

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 300));
  let result = [...localGames];
  if (filters?.sport && filters.sport !== "All") {
    result = result.filter(g => g.sport.toLowerCase() === filters.sport?.toLowerCase());
  }
  if (filters?.date) {
    result = result.filter(g => g.date === filters.date);
  }
  if (filters?.maxDistance) {
    result = result.filter(g => g.distance <= (filters.maxDistance ?? 10));
  }
  return result;
}

export async function joinOpenGame(gameId: string): Promise<OpenGame> {
  const supabase = await getSupabase();
  const currentUser = await me();
  if (!currentUser) {
    throw new Error("Authentication required to join a game.");
  }

  if (supabase) {
    try {
      // 1. Fetch current game
      const { data: game, error: fetchErr } = await supabase
        .from("open_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (fetchErr) throw fetchErr;
      if (!game) throw new Error("Game not found.");
      if (game.status === "cancelled") throw new Error("Cannot join a cancelled game.");
      if (game.slots_filled >= game.slots_total) throw new Error("This game is already full.");

      const playersList = Array.isArray(game.players) ? game.players : JSON.parse(game.players || "[]");
      const alreadyJoined = playersList.some((p: any) => p.name === currentUser.name);
      if (alreadyJoined) throw new Error("You have already joined this game.");

      // 2. Perform atomic slot join update
      const isPrivate = game.is_private;
      const newSlotsFilled = isPrivate ? game.slots_filled : game.slots_filled + 1;
      const newPlayers = isPrivate ? game.players : [...playersList, { name: currentUser.name, avatar: currentUser.picture }];
      const newStatus = newSlotsFilled >= game.slots_total ? "full" : "open";

      const { data: updatedGame, error: updateErr } = await supabase
        .from("open_games")
        .update({
          slots_filled: newSlotsFilled,
          players: newPlayers,
          status: newStatus
        })
        .eq("id", gameId)
        .select()
        .single();

      if (updateErr) throw updateErr;
      return updatedGame as OpenGame;
    } catch (e) {
      console.warn("Supabase joinOpenGame failed, falling back to local memory:", e);
    }
  }

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 800));
  const game = localGames.find(g => g.id === gameId);
  if (!game) throw new Error("Game not found.");
  if (game.status === "cancelled") throw new Error("Cannot join a cancelled game.");
  if (game.slots_filled >= game.slots_total) throw new Error("This game is already full.");

  const alreadyJoined = game.players.some(p => p.name === currentUser.name);
  if (alreadyJoined) throw new Error("You have already joined this game.");

  if (!game.is_private) {
    game.slots_filled += 1;
    game.players.push({
      name: currentUser.name,
      avatar: currentUser.picture
    });

    if (game.slots_filled >= game.slots_total) {
      game.status = "full";
    }
  }

  return { ...game };
}

export async function leaveOpenGame(gameId: string): Promise<OpenGame> {
  const supabase = await getSupabase();
  const currentUser = await me();
  if (!currentUser) {
    throw new Error("Authentication required to leave a game.");
  }

  if (supabase) {
    try {
      const { data: game, error: fetchErr } = await supabase
        .from("open_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (fetchErr) throw fetchErr;
      if (!game) throw new Error("Game not found.");

      const playersList = Array.isArray(game.players) ? game.players : JSON.parse(game.players || "[]");
      const idx = playersList.findIndex((p: any) => p.name === currentUser.name);
      if (idx === -1) throw new Error("You are not part of this game.");

      playersList.splice(idx, 1);
      const newSlotsFilled = Math.max(0, game.slots_filled - 1);
      const newStatus = (game.status === "full" && newSlotsFilled < game.slots_total) ? "open" : game.status;

      const { data: updatedGame, error: updateErr } = await supabase
        .from("open_games")
        .update({
          slots_filled: newSlotsFilled,
          players: playersList,
          status: newStatus
        })
        .eq("id", gameId)
        .select()
        .single();

      if (updateErr) throw updateErr;
      return updatedGame as OpenGame;
    } catch (e) {
      console.warn("Supabase leaveOpenGame failed, falling back to local memory:", e);
    }
  }

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 400));
  const game = localGames.find(g => g.id === gameId);
  if (!game) throw new Error("Game not found.");

  const idx = game.players.findIndex(p => p.name === currentUser.name);
  if (idx === -1) throw new Error("You are not part of this game.");

  game.players.splice(idx, 1);
  game.slots_filled = Math.max(0, game.slots_filled - 1);

  if (game.status === "full" && game.slots_filled < game.slots_total) {
    game.status = "open";
  }

  return { ...game };
}

export async function cancelOpenGame(gameId: string): Promise<OpenGame> {
  const supabase = await getSupabase();
  const currentUser = await me();
  if (!currentUser) {
    throw new Error("Authentication required to cancel a game.");
  }

  if (supabase) {
    try {
      const { data: game, error: fetchErr } = await supabase
        .from("open_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (fetchErr) throw fetchErr;
      if (!game) throw new Error("Game not found.");

      if (game.host_user_id !== currentUser.user_id && !currentUser.is_admin) {
        throw new Error("Only the host can cancel this game.");
      }

      const { data: updatedGame, error: updateErr } = await supabase
        .from("open_games")
        .update({ status: "cancelled" })
        .eq("id", gameId)
        .select()
        .single();

      if (updateErr) throw updateErr;
      return updatedGame as OpenGame;
    } catch (e) {
      console.warn("Supabase cancelOpenGame failed, falling back to local memory:", e);
    }
  }

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 400));
  const game = localGames.find(g => g.id === gameId);
  if (!game) throw new Error("Game not found.");

  if (game.host_user_id !== currentUser.user_id && !currentUser.is_admin) {
    throw new Error("Only the host can cancel this game.");
  }

  game.status = "cancelled";
  return { ...game };
}

export async function hostOpenGame(payload: CreateGamePayload): Promise<OpenGame> {
  const supabase = await getSupabase();
  const currentUser = await me();
  if (!currentUser) {
    throw new Error("Authentication required to host a game.");
  }

  const slots_total = Math.max(2, payload.slots_total);
  const total_amount = Math.max(100, payload.total_amount);
  const price_per_slot = Math.round(total_amount / slots_total);

  const newGame: OpenGame = {
    id: `game_${Date.now()}`,
    sport: payload.sport,
    venue: payload.venue,
    date: payload.date,
    time: payload.time,
    price_per_slot,
    total_amount,
    slots_total,
    slots_filled: 1,
    status: "open",
    distance: parseFloat((Math.random() * 5 + 0.5).toFixed(1)),
    host_name: currentUser.name,
    host_avatar: currentUser.picture,
    host_user_id: currentUser.user_id,
    players: [
      { name: currentUser.name, avatar: currentUser.picture }
    ],
    cancellation_policy: payload.cancellation_policy || "Refundable up to 2 hours before start.",
    is_private: payload.is_private
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("open_games")
        .insert(newGame)
        .select()
        .single();

      if (!error && data) {
        return data as OpenGame;
      }
      if (error) {
        console.warn("Supabase hostOpenGame insert error, falling back to local memory:", error);
      }
    } catch (e) {
      console.warn("Supabase hostOpenGame insert failed, falling back to local memory:", e);
    }
  }

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 600));
  localGames.unshift(newGame);
  return newGame;
}
