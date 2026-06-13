export interface AppNotification {
  id: string;
  type: "booking_confirmed" | "booking_cancelled" | "booking_reminder" | "offer";
  title: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  booking_id?: string;
}

const STORAGE_KEY = "play_turf_notifications";

export function getNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Default initial mock offer/notification to look premium
      const initial: AppNotification[] = [
        {
          id: "initial-promo",
          type: "offer",
          title: "Monsoon Turf Carnival! 🌧️",
          body: "Get flat 20% off on Greenfield Arena and Net Practice cages. Use code: MONSOON20 at checkout.",
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
          isRead: false,
        }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveNotifications(list: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("notifications_updated"));
  } catch (e) {
    console.error("Failed to save notifications", e);
  }
}

export function addNotification(notification: Omit<AppNotification, "id" | "timestamp" | "isRead">) {
  const list = getNotifications();
  const newNotif: AppNotification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    isRead: false,
  };
  list.unshift(newNotif);
  saveNotifications(list);
  
  // Trigger blink animation event
  window.dispatchEvent(new CustomEvent("notification_blink", { detail: newNotif }));
}

export function markAllAsRead() {
  const list = getNotifications();
  const updated = list.map(n => ({ ...n, isRead: true }));
  saveNotifications(updated);
}

export function clearNotifications() {
  saveNotifications([]);
}
