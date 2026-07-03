import React, { useState, useEffect } from "react";
import { Button } from "@/ui/button";

/**
 * ServiceWorkerUpdateBanner
 * Shows a banner when a new version of the app is available.
 * Prompts the user to refresh to get the latest updates.
 */
export const ServiceWorkerUpdateBanner: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setShowUpdate(true);
    };

    window.addEventListener("sw-update-available", handleUpdate);

    // Also check for updates periodically
    const checkInterval = setInterval(() => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.update();
        });
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => {
      window.removeEventListener("sw-update-available", handleUpdate);
      clearInterval(checkInterval);
    };
  }, []);

  const handleRefresh = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.unregister().then(() => {
          window.location.reload();
        });
      });
    } else {
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2.5"
      style={{
        background: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
        color: "#fff",
      }}
    >
      <span className="text-sm font-medium">
        A new version of PlayTurf is available!
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleRefresh}
          className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
        >
          Update Now
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="h-7 text-xs text-white hover:bg-white/10"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};

export default ServiceWorkerUpdateBanner;
