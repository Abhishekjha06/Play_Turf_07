# Phase 6.1 — Bundle Analysis Report

**Date:** 2026-01-19  
**Commit:** `TBD`  
**Scope:** JavaScript bundle size analysis, dependency audit, chunking review  
**Build:** `vite build --mode analyze` (rollup-plugin-visualizer)  

---

## 1. Executive Summary

| Metric | Value | Assessment |
|--------|-------|------------|
| Total JS (uncompressed) | **3.56 MB** | ⚠️ Above 2MB ideal |
| Total JS (Brotli) | **0.93 MB** | ✅ Under 1MB |
| Total CSS | **126 KB** | ✅ Good |
| JS Chunks | **58** | ✅ Well-split |
| Source Maps | **0** | ✅ Production-optimized |
| Chunk Size Warning | **2 chunks > 500KB** | ⚠️ vendor-misc + vendor-pdf |

**Overall:** Good compression ratio (74% Brotli reduction) but 2 chunks are oversized. The main issue is **lodash-es not being tree-shaken** — the entire library is bundled despite only importing `debounce`.

---

## 2. Chunk Breakdown (Top 15)

| Rank | Chunk | Size | Brotli | Ratio | Contents |
|------|-------|------|--------|-------|----------|
| 1 | **vendor-misc** | 1,004 KB | 324 KB | 68% | lodash-es, motion-dom, motion-utils, core-js, pako, fflate, dompurify, noble-ciphers |
| 2 | **vendor-pdf** | 1,295 KB | 269 KB | 79% | @react-pdf/renderer, jspdf, pdfkit, yoga-layout WASM, fontkit, png-js |
| 3 | **vendor-supabase** | 195 KB | 41 KB | 79% | @supabase/supabase-js, @supabase/realtime-js |
| 4 | **vendor-analytics** | 189 KB | 53 KB | 72% | posthog-js, @sentry/react, web-vitals |
| 5 | **vendor-react** | 144 KB | 39 KB | 73% | react, react-dom, scheduler, jsx-runtime |
| 6 | **vendor-forms** | 91 KB | 24 KB | 74% | react-hook-form, zod, @hookform/resolvers |
| 7 | **index** (main) | 86 KB | 20 KB | 77% | App entry, shared components, hooks |
| 8 | **Booking** | 78 KB | 17 KB | 78% | Booking page, date select, time slots |
| 9 | **vendor-radix** | 61 KB | 16 KB | 74% | @radix-ui/* (Dialog, Sheet, Select, Toast, etc.) |
| 10 | **vendor-ui-utils** | 49 KB | 14 KB | 71% | embla-carousel, sonner, vaul, cmdk |
| 11 | **OpenGames** | 42 KB | 9 KB | 79% | OpenGames page, OpenGameCard |
| 12 | **vendor-framer** | 40 KB | 13 KB | 68% | framer-motion |
| 13 | **Home** | 40 KB | 10 KB | 75% | Home page, HeroCarousel, CategoryPills |
| 14 | **Admin** | 36 KB | 8 KB | 78% | Admin page, dashboard |
| 15 | **vendor-query** | 33 KB | 9 KB | 73% | @tanstack/react-query |

**Total:** 3,556 KB uncompressed → 931 KB Brotli

---

## 3. Critical Issues Found

### 3.1 🔴 CRITICAL: lodash-es Not Tree-Shaken

**Impact:** ~150-200 KB of unnecessary code in vendor-misc

**Root Cause:** The `debounce` import from `lodash-es` is pulling the entire lodash library into the bundle. Despite only using:

```tsx
// ClientDashboard.tsx
import { debounce } from "lodash-es";
```

The bundle contains **640+ lodash modules** including: `map`, `filter`, `reduce`, `find`, `groupBy`, `sortBy`, `memoize`, `throttle`, `cloneDeep`, `merge`, `isEqual`, etc. — all unused.

**Why this happens:** `lodash-es` is an ES module build, but Rollup/Vite may not be tree-shaking it effectively because:
- The `debounce` function itself imports internal utilities (`_MapCache`, `_memoizeCapped`, etc.)
- These utilities pull in a cascade of other lodash internals
- The final result is the entire lodash utility set being bundled

**Fix:** Replace with a lightweight alternative:

```tsx
// Option A: Use native setTimeout (no library needed)
// Option B: Use just-debounce or lodash.debounce (standalone package)
// Option C: Write a minimal debounce helper (~20 lines)
```

**Estimated savings:** 150-200 KB uncompressed, ~50 KB Brotli

---

### 3.2 🟡 HIGH: Framer Motion Sub-Dependencies in Wrong Chunk

**Impact:** ~80-100 KB in vendor-misc instead of vendor-framer

**Root Cause:** The manual chunk rule only catches `framer-motion/` but Framer Motion v12 uses separate packages:
- `motion-dom` (DOM utilities)
- `motion-utils` (shared utilities)

These are in `node_modules/motion-dom/` and `node_modules/motion-utils/` — NOT caught by `id.includes("framer-motion")`.

**Fix:** Update manual chunks in `vite.config.ts`:

```js
// Framer Motion — includes sub-packages
if (
  id.includes("node_modules/framer-motion") ||
  id.includes("node_modules/motion-dom") ||
  id.includes("node_modules/motion-utils")
) {
  return "vendor-framer";
}
```

**Estimated savings:** Better cache efficiency (no size change, but chunk is properly organized)

---

### 3.3 🟡 HIGH: lucide-react Bundles ALL Icons

**Impact:** 1,548 icon files bundled → ~20 KB chunk (acceptable)

**Status:** Acceptable but could be optimized

The `vendor-icons` chunk is 20 KB (6.5 KB Brotli) which is reasonable. However, the bundle contains **all 1,548 Lucide icons** even though only ~30-40 are used.

**Fix:** Use `lucide-react` with tree-shaking or switch to unplugin-icons:

```tsx
// Current: imports entire icon library (bundled once, cached well)
import { X, Star, MapPin, Calendar } from "lucide-react";

// Alternative: Use individual icon imports (not supported by lucide-react)
// Or: Switch to @lucide/react (if available with tree-shaking)
```

**Recommendation:** Leave as-is. The 6.5 KB Brotli cost is minimal and having all icons cached is actually beneficial for a SPA where icons are used across many pages.

---

### 3.4 🟡 MEDIUM: core-js Polyfills in Bundle

**Impact:** ~50-80 KB in vendor-misc

**Root Cause:** `core-js` is being pulled in by either `jspdf` or `@react-pdf/renderer` (or their sub-dependencies). It's a polyfill library for older browsers.

Since the Vite target is `es2022, edge118, firefox120, chrome120, safari17`, modern browsers don't need these polyfills.

**Fix:** Add an alias to replace core-js with empty module:

```js
// vite.config.ts
resolve: {
  alias: [
    // ... existing aliases
    { find: "core-js", replacement: path.resolve(__dirname, "./src/empty-module.js") },
  ],
}
```

Where `empty-module.js` exports nothing:
```js
// src/empty-module.js
export default {};
```

**Risk:** Could break jspdf or @react-pdf if they genuinely need core-js features. Test thoroughly.

**Estimated savings:** 50-80 KB uncompressed, ~15 KB Brotli

---

### 3.5 🟡 MEDIUM: vendor-pdf is Large but Code-Split

**Impact:** 1.3 MB chunk (269 KB Brotli) — loaded on receipt pages only

**Status:** Acceptable with caveats

The PDF rendering libraries are heavy by nature:
- `@react-pdf/renderer` includes font rendering, layout engine (Yoga), image processing
- `jspdf` includes compression, font embedding, HTML-to-canvas
- `yoga-layout` includes a WASM binary for CSS layout

This chunk is **code-split at the route level** — it's only loaded when visiting:
- `/booking/:id` (receipt)
- `/booking/:id/success` 
- Host booking receipt pages

**Recommendation:** Acceptable for now. PDF rendering is inherently expensive. Consider:
- Server-side PDF generation (future backend improvement)
- Using a lighter PDF library for simple tickets (e.g., PDFKit server-side)

---

## 4. Minor Issues

### 4.1 Duplicate `@react-pdf/reconciler` scheduler

The bundle shows a separate `scheduler` inside `@react-pdf/reconciler/node_modules/`. This is a nested dependency of @react-pdf that uses its own React reconciler version. It adds ~5-10 KB. Not fixable without removing @react-pdf.

### 4.2 dompurify in vendor-misc

`dompurify` (~15 KB) is included but only used for HTML sanitization in jspdf/html2canvas. Not independently fixable.

### 4.3 @noble/ciphers in vendor-misc

Cryptography utilities (~20 KB) pulled in by jspdf for PDF encryption. Not independently fixable.

---

## 5. Optimization Recommendations (Prioritized)

| Priority | Fix | Estimated Savings | Effort |
|----------|-----|---------------------|--------|
| 🔴 P0 | Replace lodash-es with standalone debounce | **150-200 KB** | Low |
| 🟡 P1 | Fix Framer Motion manual chunk rule | **Better caching** | Low |
| 🟡 P2 | Test core-js alias removal | **50-80 KB** | Medium |
| 🟡 P3 | Lazy-load jspdf (not just @react-pdf) | **~200 KB deferred** | Medium |
| 🟢 P4 | Evaluate lucide-react vs tree-shaking | **~10 KB** | Low |
| 🟢 P5 | Server-side PDF generation (future) | **1.3 MB removed** | High |

**Total Potential Savings:** ~250-350 KB uncompressed, ~80-120 KB Brotli

**Projected JS size after fixes:** ~3.2 MB uncompressed, ~0.85 KB Brotli

---

## 6. Cache Strategy Assessment

### Long-term caching (good):

| Chunk | Changes | Cache TTL |
|-------|---------|-----------|
| vendor-react | Rarely | 1 year |
| vendor-router | Rarely | 1 year |
| vendor-radix | Rarely | 1 year |
| vendor-supabase | Rarely | 1 year |
| vendor-framer | Occasionally | 1 year |
| vendor-query | Occasionally | 1 year |
| vendor-icons | On lucide updates | 1 year |
| vendor-forms | On form lib updates | 1 year |
| vendor-date | On date-fns updates | 1 year |
| vendor-pdf | On PDF lib updates | 1 year |
| vendor-misc | On ANY dependency update | 1 year |
| vendor-analytics | On analytics lib updates | 1 year |
| vendor-monitoring | On sentry updates | 1 year |
| index | On app changes | 1 year |
| Route chunks | On page changes | 1 year |

### Problem: vendor-misc is a "cache invalidation magnet"

Because vendor-misc is the catch-all bucket, ANY dependency update (even adding a small utility) invalidates the entire 1MB chunk. This is the biggest cache-efficiency problem.

**Recommendation:** Extract more categories from vendor-misc:
- `vendor-polyfills` (core-js)
- `vendor-compression` (pako, fflate, brotli)
- `vendor-crypto` (@noble/ciphers, js-md5)
- `vendor-motion` (motion-dom, motion-utils)

---

## 7. PWA Precache Impact

The workbox precaches **103 entries** (37.7 MB total). This includes:
- All JS chunks (original + compressed)
- CSS
- HTML
- Icons, images, fonts

**Warning:** The PWA caches the **original** files, not .br files. So the 1MB vendor-misc and 1.3MB vendor-pdf are both cached uncompressed. This means:

- Cache storage used: ~37 MB (includes both original and .br)
- Actual served: Brotli compressed (0.93 MB total)
- **Cache quota risk:** On devices with low storage (especially older Android), 37MB could exceed the default quota.

**Recommendation:** The PWA config has `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` which allows files up to 5MB. The vendor-pdf (1.3MB) and vendor-misc (1MB) are within this limit.

Consider:
- Removing .br and .gz files from precache (they're not needed — browser handles compression)
- The current globPattern `**/*.{js,css,html,ico,png,svg,webp,woff2}` may be catching .br files too

---

## 8. Build Configuration Assessment

### What's Working Well ✅

- **Terser minification** with `drop_console` and `drop_debugger` in production
- **Brotli + Gzip** compression for all assets
- **Module preloading** with polyfill
- **Manual chunking** strategy is sound (just needs minor fixes)
- **CSS code splitting** enabled
- **Long-term caching** via content hashing (8-char hash)
- **Source maps disabled** in production
- **CSS minification** enabled
- **Target modern browsers** (es2022+)

### What Could Be Improved ⚠️

1. **chunkSizeWarningLimit** is 500 KB but 2 chunks exceed this. Consider raising to 1000 KB or fixing the root causes.
2. **reportCompressedSize** is `false` for faster builds — good for CI, but consider enabling for analysis
3. **assetsInlineLimit** is 4KB — good for small icons/SVGs
4. **Vite dedupe** includes react, react-dom, tanstack — good

---

## 9. Conclusion

| Category | Score | Notes |
|----------|-------|-------|
| Chunk splitting | 8/10 | Good strategy, minor mis-categorization |
| Tree-shaking | 5/10 | lodash-es is the biggest failure |
| Compression | 9/10 | Brotli + Gzip, good ratios |
| Caching | 7/10 | vendor-misc is a cache invalidation risk |
| PWA precache | 7/10 | 37MB is large but manageable |
| Bundle size | 6/10 | 3.56MB is above ideal but 0.93MB Brotli is acceptable |

**Overall Bundle Health: 7/10**

The bundle is well-structured with good code splitting and compression. The main issues are:
1. lodash-es not being tree-shaken (easy fix, big impact)
2. Framer Motion sub-packages in wrong chunk (easy fix)
3. core-js polyfills for modern browsers (medium risk fix)

**Recommended next action:** Fix the lodash-es import first. This is the single highest-impact, lowest-effort optimization.

---

## 10. Files Analyzed

- `vite.config.ts` — build configuration
- `dist/assets/*.js` — 58 JS chunks
- `dist/assets/*.js.br` — 51 Brotli compressed files
- `dist/assets/css/*.css` — 1 CSS file
- `bundle-stats.html` — rollup-plugin-visualizer output (2.2MB)
- `package.json` — dependency list
- `src/utils/generateInvoice.tsx` — PDF generation imports
- `src/hooks/useBookingTicket.ts` — jspdf import
- `src/pages/ClientDashboard.tsx` — lodash import
