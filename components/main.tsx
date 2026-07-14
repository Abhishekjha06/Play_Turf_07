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

// ── Environment Variable Guard ────────────────────────────────
const MISSING_ENVS: string[] = [];
if (!import.meta.env.VITE_SUPABASE_URL) MISSING_ENVS.push("VITE_SUPABASE_URL");
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) MISSING_ENVS.push("VITE_SUPABASE_ANON_KEY");

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

if (MISSING_ENVS.length > 0) {
  rootElement.innerHTML = `
    <div style="padding:2rem;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <h1 style="color:#ef4444;font-size:1.5rem;margin-bottom:1rem">⚠️ Missing Environment Variables</h1>
      <p style="margin-bottom:1.5rem;max-width:500px">These variables are required but not found in Vercel:</p>
      <ul style="text-align:left;margin-bottom:1.5rem;color:#fbbf24">
        ${MISSING_ENVS.map(v => `<li style="margin-bottom:0.5rem"><code>${v}</code></li>`).join('')}
      </ul>
      <p style="color:#94a3b8;font-size:0.875rem;max-width:500px">
        Go to Vercel Dashboard → Settings → Environment Variables → add these exact names (with <code>VITE_</code> prefix).
        Then redeploy.
      </p>
    </div>
  `;
  console.error("Missing env vars:", MISSING_ENVS);
} else {
  // ── Debug: show what env vars are actually loaded ─────────────
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const keyPrefix = key?.slice(0, 20) + "..." || "undefined";
  const isJwt = key?.startsWith("eyJ") || false;

  console.log("[ENV DEBUG] VITE_SUPABASE_URL:", url);
  console.log("[ENV DEBUG] VITE_SUPABASE_ANON_KEY prefix:", keyPrefix);
  console.log("[ENV DEBUG] Is JWT format (starts with eyJ):", isJwt);

  // If key is NOT in JWT format (eyJ...), show a warning
  if (!isJwt) {
    rootElement.innerHTML = `
      <div style="padding:2rem;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
        <h1 style="color:#fbbf24;font-size:1.5rem;margin-bottom:1rem">⚠️ Wrong API Key Format</h1>
        <p style="margin-bottom:1rem;max-width:500px">Your <code>VITE_SUPABASE_ANON_KEY</code> is set, but it's not the correct key.</p>
        <p style="margin-bottom:0.5rem"><strong>Current value starts with:</strong> <code style="background:#1e293b;padding:0.25rem;border-radius:4px">${keyPrefix}</code></p>
        <p style="margin-bottom:1.5rem;color:#f87171"><strong>It should start with:</strong> <code style="background:#1e293b;padding:0.25rem;border-radius:4px">eyJhbG...</code></p>
        <p style="color:#94a3b8;font-size:0.875rem;max-width:500px;margin-bottom:1rem">
          Go to Supabase → Project Settings → API → copy the <strong>anon</strong> key (not publishable key).
        </p>
        <p style="color:#94a3b8;font-size:0.875rem;max-width:500px">
          Then paste it in Vercel: <code>VITE_SUPABASE_ANON_KEY</code> → Save → Redeploy.
        </p>
      </div>
    `;
  } else {
    // ── React 18 Concurrent Features ──────────────────────────────
    try {
      if (rootElement.hasChildNodes()) {
        hydrateRoot(rootElement, <AppWrapper />);
      } else {
        createRoot(rootElement).render(<AppWrapper />);
      }
    } catch (err: any) {
      rootElement.innerHTML = `
        <div style="padding:2rem;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh">
          <h1 style="color:#ef4444;font-size:1.25rem;margin-bottom:1rem">❌ App Failed to Load</h1>
          <p style="margin-bottom:0.5rem"><strong>Error:</strong> ${err?.message || 'Unknown error'}</p>
          <p style="color:#94a3b8;font-size:0.875rem">Check browser console (F12 → Console) for details.</p>
        </div>
      `;
      console.error("React root render failed:", err);
    }
  }
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
