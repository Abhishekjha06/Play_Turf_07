/**
 * Supabase Realtime service — Table-change based real-time updates.
 *
 * Supabase Realtime automatically broadcasts table changes via the
 * `supabase_realtime` publication when REPLICA IDENTITY FULL is set.
 *
 * The webapp subscribes using `postgres_changes` on the relevant tables
 * (bookings, games, game_players) with filters.
 */
import { useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payload for turf slot availability changes (from bookings table) */
export type SlotBroadcastEvent = {
    id: string | number;
    turf_id: string | number;
    date: string;
    start_time: string;
    hours?: number;
    amount?: number;
    status: string;
    turf_name?: string;
};

/** Payload for booking status transitions */
export type BookingStatusEvent = {
    id: string | number;
    old_status: string;
    new_status: string;
    turf_id: string | number;
    turf_name: string;
    date: string;
    start_time: string;
};

/** Payload for user notification broadcasts (client-to-client only) */
export type UserNotificationEvent = {
    type: "booking_confirmed" | "booking_cancelled" | "booking_reminder";
    title: string;
    body: string;
    booking_id?: string;
    turf_name?: string;
};

// ---------------------------------------------------------------------------
// Channel subscription helpers
// ---------------------------------------------------------------------------

type CleanupFn = () => void;

// Only works when Supabase is configured — returns null in mock mode
type MaybeChannel = RealtimeChannel | null;

/**
 * Subscribe to booking changes for a specific turf.
 * Uses postgres_changes on the bookings table with a turf_id filter.
 * Returns an unsubscribe function.
 */
export async function subscribeTurfSlots(
    turfId: string | number,
    onSlotEvent: (event: SlotBroadcastEvent) => void,
): Promise<CleanupFn> {
    const supabase = await getSupabase();
    if (!supabase) {
        console.warn("[realtime] Supabase not configured, skipping turf slot subscription");
        return () => { };
    }

    const channel: RealtimeChannel = supabase.channel(`turf-${turfId}-slots`);

    channel.on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "bookings",
            filter: `turf_id=eq.${turfId}`,
        },
        (payload: any) => {
            const new_ = payload.new || {};
            const old_ = payload.old || {};
            onSlotEvent({
                id: new_.id || old_.id,
                turf_id: new_.turf_id || old_.turf_id,
                date: new_.date || old_.date,
                start_time: new_.start_time || old_.start_time,
                hours: new_.hours,
                status: new_.status || old_.status || "DELETED",
                turf_name: new_.turf_name,
            });
        },
    );

    await channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
            console.debug(`[realtime] Subscribed to turf slots: turf-${turfId}-slots`);
        }
        if (err) {
            console.error(`[realtime] Subscription error for turf-${turfId}-slots:`, err);
        }
    });

    return () => {
        supabase.removeChannel(channel);
        console.debug(`[realtime] Unsubscribed from turf slots: turf-${turfId}-slots`);
    };
}

/**
 * Subscribe to a specific booking's status changes.
 * Uses postgres_changes on the bookings table with an id filter.
 * Returns an unsubscribe function.
 */
export async function subscribeBookingStatus(
    bookingId: string | number,
    onStatusChange: (event: BookingStatusEvent) => void,
): Promise<CleanupFn> {
    const supabase = await getSupabase();
    if (!supabase) {
        console.warn("[realtime] Supabase not configured, skipping booking status subscription");
        return () => { };
    }

    const channel: RealtimeChannel = supabase.channel(`booking-${bookingId}-status`);

    channel.on(
        "postgres_changes",
        {
            event: "UPDATE",
            schema: "public",
            table: "bookings",
            filter: `id=eq.${bookingId}`,
        },
        (payload: any) => {
            const new_ = payload.new || {};
            const old_ = payload.old || {};
            onStatusChange({
                id: new_.id,
                old_status: old_.status,
                new_status: new_.status,
                turf_id: new_.turf_id,
                turf_name: new_.turf_name,
                date: new_.date,
                start_time: new_.start_time,
            });
        },
    );

    await channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
            console.debug(`[realtime] Subscribed to booking status: booking-${bookingId}-status`);
        }
        if (err) {
            console.error(`[realtime] Subscription error for booking-${bookingId}-status:`, err);
        }
    });

    return () => {
        supabase.removeChannel(channel);
        console.debug(`[realtime] Unsubscribed from booking status: booking-${bookingId}-status`);
    };
}

/**
 * Subscribe to a user's notification channel (client-to-client broadcast).
 * NOTE: This is a broadcast channel; DB events do not push here automatically.
 * The backend or another client must send broadcasts to this channel.
 * Returns an unsubscribe function.
 */
export async function subscribeUserNotifications(
    userId: string,
    onNotification: (event: UserNotificationEvent) => void,
): Promise<CleanupFn> {
    const supabase = await getSupabase();
    if (!supabase) {
        console.warn("[realtime] Supabase not configured, skipping user notification subscription");
        return () => { };
    }

    const topic = `user:${userId}:notifications`;
    const channel: RealtimeChannel = supabase.channel(topic, {
        config: { private: true },
    });

    channel.on(
        "broadcast",
        { event: "notification" },
        (payload: { payload: UserNotificationEvent }) => {
            onNotification(payload.payload);
        },
    );

    await channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
            console.debug(`[realtime] Subscribed to user notifications: ${topic}`);
        }
        if (err) {
            console.error(`[realtime] Subscription error for ${topic}:`, err);
        }
    });

    return () => {
        supabase.removeChannel(channel);
        console.debug(`[realtime] Unsubscribed from user notifications: ${topic}`);
    };
}

// ---------------------------------------------------------------------------
// Broadcast helpers (for sending custom events from the client)
// ---------------------------------------------------------------------------

/**
 * Send a broadcast on a turf slot channel.
 * Useful if the client needs to send an event that isn't covered by DB table changes.
 */
export async function sendTurfSlotBroadcast(
    turfId: string | number,
    eventName: string,
    payload: Record<string, unknown>,
): Promise<void> {
    const supabase = await getSupabase();
    if (!supabase) return;

    const topic = `turf:${turfId}:slots`;
    const channel = supabase.channel(topic, { config: { private: true } });

    await channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
            channel.send({
                type: "broadcast",
                event: eventName,
                payload,
            });
        }
    });

    // Clean up after sending
    setTimeout(() => supabase.removeChannel(channel), 2_000);
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * Hook: subscribe to real-time slot changes for a turf.
 *
 * @param turfId  — the turf ID to watch
 * @param onEvent — callback invoked with each booking change for this turf
 *
 * Automatically cleans up subscription on unmount or turfId change.
 */
export function useRealtimeSlots(
    turfId: string | number | undefined,
    onEvent: (event: SlotBroadcastEvent) => void,
): void {
    const savedCallback = useRef(onEvent);
    savedCallback.current = onEvent;

    useEffect(() => {
        if (!turfId) return;

        let cleanup: CleanupFn | null = null;

        subscribeTurfSlots(turfId, (event) => {
            savedCallback.current(event);
        }).then((fn) => {
            cleanup = fn;
        });

        return () => {
            if (cleanup) cleanup();
        };
    }, [turfId]);
}

/**
 * Hook: subscribe to real-time booking status changes.
 *
 * @param bookingId — the booking ID to watch
 * @param onEvent   — callback invoked when the booking status changes
 */
export function useRealtimeBookingStatus(
    bookingId: string | number | undefined,
    onEvent: (event: BookingStatusEvent) => void,
): void {
    const savedCallback = useRef(onEvent);
    savedCallback.current = onEvent;

    useEffect(() => {
        if (!bookingId) return;

        let cleanup: CleanupFn | null = null;

        subscribeBookingStatus(bookingId, (event) => {
            savedCallback.current(event);
        }).then((fn) => {
            cleanup = fn;
        });

        return () => {
            if (cleanup) cleanup();
        };
    }, [bookingId]);
}

/**
 * Hook: subscribe to real-time user notifications (client-to-client broadcast).
 *
 * @param userId   — the user ID to watch
 * @param onEvent  — callback invoked when a notification arrives
 */
export function useRealtimeNotifications(
    userId: string | undefined,
    onEvent: (event: UserNotificationEvent) => void,
): void {
    const savedCallback = useRef(onEvent);
    savedCallback.current = onEvent;

    useEffect(() => {
        if (!userId) return;

        let cleanup: CleanupFn | null = null;

        subscribeUserNotifications(userId, (event) => {
            savedCallback.current(event);
        }).then((fn) => {
            cleanup = fn;
        });

        return () => {
            if (cleanup) cleanup();
        };
    }, [userId]);
}

/**
 * Hook: Subscribe to real-time changes for games and game_players tables.
 * Automatically triggers callback on insert, update, or delete.
 */
export function useRealtimeOpenGames(callback: () => void): void {
    const savedCallback = useRef(callback);
    savedCallback.current = callback;

    useEffect(() => {
        let channelGames: RealtimeChannel | null = null;
        let channelPlayers: RealtimeChannel | null = null;

        getSupabase().then((supabase) => {
            // Subscribe to games table updates
            channelGames = supabase
                .channel("realtime-games")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "games" },
                    () => {
                        savedCallback.current();
                    }
                )
                .subscribe();

            // Subscribe to game_players table updates
            channelPlayers = supabase
                .channel("realtime-game-players")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "game_players" },
                    () => {
                        savedCallback.current();
                    }
                )
                .subscribe();
        });

        return () => {
            getSupabase().then((supabase) => {
                if (channelGames) supabase.removeChannel(channelGames);
                if (channelPlayers) supabase.removeChannel(channelPlayers);
            });
        };
    }, []);
}
