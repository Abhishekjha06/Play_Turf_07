/**
 * Google Analytics 4 — completely env-gated.
 *
 * Set VITE_GA4_ID (e.g. "G-XXXXXXXXXX") in the environment to enable.
 * Without it, nothing loads: no script, no network calls, zero overhead.
 * Never hardcode a measurement ID here.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let configured = false;

/** Load gtag.js once. Safe to call multiple times. */
export function initGA4(): void {
  const id = import.meta.env.VITE_GA4_ID;
  if (!id || typeof id !== "string" || !/^G-[A-Z0-9]+$/i.test(id)) return;
  if (typeof document === "undefined") return;
  if (document.getElementById("ga4-script")) {
    configured = true;
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, {
    // SPA route changes are tracked by GA4RouteTracker instead.
    send_page_view: true,
  });

  const script = document.createElement("script");
  script.async = true;
  script.id = "ga4-script";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);

  configured = true;
}

/** Fire a page_view for SPA navigations. */
export function trackGA4PageView(path: string, title: string): void {
  if (!configured || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title,
    page_location: window.location.origin + path,
  });
}

/**
 * Google Search Console / HTML-site verification, env-gated.
 * Set VITE_GSC_VERIFICATION to the content value Google gives you.
 */
export function injectGSCVerification(): void {
  const token = import.meta.env.VITE_GSC_VERIFICATION;
  if (!token || typeof token !== "string") return;
  if (document.querySelector('meta[name="google-site-verification"]')) return;
  const meta = document.createElement("meta");
  meta.name = "google-site-verification";
  meta.content = token;
  document.head.appendChild(meta);
}
