export interface GamePlayer {
  name: string;
  avatar: string;
}

export type GameStatus = "open" | "full" | "cancelled";

export interface OpenGame {
  id: string;
  sport: string;
  venue: string;
  date: string;
  time: string;
  price_per_slot: number; // calculated server-side
  total_amount: number;
  slots_total: number;
  slots_filled: number;
  status: GameStatus;
  distance: number;
  host_name: string;
  host_avatar?: string;
  host_user_id: string;
  players: GamePlayer[];
  cancellation_policy: string;
  chat_messages?: { sender: string; avatar: string; text: string; time: string }[];
}

export interface CreateGamePayload {
  sport: string;
  venue: string;
  date: string;
  time: string;
  total_amount: number;
  slots_total: number;
  cancellation_policy?: string;
}
