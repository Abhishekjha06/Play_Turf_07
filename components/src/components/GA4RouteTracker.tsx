import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackGA4PageView } from "@/lib/ga4";

/** Fires a GA4 page_view on every SPA route change (no-op when GA4 is off). */
export function GA4RouteTracker(): null {
  const location = useLocation();
  useEffect(() => {
    trackGA4PageView(location.pathname + location.search, document.title);
  }, [location]);
  return null;
}
