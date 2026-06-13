/**
 * Global real-time notification listener.
 *
 * Mounted once in App.tsx and subscribes to the authenticated user's
 * notification channel via Supabase Realtime. Shows toast notifications
 * for booking confirmations, cancellations, and other alerts.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeNotifications, type UserNotificationEvent } from "@/lib/realtime";
import { addNotification } from "@/lib/notifications";

export function RealtimeNotificationsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const userId = user?.user_id;
    const notified = useRef<Set<string>>(new Set());

    useRealtimeNotifications(userId, (event: UserNotificationEvent) => {
        // Deduplicate via a simple key so the same notification doesn't fire twice
        const key = `${event.type}:${event.booking_id}:${event.title}`;
        if (notified.current.has(key)) return;
        notified.current.add(key);

        // Garbage-collect old keys after 30s to keep memory bounded
        setTimeout(() => notified.current.delete(key), 30_000);

        // Save notification to LocalStorage manager
        addNotification({
            type: event.type,
            title: event.title,
            body: event.body,
            booking_id: event.booking_id,
        });

        switch (event.type) {
            case "booking_confirmed":
                toast.success(event.title, {
                    description: event.body,
                    duration: 6_000,
                });
                break;

            case "booking_cancelled":
                toast.error(event.title, {
                    description: event.body,
                    duration: 6_000,
                });
                break;

            case "booking_reminder":
                toast.info(event.title, {
                    description: event.body,
                    duration: 8_000,
                });
                break;

            default:
                toast(event.title, {
                    description: event.body,
                    duration: 5_000,
                });
        }
    });

    return <>{children}</>;
}