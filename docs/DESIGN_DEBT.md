# PlayTurf Design Debt Register

> **Version:** 1.0 | **Updated:** 2025-07-05 | **Status:** Active Tracking

---

## Critical

| ID | Issue | Files | Impact | Effort | Phase |
|----|-------|-------|--------|--------|-------|
| C-1 | Dual-theme branches (`isPremium`) duplicate code | `TurfCard.tsx`, `CompactTurfCard.tsx`, `BookingRow.tsx`, `BottomNav.tsx` | 2x maintenance, easy desync, visual inconsistency | 12h | 4B-4E |
| C-2 | 150+ hardcoded hex colors | 20+ files | Changing primary color requires 50+ file edits | 8h | 4A |
| C-3 | Premium teal color contrast fails WCAG AA | Premium theme cards, badges | `#94A3B8` on `#FFFFFF` = 2.6:1 (needs 4.5:1) | 4h | 5 |

## High

| ID | Issue | Files | Impact | Effort | Phase |
|----|-------|-------|--------|--------|-------|
| H-1 | Dialog missing `aria-labelledby` | `ui/dialog.tsx` | WCAG 4.1.2 violation; screen readers can't identify dialogs | 1h | 5 |
| H-2 | No `aria-label` on header notification button | `layout/AppHeader.tsx` | Icon-only button lacks accessible name | 15min | 5 |
| H-3 | Admin delete button 36x36px (below 44px) | `pages/Admin.tsx` | WCAG 2.5.5 violation | 15min | 5 |
| H-4 | Dialog close button 32x32px | `ui/dialog.tsx` | WCAG 2.5.5 violation | 15min | 5 |
| H-5 | Input `text-[#f9fafb]` hardcoded | `ui/input.tsx` | Breaks in light theme | 30min | 4A |
| H-6 | TurfDetail video fixed `h-32 w-56` | `pages/TurfDetail.tsx` | Aspect ratio breaks on wide screens | 1h | 6 |

## Medium

| ID | Issue | Files | Impact | Effort | Phase |
|----|-------|-------|--------|--------|-------|
| M-1 | Booking sub-components have `text-[8px/9px/10px]` | `booking/BookingDateSelect.tsx`, `BookingMatchSummary.tsx`, `BookingRow.tsx`, `BookingSuccessReceipt.tsx`, `BookingTicket.tsx` | Inconsistent with 12px minimum rule | 4h | 6 |
| M-2 | `text-balance` utility defined but unused | `index.css:373` | Headings don't have optimal line breaks | 2h | 6 |
| M-3 | Custom `.line-clamp-1/2` instead of Tailwind plugin | `index.css:378-389` | Redundant; may conflict with Tailwind plugin | 1h | 6 |
| M-4 | LoadingFallback uses inline styles | `App.tsx` | Hardcoded rgba values | 30min | 6 |
| M-5 | NotFound page unstyled | `pages/NotFound.tsx` | No brand colors, no CTA | 1h | 6 |
| M-6 | Card component size API unintuitive | `ui/card.tsx` | `size="sm"` produces `text-lg` (18px) | 1h | 6 |
| M-7 | Receipt page layout not responsive | `pages/Receipt.tsx` | Fixed 4-col bottom bar truncates on 320px | 3h | 3 |
| M-8 | No landscape-specific layouts | All pages | Header carousel may crop in landscape | 4h | Future |

## Low

| ID | Issue | Files | Impact | Effort | Phase |
|----|-------|-------|--------|--------|-------|
| L-1 | Unused animation keyframes | `tailwind.config.ts` | `shimmer`, `float` defined but unused | 15min | 6 |
| L-2 | `font-black` (900) overused for tiny text | Multiple | 9px labels at 900 weight harm readability | 2h | 2 |
| L-3 | `max-w-[480px]` still in some modals/drawers | Various | Not yet updated to responsive breakpoints | 2h | 3 |
| L-4 | `min-[360px]:grid-cols-2` arbitrary breakpoint | `Home.tsx` | Non-standard; should use `sm:` | 30min | 6 |
| L-5 | Home.tsx horizontal scroll lacks snap | `Home.tsx` | Scroll feels loose on touch devices | 1h | 6 |

---

## Resolved Debt (Phases 1-3)

| ID | Issue | Resolution |
|----|-------|------------|
| R-1 | `overflow-wrap: anywhere` on all buttons/links | Fixed: `break-word` |
| R-2 | `h-10` input below WCAG 44px | Fixed: `min-h-[44px]` |
| R-3 | `sm: h-9` button below WCAG 44px | Fixed: `sm: min-h-[44px]` |
| R-4 | Auth forms missing labels | Fixed: Added `<label htmlFor>` |
| R-5 | Password toggles missing `aria-label` | Fixed: Added `aria-label` |
| R-6 | Inline fontSize in 13 files | Fixed: Replaced with Tailwind classes |
| R-7 | Dead fontSize tokens in tailwind.config.ts | Fixed: Removed 15 tokens |
| R-8 | Base headings in px (no browser scaling) | Fixed: Rem units |
| R-9 | `text-[8px/9px/11px]` in main pages | Fixed: `text-xs` |
| R-10 | MobileShell fixed 480px | Fixed: `md:max-w-[640px] lg:max-w-[768px]` |
| R-11 | AppHeader fixed 480px | Fixed: Responsive breakpoints |
| R-12 | BottomNav fixed 480px | Fixed: Responsive breakpoints |
| R-13 | Dialog narrow width | Fixed: `w-[92vw] max-w-md sm:max-w-lg md:max-w-xl` |
| R-14 | TurfDetail carousel fixed height | Fixed: `aspect-[16/9]` |
| R-15 | Admin grid 2-col on mobile | Fixed: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |

---

## Metrics

| Category | Count | Resolved | Remaining |
|----------|-------|----------|-----------|
| Critical | 3 | 0 | 3 |
| High | 6 | 0 | 6 |
| Medium | 8 | 0 | 8 |
| Low | 5 | 0 | 5 |
| **Total** | **22** | **15** | **22** |

**Debt Burn-Down Target:** All Critical + High resolved by end of Phase 5.
