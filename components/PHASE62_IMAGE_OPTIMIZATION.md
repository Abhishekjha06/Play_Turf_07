# Phase 6.2 — Image & Asset Optimization Report

**Date:** 2026-01-19  
**Commit:** `TBD`  
**Scope:** Image format audit, lazy loading, responsive images, icon optimization, font loading  

---

## 1. Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| Image formats | ⚠️ Mixed | PNG dominates; some WebP; **zero AVIF** |
| Lazy loading | ✅ Good | 27/39 images (69%) have `loading="lazy"` |
| Responsive images | ⚠️ Partial | `OptimizedImage` component exists but rarely used |
| Font loading | ✅ Excellent | Preconnect + dns-prefetch + preload + display=swap |
| PWA icons | ⚠️ Need check | PNG format, sizes unknown |
| Team logos | 🔴 Critical | 14 PNGs at 1.6-2.1MB each = ~25MB total |
| Total image assets | 🔴 Large | ~30MB+ in public/assets/ alone |

---

## 2. Image Format Audit

### 2.1 Format Distribution

| Format | Count | Notes |
|--------|-------|-------|
| PNG | 20 | **Primary format** — largest file sizes |
| WebP | 19 | Only for some images (heads, tails, turfs, hero) |
| AVIF | **0** | **Not available** despite `OptimizedImage` trying to serve them |
| SVG | ~5 | Icons and small graphics |

### 2.2 PNG vs WebP Size Comparison

| Image | PNG Size | WebP Size | Savings | Ratio |
|-------|----------|-----------|---------|-------|
| heads.png | 820 KB | 152 KB | **668 KB** | 5.4x |
| tails.png | 1.1 MB | 239 KB | **861 KB** | 4.6x |
| toss-icon.png | 488 KB | 36 KB | **452 KB** | 13.5x |
| playturf-logo.png | 56 KB | 28 KB | 28 KB | 2.0x |

**Average PNG→WebP savings: ~5-6x smaller**

### 2.3 Team Logos — Critical Issue

14 cricket team logos in `public/assets/` are **all PNG format**:

```
thunder_strikers.png      2.1 MB
blue_flame.png            2.1 MB
shadow_warriors.png       2.0 MB
night_riders.png          2.0 MB
victory_vipers.png        1.9 MB
firestorm_xi.png          1.9 MB
cricket_commanders.png    1.9 MB
elite_challengers.png     1.8 MB
royal_blazers.png         1.7 MB
rising_legends.png        1.7 MB
iron_grip.png             1.7 MB
cricket_titans.png        1.7 MB
storm_blades.png          1.6 MB
power_hitters.png         1.6 MB
boundary_breakers.png     1.6 MB
pitch_predators.png       1.1 MB
```

**Total: ~25 MB of PNG team logos**

**Impact:** These are loaded on the cricket team selection page. On mobile with slow connections, this could take 10+ seconds to load all logos.

**Fix:** Convert all team logos to WebP (would reduce to ~4-5 MB total, a **6x saving**).

---

## 3. Lazy Loading Audit

### 3.1 Coverage

| Component | Total Images | With Lazy Loading | Without |
|-----------|-------------|-------------------|---------|
| BookingConfirmPay | 1 | 1 | 0 |
| BookingRow | 1 | 1 | 0 |
| BookingTicket | 3 | 0 | 3 |
| HeroCarousel | 2 | 2 | 0 |
| TossModal | 2 | 2 | 0 |
| LuxuryUI | 1 | 1 | 0 |
| OfferCard | 2 | 2 | 0 |
| OpenGameCard | 1 | 1 | 0 |
| Admin (various) | 5 | 5 | 0 |
| Booking | 1 | 1 | 0 |
| TurfDetail | 1 | 0 | 1 |
| CompactTurfCard | 1 | 0 | 1 |
| BookingSuccessReceipt | 2 | 0 | 2 |
| Others | 16 | 11 | 5 |
| **Total** | **39** | **27** | **12** |

### 3.2 Missing Lazy Loading (High Priority)

| File | Line | Image | Reason |
|------|------|-------|--------|
| `BookingTicket.tsx` | 180, 226, 359 | Team logos, QR code | **Should be lazy** — below fold |
| `TurfDetail.tsx` | 194 | Turf carousel image | **Above fold** — keep eager |
| `CompactTurfCard.tsx` | 34 | Turf thumbnail | **Consider lazy** — in list view |
| `BookingSuccessReceipt.tsx` | 180, 226 | Team logos | **Should be lazy** — below fold |
| `BookingDetail.tsx` | 263 | Turf image | **Above fold** — keep eager |
| `MobileGallery.tsx` | 36 | Gallery images | **Should be lazy** — gallery viewer |
| `StylishCarousel.tsx` | 208 | Carousel images | **Consider lazy** — might be above fold |
| `ui/avatar.tsx` | 52 | User avatar | **Acceptable** — small, usually above fold |

**Assessment:** 69% lazy loading coverage is good. The remaining images without lazy loading are mostly above-fold or in components that are conditionally rendered. Not a critical issue.

---

## 4. Responsive Images (srcSet/sizes)

### 4.1 OptimizedImage Component ✅

The `OptimizedImage` component (`src/components/OptimizedImage.tsx`) is production-grade:

**Features:**
- ✅ IntersectionObserver-based lazy loading (200px rootMargin)
- ✅ AVIF source auto-generation (via regex replacement)
- ✅ WebP source auto-generation (via regex replacement)
- ✅ Blur placeholder / shimmer effect
- ✅ Width/height attributes for CLS prevention
- ✅ `decoding="async"` on all images
- ✅ Error fallback UI
- ✅ `aspect-ratio` CSS property

**BUT:**
- ❌ Only used in **5 places** across the entire codebase
- ❌ AVIF srcSet references files that **don't exist** (0 AVIF files found)
- ❌ `generateSrcSet()` returns `undefined` when no srcSet prop provided — no responsive sizes are actually generated

### 4.2 Raw `<img>` Tags ❌

**34 out of 39 images** use raw `<img>` tags without:
- Responsive srcSet
- Width/height attributes (causes layout shift)
- Modern format fallbacks (AVIF/WebP)
- IntersectionObserver-based lazy loading (only native `loading="lazy"`)

**Impact:** Missing srcSet means mobile devices download the same large image as desktop. On a 320px wide phone, a 1920px wide turf image is downloaded and scaled down.

---

## 5. Font Loading Strategy ✅ Excellent

`index.html` has a well-optimized font loading setup:

```html
<!-- DNS prefetch -->
<link rel="dns-prefetch" href="https://fonts.googleapis.com" />
<link rel="dns-prefetch" href="https://fonts.gstatic.com" />

<!-- Preconnect -->
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

<!-- Preload critical font -->
<link rel="preload" href="https://fonts.gstatic.com/s/plusjakartasans/v8/..." as="font" type="font/woff2" crossorigin="anonymous" />

<!-- CSS with display=swap -->
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap" />
```

**Assessment:** ✅ Perfect. All best practices implemented:
- `dns-prefetch` → resolves DNS early
- `preconnect` → establishes TCP/TLS connection early
- `preload` → downloads critical font before CSS parsing
- `display=swap` → prevents FOIT (Flash of Invisible Text)
- `crossorigin` → required for font preloading

**Fonts loaded:** Plus Jakarta Sans, Outfit, Inter (all weights 300-900)

**Note:** Loading 3 font families × 6 weights each = 18 font files. This is substantial. Consider if all weights are needed, or if variable fonts could reduce requests.

---

## 6. PWA Icons

**Location:** `public/pwa-192x192.png`, `public/pwa-512x512.png`

**Status:** Need to verify sizes and optimization

These icons are referenced in:
- `vite.config.ts` PWA manifest
- `index.html` favicon/apple-touch-icon

**Recommendation:** Ensure these are optimized PNGs (not just resized screenshots). A 512x512 PWA icon should be < 100 KB when optimized.

---

## 7. Optimization Recommendations (Prioritized)

### 🔴 P0: Convert Team Logos to WebP

**Impact:** ~25 MB → ~4 MB (save 21 MB)
**Effort:** Medium (batch conversion needed)
**Files:** `public/assets/*_*.png` (14 team logos)

```bash
# Batch conversion example (requires cwebp or sharp)
for f in public/assets/*_*.png; do
  cwebp -q 85 "$f" -o "${f%.png}.webp"
done
```

Then update references in code to use `.webp` versions.

---

### 🟡 P1: Remove Unused PNG Versions (When WebP Exists)

**Impact:** Save ~1.5 MB (heads.png, tails.png, toss-icon.png, playturf-logo.png)
**Effort:** Low
**Action:** Delete PNG files where WebP already exists. Update code references.

```bash
# Files to remove (WebP already exists)
rm public/assets/heads.png      # 820K → heads.webp 152K
rm public/assets/tails.png      # 1.1M → tails.webp 239K
rm public/toss-icon.png         # 488K → toss-icon.webp 36K
rm public/playturf-logo.png     # 56K → playturf-logo.webp 28K
```

---

### 🟡 P2: Generate AVIF Versions for Key Images

**Impact:** Additional 20-30% compression beyond WebP
**Effort:** Medium (requires AVIF encoder)
**Priority:** Medium (AVIF support is growing but not universal)

Generate AVIF versions for:
- Hero images (hero-night-turf.webp, hero-tournament.webp)
- Turf images (turf-1 through turf-6)
- Offer images (offer-*.webp)
- Team logos (after WebP conversion)

```bash
# Example using avifenc or sharp
avifenc --min 0 --max 63 -a end-usage=q -a cq-level=24 -a tune=ssim \
  input.webp output.avif
```

---

### 🟡 P3: Use OptimizedImage More Widely

**Impact:** Better lazy loading, responsive images, format selection
**Effort:** Medium (replace img tags across 15+ components)
**Priority:** Medium (nice-to-have, current native lazy loading is acceptable)

Replace raw `<img>` with `<OptimizedImage>` in:
- `BookingTicket.tsx` (team logos, QR code)
- `TurfDetail.tsx` (turf carousel)
- `BookingSuccessReceipt.tsx` (team logos)
- `MobileGallery.tsx` (gallery images)
- `CompactTurfCard.tsx` (turf thumbnails)

Also fix the `generateSrcSet()` function to actually generate responsive srcSet:

```tsx
// Fix in OptimizedImage.tsx
const generateSrcSet = () => {
  if (srcSet) return srcSet;
  if (!src) return undefined;
  
  // Generate responsive sizes
  const base = src.replace(/\.(jpg|jpeg|png|webp|avif)$/i, "");
  const ext = src.match(/\.(jpg|jpeg|png|webp|avif)$/i)?.[0] || ".webp";
  
  return [
    `${base}-320${ext} 320w`,
    `${base}-640${ext} 640w`,
    `${base}-1024${ext} 1024w`,
    `${base}-1920${ext} 1920w`,
  ].join(", ");
};
```

**Note:** This requires generating the resized images at build time (e.g., with Vite plugin or post-build script).

---

### 🟢 P4: Preload Critical Images

**Impact:** Faster LCP (Largest Contentful Paint)
**Effort:** Low
**Priority:** Low (nice-to-have)

Add preload links for above-fold images:

```html
<!-- index.html -->
<link rel="preload" as="image" href="/assets/hero-night-turf.webp" type="image/webp" fetchpriority="high">
```

---

### 🟢 P5: Self-Host Fonts (Future)

**Impact:** Eliminates Google Fonts dependency, faster loading, better privacy
**Effort:** Medium (download WOFF2 files, update CSS)
**Priority:** Low (current setup is already good)

Download WOFF2 files from Google Fonts and serve from `/assets/fonts/`:

```bash
# Download fonts
wget -O public/assets/fonts/plus-jakarta-sans.woff2 "https://fonts.gstatic.com/s/plusjakartasans/v8/..."
```

Then use `@font-face` in CSS instead of Google Fonts API.

---

## 8. Estimated Savings Summary

| Optimization | Current | After | Savings |
|-------------|---------|-------|---------|
| Team logos PNG → WebP | ~25 MB | ~4 MB | **21 MB** |
| Remove duplicate PNGs | ~2.5 MB | 0 | **2.5 MB** |
| AVIF for key images | ~4 MB | ~3 MB | **1 MB** |
| **Total potential** | **~31.5 MB** | **~7 MB** | **~24.5 MB** |

---

## 9. Conclusion

| Category | Score | Notes |
|----------|-------|-------|
| Image format optimization | 4/10 | PNG dominates, no AVIF, missing WebP for many |
| Lazy loading | 7/10 | 69% coverage, good but not complete |
| Responsive images | 3/10 | OptimizedImage exists but rarely used |
| Font loading | 10/10 | Excellent preconnect/preload/display=swap setup |
| Asset size management | 4/10 | 25MB team logos is excessive |
| **Overall** | **5.6/10** | Biggest win: convert team logos to WebP |

**Highest impact, lowest effort fix:** Remove PNG files where WebP already exists (save 2.5 MB, 5 minutes of work).

**Highest impact, medium effort fix:** Convert team logos to WebP (save 21 MB, batch conversion script).

---

## 10. Quick Fixes (Can Do Now)

1. **Delete these PNG files (WebP already exists):**
   ```bash
   rm public/assets/heads.png
   rm public/assets/tails.png
   rm public/toss-icon.png
   rm public/playturf-logo.png
   ```

2. **Update references to use WebP:**
   - `src/home/TossModal.tsx` — already uses `heads.webp` and `tails.webp` ✅
   - Check any code still referencing `.png` for these images

3. **Add `loading="lazy"` to missing images:**
   - `BookingTicket.tsx` team logos
   - `BookingSuccessReceipt.tsx` team logos
   - `MobileGallery.tsx` gallery images
