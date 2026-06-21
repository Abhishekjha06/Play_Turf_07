import { openGames as initialGames, type Booking } from "@/data/seed";
import type { OpenGame, CreateGamePayload } from "@/types/openGames";
import { getSupabase } from "../supabase";
import { me } from "./auth";
import { getMockBookings, setMockBookings } from "./bookings";
import { getMockTurfs } from "./turfs";

function convertTimeTo24(timeStr: string): string {
  const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return timeStr;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

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
      
      const { data: gamesData, error } = await query;
      if (!error && gamesData) {
        const gameIds = gamesData.map(g => g.id);
        const { data: playersData } = await supabase
          .from("open_game_players")
          .select("*")
          .in("open_game_id", gameIds);

        return gamesData.map(g => {
          const players = (playersData || [])
            .filter(p => p.open_game_id === g.id)
            .map(p => ({
              name: p.name,
              avatar: p.avatar,
              payment_status: p.payment_status,
              payment_method: p.payment_method,
              booking_id: p.booking_id,
              joined_at: p.joined_at
            }));
          return {
            ...g,
            players
          };
        });
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

export async function joinOpenGame(gameId: string, paymentMethod: string = "UPI"): Promise<{ game: OpenGame; booking: Booking }> {
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

      // Check if user is already joined via relational table
      const { data: existingParticipation } = await supabase
        .from("open_game_players")
        .select("id")
        .eq("open_game_id", gameId)
        .eq("user_id", currentUser.user_id)
        .maybeSingle();

      if (existingParticipation) throw new Error("You have already joined this game.");

      // 2. Perform atomic slot join update
      const isPrivate = game.is_private;
      const newSlotsFilled = isPrivate ? game.slots_filled : game.slots_filled + 1;
      const newStatus = newSlotsFilled >= game.slots_total ? "full" : "open";

      const { data: updatedGame, error: updateErr } = await supabase
        .from("open_games")
        .update({
          slots_filled: newSlotsFilled,
          status: newStatus
        })
        .eq("id", gameId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // 3. Create confirmed booking record in database
      const paymentId = `pay_${Math.random().toString(36).slice(2, 10)}`;
      const bookingId = `bkg_${Math.random().toString(36).slice(2, 10)}`;

      const { data: turfsData } = await supabase.from("turfs").select("*");
      const matchedTurf = (turfsData || []).find((t: any) => 
        game.venue.toLowerCase().includes(t.name.toLowerCase()) || 
        t.name.toLowerCase().includes(game.venue.toLowerCase())
      );
      const turfId = matchedTurf ? matchedTurf.id : "turf_1";
      const turfName = matchedTurf ? matchedTurf.name : game.venue;
      const turfImage = matchedTurf ? matchedTurf.image : "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200";

      const time24 = convertTimeTo24(game.time);
      const [h, m] = time24.split(":").map(Number);
      const endHour = String((h + 1) % 24).padStart(2, "0");
      const endTime = `${endHour}:${String(m).padStart(2, "0")}`;

      const newBooking: Booking = {
        id: bookingId,
        user_id: currentUser.user_id,
        turf_id: turfId,
        turf_name: turfName,
        turf_image: turfImage,
        date: game.date,
        start_time: time24,
        end_time: endTime,
        hours: 1,
        amount: game.price_per_slot,
        status: isPrivate ? "PENDING" : "CONFIRMED",
        payment_id: isPrivate ? null : paymentId,
        created_at: new Date().toISOString(),
      };

      const { error: insertBookingErr } = await supabase
        .from("bookings")
        .insert(newBooking);
      if (insertBookingErr) throw insertBookingErr;

      // 4. Create participation record in open_game_players
      const playerRecord = {
        id: `gp_${Date.now()}`,
        open_game_id: gameId,
        user_id: currentUser.user_id,
        name: currentUser.name,
        avatar: currentUser.picture,
        payment_status: isPrivate ? "pending" : "paid",
        payment_method: paymentMethod,
        booking_id: bookingId,
        joined_at: new Date().toISOString()
      };

      const { error: playerInsertErr } = await supabase
        .from("open_game_players")
        .insert(playerRecord);

      if (playerInsertErr) throw playerInsertErr;

      // Fetch all players for return formatting
      const { data: allPlayers } = await supabase
        .from("open_game_players")
        .select("*")
        .eq("open_game_id", gameId);

      const formattedGame = {
        ...updatedGame,
        players: (allPlayers || []).map(p => ({
          name: p.name,
          avatar: p.avatar,
          payment_status: p.payment_status,
          payment_method: p.payment_method,
          booking_id: p.booking_id,
          joined_at: p.joined_at
        }))
      };

      return { game: formattedGame as OpenGame, booking: newBooking };
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

  // Create mock booking
  const mockBookings = getMockBookings();
  const matchedTurf = getMockTurfs().find((t) => 
    game.venue.toLowerCase().includes(t.name.toLowerCase()) || 
    t.name.toLowerCase().includes(game.venue.toLowerCase())
  );
  const turfId = matchedTurf ? matchedTurf.id : "turf_1";
  const turfName = matchedTurf ? matchedTurf.name : game.venue;
  const turfImage = matchedTurf ? matchedTurf.image : "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200";

  const time24 = convertTimeTo24(game.time);
  const [h, m] = time24.split(":").map(Number);
  const endHour = String((h + 1) % 24).padStart(2, "0");
  const endTime = `${endHour}:${String(m).padStart(2, "0")}`;

  const bookingId = `bkg_${Math.random().toString(36).slice(2, 10)}`;
  const paymentId = `pay_${Math.random().toString(36).slice(2, 10)}`;
  const newBooking: Booking = {
    id: bookingId,
    user_id: currentUser.user_id,
    turf_id: turfId,
    turf_name: turfName,
    turf_image: turfImage,
    date: game.date,
    start_time: time24,
    end_time: endTime,
    hours: 1,
    amount: game.price_per_slot,
    status: game.is_private ? "PENDING" : "CONFIRMED",
    payment_id: game.is_private ? null : paymentId,
    created_at: new Date().toISOString(),
  };

  if (game.is_private) {
    game.players.push({
      name: currentUser.name,
      avatar: currentUser.picture,
      payment_status: "pending",
      payment_method: paymentMethod,
      booking_id: bookingId,
      joined_at: new Date().toISOString()
    });
  } else {
    game.slots_filled += 1;
    game.players.push({
      name: currentUser.name,
      avatar: currentUser.picture,
      payment_status: "paid",
      payment_method: paymentMethod,
      booking_id: bookingId,
      joined_at: new Date().toISOString()
    });

    if (game.slots_filled >= game.slots_total) {
      game.status = "full";
    }
  }

  setMockBookings([newBooking, ...mockBookings]);

  return { game: { ...game }, booking: newBooking };
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

      const { data: participation } = await supabase
        .from("open_game_players")
        .select("id")
        .eq("open_game_id", gameId)
        .eq("user_id", currentUser.user_id)
        .maybeSingle();

      if (!participation) throw new Error("You are not part of this game.");

      // Remove from open_game_players
      const { error: removePlayerErr } = await supabase
        .from("open_game_players")
        .delete()
        .eq("id", participation.id);

      if (removePlayerErr) throw removePlayerErr;

      const newSlotsFilled = Math.max(0, game.slots_filled - 1);
      const newStatus = (game.status === "full" && newSlotsFilled < game.slots_total) ? "open" : game.status;

      const { data: updatedGame, error: updateErr } = await supabase
        .from("open_games")
        .update({
          slots_filled: newSlotsFilled,
          status: newStatus
        })
        .eq("id", gameId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      const { data: allPlayers } = await supabase
        .from("open_game_players")
        .select("*")
        .eq("open_game_id", gameId);

      const formattedGame = {
        ...updatedGame,
        players: (allPlayers || []).map(p => ({
          name: p.name,
          avatar: p.avatar,
          payment_status: p.payment_status,
          payment_method: p.payment_method,
          booking_id: p.booking_id,
          joined_at: p.joined_at
        }))
      };

      return formattedGame as OpenGame;
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

      const { data: allPlayers } = await supabase
        .from("open_game_players")
        .select("*")
        .eq("open_game_id", gameId);

      const formattedGame = {
        ...updatedGame,
        players: (allPlayers || []).map(p => ({
          name: p.name,
          avatar: p.avatar,
          payment_status: p.payment_status,
          payment_method: p.payment_method,
          booking_id: p.booking_id,
          joined_at: p.joined_at
        }))
      };

      return formattedGame as OpenGame;
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

  const gameId = `game_${Date.now()}`;
  const newGame: OpenGame = {
    id: gameId,
    sport: payload.sport,
    venue: payload.venue,
    date: payload.date,
    time: payload.time,
    price_per_slot,
    total_amount,
    slots_total,
    slots_filled: 1,
    status: "open",
    distance: parseFloat((Math.random() * 1.5 + 0.1).toFixed(1)),
    host_name: currentUser.name,
    host_avatar: currentUser.picture,
    host_user_id: currentUser.user_id,
    players: [
      {
        name: currentUser.name,
        avatar: currentUser.picture,
        payment_status: "paid",
        payment_method: "Host",
        booking_id: null,
        joined_at: new Date().toISOString()
      }
    ],
    cancellation_policy: payload.cancellation_policy || "Refundable up to 2 hours before start.",
    is_private: payload.is_private
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("open_games")
        .insert({
          id: newGame.id,
          sport: newGame.sport,
          venue: newGame.venue,
          date: newGame.date,
          time: newGame.time,
          price_per_slot: newGame.price_per_slot,
          total_amount: newGame.total_amount,
          slots_total: newGame.slots_total,
          slots_filled: newGame.slots_filled,
          status: newGame.status,
          distance: newGame.distance,
          host_name: newGame.host_name,
          host_avatar: newGame.host_avatar,
          host_user_id: newGame.host_user_id,
          cancellation_policy: newGame.cancellation_policy,
          is_private: newGame.is_private
        })
        .select()
        .single();

      if (error) throw error;

      // Add Host participation entry
      const playerRecord = {
        id: `gp_${Date.now()}`,
        open_game_id: newGame.id,
        user_id: currentUser.user_id,
        name: currentUser.name,
        avatar: currentUser.picture,
        payment_status: "paid",
        payment_method: "Host",
        booking_id: null,
        joined_at: new Date().toISOString()
      };

      const { error: playerErr } = await supabase
        .from("open_game_players")
        .insert(playerRecord);

      if (playerErr) throw playerErr;

      return {
        ...data,
        players: [
          {
            name: currentUser.name,
            avatar: currentUser.picture,
            payment_status: "paid",
            payment_method: "Host",
            booking_id: null,
            joined_at: playerRecord.joined_at
          }
        ]
      } as OpenGame;
    } catch (e) {
      console.warn("Supabase hostOpenGame insert failed, falling back to local memory:", e);
    }
  }

  // Mock fallback
  await new Promise((resolve) => setTimeout(resolve, 600));
  localGames.unshift(newGame);
  return newGame;
}

