
import { useState } from "react";
import { BellRing, LoaderCircle, CheckCircle2 } from "lucide-react";
import { enablePushNotifications } from "@/lib/pushNotifications";

export default function PushNotificationSettings() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      await enablePushNotifications();

      setSuccess(true);
      setMessage("Push notifications enabled on this browser.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not enable push notifications."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#151515] p-4 text-white">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white/10 p-3">
          <BellRing className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">
            Slot availability alerts
          </h3>

          <p className="mt-1 text-sm text-white/60">
            Get browser notifications when a slot you are
            watching becomes available.
          </p>

          <button
            type="button"
            onClick={handleEnable}
            disabled={loading}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <BellRing className="h-4 w-4" />
            )}

            {loading
              ? "Enabling..."
              : success
                ? "Notifications enabled"
                : "Enable notifications"}
          </button>

          {message && (
            <p
              role="status"
              aria-live="polite"
              className={`mt-3 text-sm ${
                success ? "text-green-400" : "text-red-400"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
