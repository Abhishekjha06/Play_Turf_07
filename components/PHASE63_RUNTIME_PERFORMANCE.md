# Phase 6.3 — Runtime Performance Report

**Date:** 2026-01-19  
**Commit:** `TBD`  
**Scope:** React rendering, animation performance, Web Vitals, monitoring setup  

---

## 1. Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| Web Vitals tracking | ✅ Excellent | All 5 CWV metrics tracked, sent to analytics |
| Performance utilities | ✅ Excellent | Preconnect, prefetch, idle scheduling, batch DOM ops |
| Monitoring | ✅ Good | Sentry + PostHog configured, env-gated |
| Service Worker | ✅ Good | Update handling, registration on load |
| React 18 features | ✅ Good | createRoot/hydrateRoot, concurrent features |
| CSS variable injection | ⚠️ Heavy | 30+ variables set on every theme change |
| Theme transition | ⚠️ Expensive | blur filter + opacity on theme switch |
| React.memo usage | ❌ Missing | No component memoization found |
| Layout thrashing | ⚠️ Risk | `batchDomOperations` forces sync layout |

---

## 2. Web Vitals ✅ Excellent

**File:** `main.tsx` (lines 11-43)

```tsx
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";

function sendToAnalytics(metric: { name: string; value: number; id: string; delta?: number }) {
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.id})`);
  }
  if (import.meta.env.PROD && "sendBeacon" in navigator) {
    navigator.sendBeacon("/api/vitals", JSON.stringify({ ...metric, url: window.location.href, timestamp: Date.now() }));
  }
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

**Assessment:** ✅ Perfect. All 5 Core Web Vitals are tracked:
- **CLS** (Cumulative Layout Shift) — visual stability
- **INP** (Interaction to Next Paint) — input responsiveness
- **LCP** (Largest Contentful Paint) — loading speed
- **FCP** (First Contentful Paint) — perceived speed
- **TTFB** (Time to First Byte) — server response

Analytics endpoint: `/api/vitals` (needs backend endpoint in production).

**Dev mode:** Logs to console for debugging.
**Prod mode:** Sends via `sendBeacon` (fire-and-forget, non-blocking).

---

## 3. Performance Utilities ✅ Excellent

**File:** `src/lib/performance.ts` (225 lines)

### What's included:

| Utility | Purpose | Quality |
|---------|---------|---------|
| `injectPreconnect()` | Add `<link rel="preconnect">` | ✅ Good |
| `injectDnsPrefetch()` | Add `<link rel="dns-prefetch">` | ✅ Good |
| `preloadResource()` | Preload critical resources | ✅ Good |
| `prefetchResource()` | Prefetch likely resources | ✅ Good |
| `scheduleIdleWork()` | `requestIdleCallback` with fallback | ✅ Excellent |
| `deferUntilInteractive()` | Defer until page load + idle | ✅ Excellent |
| `reportWebVitals()` | Send CWV to endpoint | ✅ Good |
| `supportsAvif()` | Feature-detect AVIF | ✅ Good |
| `supportsWebp()` | Feature-detect WebP | ✅ Good |
| `getOptimalImageFormat()` | Choose best format | ✅ Good |
| `batchDomOperations()` | Batch DOM reads/writes | ⚠️ See §5.1 |
| `observeVisibility()` | IntersectionObserver helper | ✅ Good |
| `preloadHeroImages()` | Preload LCP images with priority | ✅ Excellent |
| `initPerformanceOptimizations()` | Preconnect + route prefetch | ✅ Excellent |

### Initialization (`main.tsx` line 6):

```tsx
import { initPerformanceOptimizations } from "@/lib/performance";
initPerformanceOptimizations();
```

This preconnects to:
- `fonts.googleapis.com`
- `fonts.gstatic.com`
- `VITE_SUPABASE_URL` (if configured)

And defers prefetching likely routes: `/tournaments`, `/open-games`, `/offers`.

---

## 4. Monitoring Setup ✅ Good

**File:** `src/lib/monitoring.ts` (31 lines)

```tsx
import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

export function initMonitoring() {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }

  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
      disable_session_recording: false,
      session_recording: { maskAllInputs: true },
    });
  }
}
```

**Assessment:** ✅ Good. Both Sentry and PostHog are properly configured with environment gating. No runtime crashes if env vars are missing.

**Session recording:** 10% sample rate (good for performance), 100% on error.
**Input masking:** Enabled (privacy-compliant).

---

## 5. Issues Found

### 5.1 ⚠️ MEDIUM: `batchDomOperations()` Forces Synchronous Layout

**File:** `src/lib/performance.ts` (lines 151-158)

```tsx
export function batchDomOperations<T>(operations: (() => T)[]): T[] {
  const results: T[] = [];
  document.body.offsetHeight; // Force layout sync
  for (const op of operations) {
    results.push(op());
  }
  return results;
}
```

**Problem:** Reading `document.body.offsetHeight` forces the browser to compute layout synchronously. If the DOM is being modified, this causes **layout thrashing** — the browser must recalculate layout between each read/write cycle.

**Impact:** This utility is well-intentioned but actually counter-productive. The comment says "Force layout sync by reading offsetHeight" which is the opposite of what you want for batching.

**Fix:** Remove the `offsetHeight` read. Use `requestAnimationFrame` or `queueMicrotask` instead:

```tsx
export function batchDomOperations<T>(operations: (() => T)[]): Promise<T[]> {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      const results = operations.map(op => op());
      resolve(results);
    });
  });
}
```

Or better yet, use `fastdom` library for proper read/write batching.

**Current usage:** This function is not actually used anywhere in the codebase, so it's a dead code issue rather than a runtime problem.

---

### 5.2 ⚠️ MEDIUM: LuxuryThemeProvider CSS Injection

**File:** `src/luxury/LuxuryThemeProvider.tsx` (lines 204-280)

```tsx
function injectCSSVariables(theme: LuxuryTheme) {
  const root = document.documentElement;
  root.style.setProperty("--l-bg", c.bg);
  root.style.setProperty("--l-bg-secondary", c.bgSecondary);
  // ... 30+ more setProperty calls
  root.style.setProperty("--shadow-card", h.shadowCard);
  
  // Dynamic class changes
  if (theme.id === "dusky-white" || theme.id === "premium-teal") {
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  }
}
```

**Problem:** On every theme change, 30+ CSS custom properties are set via JavaScript. This triggers:
1. **Style recalculation** for the entire document
2. **Layout recalculation** for elements using these variables
3. **Paint** for affected areas

**Impact:** Theme switching causes a noticeable jank, especially on mobile. The `transition: background-color 0.45s` helps visually but doesn't reduce the CSS engine work.

**Recommendation:** Acceptable for now since theme switching is rare. But consider:
- Using CSS classes instead of individual variable injection
- Or pre-generating CSS for each theme and swapping a `<style>` tag

---

### 5.3 ⚠️ MEDIUM: ThemeTransition with Blur Filter

**File:** `src/luxury/LuxuryThemeProvider.tsx` (lines 323-338)

```tsx
export function ThemeTransition({ children }: { children: React.ReactNode }) {
  const { theme } = useLuxuryTheme();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={theme.id}
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(4px)" }}
        transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

**Problem:** `filter: blur(4px)` is one of the most expensive CSS properties to animate. It requires the browser to:
1. Render the element to a texture
2. Apply a Gaussian blur kernel (per-pixel calculation)
3. Composite the result

On a mobile device with a large DOM, this can drop frames significantly.

**Recommendation:** Replace with a simpler transition:

```tsx
// Instead of blur, use opacity + slight scale
initial={{ opacity: 0, scale: 0.98 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 1.02 }}
```

Scale and opacity are GPU-composited and much cheaper than blur.

---

### 5.4 ❌ MISSING: React.memo Not Used Anywhere

**Search result:** Zero instances of `React.memo` or `memo()` found in the entire `src/` directory.

**Impact:** Every component re-renders whenever its parent re-renders, even if props haven't changed. This is especially problematic for:
- `TurfCard` (rendered in lists)
- `BookingRow` (rendered in lists)
- `OpenGameCard` (rendered in lists)
- `OfferCard` (rendered in lists)
- `BottomNav` (always visible, re-renders on every navigation)
- `AppHeader` (always visible, re-renders on every scroll/frame)

**Recommendation:** Wrap list items and always-visible components with `React.memo`:

```tsx
export const TurfCard = React.memo(function TurfCard({ turf, ... }) {
  // ... component
});
```

**Expected impact:** Reduced re-renders by 30-50% on list pages.

---

### 5.5 ✅ GOOD: Link Prefetching on Hover

**File:** `main.tsx` (lines 91-101)

```tsx
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
```

**Assessment:** ✅ Good for UX. Hover-based prefetching warms the cache before the user clicks. Uses `data-prefetched` to prevent duplicate prefetches.

**Minor concern:** Could be throttled to avoid excessive prefetching on rapid mouse movements.

---

## 6. Service Worker ✅ Good

**File:** `main.tsx` (lines 59-89)

```tsx
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
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
```

**Assessment:** ✅ Good. Service worker registration is deferred until `window.load` event. Update detection dispatches a custom event that the app can listen for (e.g., show a "Update available" toast).

---

## 7. Recommendations

### Priority 1: Remove/Fix `batchDomOperations()`

```tsx
// CURRENT (broken — forces sync layout)
export function batchDomOperations<T>(operations: (() => T)[]): T[] {
  const results: T[] = [];
  document.body.offsetHeight; // ← THIS IS BAD
  for (const op of operations) { results.push(op()); }
  return results;
}

// FIXED (async, no forced layout)
export function batchDomOperations<T>(operations: (() => T)[]): Promise<T[]> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const results = operations.map(op => op());
      resolve(results);
    });
  });
}
```

Since this function is unused, the simplest fix is to **delete it** or fix it to be correct.

---

### Priority 2: Add React.memo to List Items

```tsx
// src/turf/TurfCard.tsx
export const TurfCard = React.memo(function TurfCard({ turf, ... }) {
  // ... existing component
});

// src/booking/BookingRow.tsx
export const BookingRow = React.memo(function BookingRow({ ... }) {
  // ... existing component
});

// src/open-games/OpenGameCard.tsx
export const OpenGameCard = React.memo(function OpenGameCard({ ... }) {
  // ... existing component
});
```

---

### Priority 3: Replace ThemeTransition Blur with Scale

```tsx
// src/luxury/LuxuryThemeProvider.tsx
<motion.div
  key={theme.id}
  initial={{ opacity: 0, scale: 0.98 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 1.02 }}
  transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
>
  {children}
</motion.div>
```

---

### Priority 4: Throttle Link Prefetching

```tsx
// Add a simple throttle to prevent excessive prefetching
const prefetchThrottle = new Map<string, number>();

document.addEventListener("mouseover", (e) => {
  const link = (e.target as HTMLElement).closest("a[href^='/']") as HTMLAnchorElement | null;
  if (!link) return;
  
  const href = link.href;
  const now = Date.now();
  if (prefetchThrottle.has(href) && now - prefetchThrottle.get(href)! < 5000) return;
  
  prefetchThrottle.set(href, now);
  // ... existing prefetch logic
});
```

---

## 8. Conclusion

| Category | Score | Notes |
|----------|-------|-------|
| Web Vitals tracking | 10/10 | All 5 metrics, proper analytics |
| Performance utilities | 9/10 | Comprehensive, one minor bug |
| Monitoring | 9/10 | Sentry + PostHog, env-gated |
| Service Worker | 8/10 | Good, update handling |
| React optimization | 4/10 | No memo, context re-renders |
| Animation performance | 5/10 | Blur filter is expensive |
| **Overall** | **7.5/10** | Strong foundation, needs memoization |

**Highest impact fix:** Add `React.memo` to list components (TurfCard, BookingRow, OpenGameCard).
**Easiest fix:** Fix `batchDomOperations()` or remove it.
**Best UX improvement:** Replace theme blur with scale transition.

---

## 9. Quick Fixes (Can Apply Now)

1. **Fix `batchDomOperations()` in `src/lib/performance.ts`**
2. **Add `React.memo` to `TurfCard`, `BookingRow`, `OpenGameCard`**
3. **Replace blur with scale in `ThemeTransition`**

These are all low-risk, high-impact changes.
