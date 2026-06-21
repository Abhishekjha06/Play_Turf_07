/**
 * Supabase Realtime service — Broadcast-based real-time updates.
 *
 * Channel topics used in this app:
 *   turf:<turf_id>:slots          — live slot availability changes
 *   booking:<booking_id>:status   — booking status transitions
 *   user:<user_id>:notifications  — general notifications per user
 *
 * Usage:
 *   import { useRealtimeSlots, useRealtimeBookingStatus } from "@/lib/realtime";
 *
 *   // In Booking.tsx — receive slot changes live
 *   useRealtimeSlots(turfId, (slotEvent) => {
 *     // slotEvent has { turf_id, date, start_time, status, ... }
 *   });
 *
 *   // In BookingDetail.tsx — receive status changes live
 *   useRealtimeBookingStatus(bookingId, (statusEvent) => {
 *     // statusEvent has { old_status, new_status, ... }
 *   });
 */
import { useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payload sent by the DB trigger (broadcast_booking_change) on slot events */
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

/** Payload for user notification broadcasts */
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
 * Subscribe to the turf slot broadcast channel.
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

    const topic = `turf:${turfId}:slots`;
    const channel: RealtimeChannel = supabase.channel(topic, {
        config: { private: true },
    });

    channel.on(
        "broadcast",
        { event: "insert" },
        (payload: { payload: SlotBroadcastEvent }) => {
            onSlotEvent({ ...payload.payload, status: "PENDING" });
        },
    );

    channel.on(
        "broadcast",
        { event: "update" },
        (payload: { payload: SlotBroadcastEvent }) => {
            onSlotEvent(payload.payload);
        },
    );

    channel.on(
        "broadcast",
        { event: "delete" },
        (payload: { payload: SlotBroadcastEvent }) => {
            onSlotEvent({ ...payload.payload, status: "DELETED" });
        },
    );

    channel.on(
        "broadcast",
        { event: "booking_status_changed" },
        (payload: { payload: SlotBroadcastEvent }) => {
            onSlotEvent(payload.payload);
        },
    );

    await channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
            console.debug(`[realtime] Subscribed to turf slots: ${topic}`);
        }
        if (err) {
            console.error(`[realtime] Subscription error for ${topic}:`, err);
        }
    });

    return () => {
        supabase.removeChannel(channel);
        console.debug(`[realtime] Unsubscribed from turf slots: ${topic}`);
    };
}

/**
 * Subscribe to a booking status channel.
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

    const topic = `booking:${bookingId}:status`;
    const channel: RealtimeChannel = supabase.channel(topic, {
        config: { private: true },
    });

    channel.on(
        "broadcast",
        { event: "booking_status_changed" },
        (payload: { payload: BookingStatusEvent }) => {
            onStatusChange(payload.payload);
        },
    );

    await channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
            console.debug(`[realtime] Subscribed to booking status: ${topic}`);
        }
        if (err) {
            console.error(`[realtime] Subscription error for ${topic}:`, err);
        }
    });

    return () => {
        supabase.removeChannel(channel);
        console.debug(`[realtime] Unsubscribed from booking status: ${topic}`);
    };
}

/**
 * Subscribe to a user's notification channel.
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
 * Useful if the client needs to send an event that isn't covered by the DB trigger.
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
 * @param onEvent — callback invoked with each slot broadcast event
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
 * Hook: subscribe to real-time user notifications.
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
 * Hook: Subscribe to real-time changes for open games and slots.
 * Automatically triggers callback on insert, update, or delete.
 */
export function useRealtimeOpenGames(callback: () => void): void {
    const savedCallback = useRef(callback);
    savedCallback.current = callback;

    useEffect(() => {
        let channelOpenGames: RealtimeChannel | null = null;
        let channelPlayers: RealtimeChannel | null = null;

        getSupabase().then((supabase) => {
            if (!supabase) return;

            // Subscribe to open_games table updates
            channelOpenGames = supabase
                .channel("realtime-open-games")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "open_games" },
                    () => {
                        savedCallback.current();
                    }
                )
                .subscribe();

            // Subscribe to open_game_players table updates
            channelPlayers = supabase
                .channel("realtime-open-game-players")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "open_game_players" },
                    () => {
                        savedCallback.current();
                    }
                )
                .subscribe();
        });

        return () => {
            getSupabase().then((supabase) => {
                if (!supabase) return;
                if (channelOpenGames) supabase.removeChannel(channelOpenGames);
                if (channelPlayers) supabase.removeChannel(channelPlayers);
            });
        };
    }, []);
}