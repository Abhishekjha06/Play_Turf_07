import { createRoot, hydrateRoot } from "react-dom/client";
import AppWrapper from "./src/components/AppWrapper";
import "./index.css";

// ── Performance Optimizations ─────────────────────────────────
import { initPerformanceOptimizations } from "@/lib/performance";

// Initialize preconnects, DNS prefetch, and deferred work
initPerformanceOptimizations();

// ── Core Web Vitals Tracking ──────────────────────────────────
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";
import { initMonitoring } from "@/lib/monitoring";

function sendToAnalytics(metric: { name: string; value: number; id: string; delta?: number }) {
  // Log in development
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.id})`);
  }

  // Send to analytics in production (configure your endpoint)
  if (import.meta.env.PROD && "sendBeacon" in navigator) {
    try {
      navigator.sendBeacon(
        "/api/vitals",
        JSON.stringify({
          ...metric,
          url: window.location.href,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Silently fail — analytics should never block user experience
    }
  }
}

// Register all CWV metrics
onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);

// Initialize error monitoring
initMonitoring();

// ── React 18 Concurrent Features ──────────────────────────────
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

// Use hydrateRoot if server-side rendering is enabled, otherwise createRoot
if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <AppWrapper />);
} else {
  createRoot(rootElement).render(<AppWrapper />);
}

// ── Service Worker Registration ───────────────────────────────
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (import.meta.env.DEV) {
          console.log("[PWA] Service Worker registered:", registration.scope);
        }

        // Handle updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New content is available, show refresh prompt
                if (import.meta.env.DEV) {
                  console.log("[PWA] New content available, please refresh.");
                }
                window.dispatchEvent(new CustomEvent("sw-update-available"));
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error("[PWA] Service Worker registration failed:", error);
      });
  });
}

// ── Prefetch visible links on hover ───────────────────────────
document.addEventListener("mouseover", (e) => {
  const target = e.target as HTMLElement;
  const link = target.closest("a[href^='/']") as HTMLAnchorElement | null;
  if (link && !link.hasAttribute("data-prefetched")) {
    link.setAttribute("data-prefetched", "true");
    const prefetchLink = document.createElement("link");
    prefetchLink.rel = "prefetch";
    prefetchLink.href = link.href;
    document.head.appendChild(prefetchLink);
  }
});
