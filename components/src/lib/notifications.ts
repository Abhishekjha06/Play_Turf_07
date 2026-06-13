export type NotificationType =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_reminder"
  | "promotional_offer"
  | "discount_coupon"
  | "tournament_announcement"
  | "new_turf_launch"
  | "maintenance_notice"
  | "system_announcement"
  | "feature_update"
  | "offer"; // Legacy compat

export type NotificationCategory =
  | "Bookings"
  | "Refunds"
  | "Offers"
  | "Announcements"
  | "Tournaments"
  | "System Updates";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  booking_id?: string;
  bannerImage?: string;
  deepLink?: string;
  expiryDate?: string;
  targetAudience?: string; // "All Users", "Selected Users", "User Segments"
}

export function getCategoryForType(type: NotificationType): NotificationCategory {
  switch (type) {
    case "booking_confirmed":
    case "booking_reminder":
      return "Bookings";
    case "booking_cancelled":
      return "Refunds";
    case "promotional_offer":
    case "discount_coupon":
    case "offer":
      return "Offers";
    case "new_turf_launch":
    case "system_announcement":
      return "Announcements";
    case "tournament_announcement":
      return "Tournaments";
    case "maintenance_notice":
    case "feature_update":
      return "System Updates";
    default:
      return "Announcements";
  }
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
          type: "promotional_offer",
          title: "Monsoon Turf Carnival! 🌧️",
          body: "Get flat 20% off on Greenfield Arena and Net Practice cages. Use code: MONSOON20 at checkout.",
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          isRead: false,
          expiryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days in future
          deepLink: "/offers"
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

// Admin Operations
export function adminCreateNotification(payload: Omit<AppNotification, "id" | "timestamp" | "isRead">) {
  addNotification(payload);
}

export function adminEditNotification(id: string, patch: Partial<AppNotification>) {
  const list = getNotifications();
  const idx = list.findIndex(n => n.id === id);
  if (idx > -1) {
    list[idx] = { ...list[idx], ...patch };
    saveNotifications(list);
  }
}

export function adminDeleteNotification(id: string) {
  const list = getNotifications();
  const filtered = list.filter(n => n.id !== id);
  saveNotifications(filtered);
}
