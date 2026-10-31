
import { getSupabase } from "@/lib/supabase";

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = window.atob(base64);
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));

  return bytes.buffer as ArrayBuffer;
}

/**
 * Requests permission, registers the browser's push subscription,
 * and saves it for the authenticated Supabase user.
 */
export async function enablePushNotifications(): Promise<void> {
  if (!("Notification" in window)) {
    throw new Error("This browser does not support notifications.");
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser does not support browser push.");
  }

  const vapidPublicKey =
    import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();

  if (!vapidPublicKey) {
    throw new Error("VITE_VAPID_PUBLIC_KEY is missing from your environment.");
  }

  // Request permission directly from the user's button click.
  let permission = Notification.permission;

  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    throw new Error(
      "Notifications are not enabled. Allow them in your browser settings."
    );
  }

  // Reuse PlayTurf's existing Supabase client.
  const supabase = await getSupabase();

  // Use the actual authenticated Supabase Auth user ID.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in before enabling notifications.");
  }

  // Wait for the existing PWA service worker to become active.
  const registration = await navigator.serviceWorker.ready;

  let subscription =
    await registration.pushManager.getSubscription();

  const createdHere = !subscription;

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToArrayBuffer(vapidPublicKey),
    });
  }

  const subscriptionJSON = subscription.toJSON();
  const p256dh = subscriptionJSON.keys?.p256dh;
  const auth = subscriptionJSON.keys?.auth;

  if (!p256dh || !auth) {
    if (createdHere) {
      await subscription.unsubscribe();
    }

    throw new Error("The browser did not return the required push keys.");
  }

  const { error: saveError } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (saveError) {
    // Avoid leaving a newly created subscription unregistered in the DB.
    if (createdHere) {
      await subscription.unsubscribe();
    }

    throw new Error(
      `Could not save the push subscription: ${saveError.message}`
    );
  }
}
