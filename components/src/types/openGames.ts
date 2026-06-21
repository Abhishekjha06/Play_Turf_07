export interface GamePlayer {
  id?: string;
  name: string;
  avatar: string;
  payment_status?: string; // unpaid | requested | paid | refunded
  payment_method?: string;
  booking_id?: string | null;
  joined_at?: string;
  is_host?: boolean;
}

export type GameStatus = "open" | "full" | "cancelled";

export interface OpenGame {
  id: string;
  sport: string;
  venue: string;
  turf_id?: string;
  date: string;
  time: string;
  duration_hours?: number;
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
  is_private?: boolean;
  lat?: number | null;
  lng?: number | null;
}

export interface CreateGamePayload {
  sport: string;
  venue: string;
  turf_id?: string;
  turf_image?: string;
  date: string;
  time: string;          // HH:MM (24h)
  duration_hours?: number;
  total_amount: number;
  slots_total: number;
  cancellation_policy?: string;
  is_private?: boolean;
  lat?: number;
  lng?: number;
}
