# Open Game Card Redesign — Implementation Plan

## 1. Current State vs. New Design

### Current Card (`OpenGames.tsx` inline, ~ lines 537-773)
- **Structure**: Image on top (h-36), body below with stacked sections
- **Elements**: Status badge, private badge, sport icon (overlaps image), title, metadata row, progress bar, host section, features bar (3 cols), action button, metadata footer, pending requests banner
- **Issues**: Too many stacked sections, features bar takes vertical space, sport icon is small, no player avatar preview, image height is only 144px

### New Design (from `crde host.png`)
- **Structure**: Large hero image (~50% of card height) with overlaid badges + floating player avatars, dark body below
- **Key visual differences**:
  1. **Larger image area** — takes more visual weight
  2. **Player avatars floating on image** — shows "+N" count
  3. **Sport icon overlapping image bottom-left** — bigger, more prominent
  4. **Title next to sport icon** — horizontal layout
  5. **Compact metadata row** — single line with icons
  6. **Progress bar with "Court split progress" label** — matches existing but cleaner
  7. **Host + Price in one row** — cleaner layout
  8. **Large green CTA button** — "Join Match" with arrow, full width, rounded-xl
  9. **Bottom metadata strip** — Sport | Format | Surface (3 cols, no icons in labels)
  10. **Removed**: Features bar (Secure Payments, Fair Play, Easy Cancel) — unnecessary on card

---

## 2. Data Model Check

| New Design Field | Existing Data? | Source |
|------------------|---------------|--------|
| Sport name | ✅ `g.sport` | `OpenGame.sport` |
| Venue name | ✅ `g.venue` | `OpenGame.venue` |
| Date | ✅ `g.date` | `OpenGame.date` |
| Time | ✅ `g.time` | `OpenGame.time` |
| Duration | ✅ `g.duration_hours` | `OpenGame.duration_hours` |
| Slots filled / total | ✅ `g.slots_filled`, `g.slots_total` | `OpenGame` |
| Host name | ✅ `g.host_name` | `OpenGame.host_name` |
| Host avatar | ⚠️ `g.host_avatar` | exists but may be empty |
| Price per slot | ✅ `g.price_per_slot` | `OpenGame.price_per_slot` |
| Status (open/full) | ✅ `g.status` | `OpenGame.status` |
| Private flag | ✅ `g.is_private` | `OpenGame.is_private` |
| Player avatars | ✅ `g.players[].avatar` | `OpenGame.players` |
| **Surface** | ❌ **Missing** | Hardcoded "Outdoor" or needs turf lookup |
| **Cover image** | ✅ `turfs.find(t => t.id === g.turf_id)?.image` | Turf data |

### Action Required: Surface Field
- The new design shows **Surface: Outdoor** in the bottom strip.
- The `OpenGame` type has **no `surface` field**.
- **Options**:
  1. Hardcode "Outdoor" for MVP (current code does this)
  2. Look up from `turfs` array: `turfs.find(t => t.id === g.turf_id)?.surface`
  3. Add `surface` to `OpenGame` interface and populate in backend/API
- **Recommendation**: Use option 2 (look up from turf) for now, fallback to "Outdoor".

---

## 3. Component Architecture

### Proposed File Structure
```
components/src/open-games/
├── OpenGameCard.tsx          # NEW — extracted card component
├── OpenGameCardSkeleton.tsx  # NEW — loading shimmer (optional)
└── index.ts                  # NEW — barrel export
```

### Why Extract?
- `OpenGames.tsx` is currently **1,365 lines** — the card JSX alone is ~240 lines inline inside the `games.map()` callback
- Extracting improves readability, enables reuse, and makes the card independently testable
- The new card has enough complexity to warrant its own component

### Component Props
```typescript
interface OpenGameCardProps {
  game: OpenGame;
  turfImage?: string;           // resolved cover image URL
  turfSurface?: string;         // resolved surface type
  index?: number;               // for stagger animation delay
  onCardClick: (game: OpenGame) => void;      // navigate to detail
  onJoinClick: (game: OpenGame) => void;      // open join drawer
  onManageClick: (game: OpenGame) => void;    // open manage modal
}
```

---

## 4. Layout & Styling Changes

### New Card Layout (top-to-bottom)

```
┌─────────────────────────────────────────┐
│ [OPEN ●]              [🔒 Private]      │  ← top badges (absolute)
│                                         │
│         [HERO IMAGE]                      │  ← h-48 or h-52, object-cover
│         basketball court                │
│                                         │
│    [🏀icon]  [avatar+avatar+avatar +5]  │  ← sport icon (bottom-left)
│                                         │     avatars (bottom-right)
├─────────────────────────────────────────┤
│ 5-a-side Basketball                     │  ← title + sport icon row
│ 📍 Greenfield Arena | 📅 26 Jun | ⏰ 13:00 │  ← metadata row
│                                         │
│ Court split progress                    │
│ █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │  ← progress bar
│ 1/10 joined          9 spots left       │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │  [M]  HOST        YOUR SHARE        │ │  ← host + price row
│ │  Moms Moko        ₹100              │ │
│ │  ✔ Verified Host                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │         Join Match    >             │ │  ← large green CTA
│ └─────────────────────────────────────┘ │
│                                         │
│ 🏀 Sport   📊 Format   📍 Surface     │  ← bottom strip
│ Basketball 5-a-side    Outdoor        │
└─────────────────────────────────────────┘
```

### Tailwind Classes to Use (matching existing design system)

| Element | Current Classes | New Classes |
|---------|----------------|-------------|
| Card container | `glass rounded-[2rem] overflow-visible` | `glass rounded-[2rem] overflow-hidden` (keep `overflow-hidden` for image) |
| Hero image | `h-36` | `h-48` or `h-52` ( taller, more impact) |
| Status badge | `absolute top-3.5 left-3.5` | Same position, but styled as pill with green bg |
| Private badge | `absolute top-3.5 right-3.5` | Same position, amber with lock icon |
| Sport icon | `absolute -bottom-5 left-5 z-10 w-11 h-11` | Same position, but larger `w-13 h-13` or `w-14 h-14` |
| Player avatars | **Doesn't exist** | `absolute bottom-3 right-3` — row of 3 avatars + "+N" pill |
| Title | `font-display font-black text-xl` | `font-display font-black text-xl mt-2` |
| Metadata row | `flex items-center flex-wrap gap-x-2 gap-y-1.5` | Same, but more compact |
| Progress bar | Existing `bg-surface/50 rounded-2xl p-3.5` | Same, but remove redundant outer border |
| Host section | `flex items-center justify-between bg-surface/30` | Simplify — remove excessive borders, make it a single clean row |
| CTA button | `w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500` | Same gradient, but **larger padding** `py-3.5`, **rounded-2xl**, and add `shadow-lg` |
| Bottom strip | `grid grid-cols-3 gap-2` | Same 3-col grid, but with subtle top border instead of border-t/border-b |
| Features bar | **REMOVE entirely** | Not in new design |

### Design System Tokens to Preserve
- `font-display` for headings
- `text-foreground` for primary text
- `text-textMuted` for secondary text
- `text-emerald-400` for accent/green elements
- `bg-surface/50` or `bg-panel-2` for inner panels
- `border-border/20` for subtle borders
- `shadow-card` for card shadow
- `shadow-neon` for glow effects

---

## 5. Step-by-Step Implementation

### Phase 1: Extract & Create Component (Safe, No Visual Change Yet)
1. **Create `components/src/open-games/OpenGameCard.tsx`**
   - Copy the existing card JSX from `OpenGames.tsx` lines 537-773
   - Convert to a standalone component with typed props
   - Keep all existing logic (status, player states, host checks, etc.)
   - Export the component
2. **Create `components/src/open-games/index.ts`** barrel export
3. **Update `OpenGames.tsx`**
   - Replace inline card JSX with `<OpenGameCard {...props} />`
   - Import the new component
   - Verify no visual changes (smoke test)

### Phase 2: Apply New Layout (Visual Change)
4. **Update `OpenGameCard.tsx` layout**
   - Increase image height: `h-36` → `h-48` or `h-52`
   - Add player avatar stack on image (bottom-right)
   - Enlarge sport icon overlap
   - Move title to be inline with sport icon
   - Remove the "Features Bar" (Secure Payments / Fair Play / Easy Cancel)
   - Restyle host section to be more compact (single row)
   - Enlarge CTA button: `py-3.5`, `rounded-2xl`, add shadow
   - Clean up bottom metadata strip
5. **Add `surface` resolution logic**
   - In `OpenGames.tsx`, pass `turfSurface` to each card by looking up `turfs.find(t => t.id === g.turf_id)?.surface` or `?.type` or fallback to "Outdoor"

### Phase 3: Polish & Refinement
6. **Refine badge styling**
   - "OPEN" badge: green pill with dot + pulse animation
   - "Private Match" badge: amber pill with lock icon
   - Make badges match the design more closely (rounded-full, backdrop-blur)
7. **Refine progress bar**
   - Keep existing progress bar but adjust label to "Court split progress"
   - Ensure colors match: `from-emerald-500 to-primary`
8. **Refine typography**
   - Ensure title is bold enough (`font-black`)
   - Ensure metadata is compact (`text-[10px]` uppercase)
   - Ensure price is large (`text-base font-black text-emerald-400`)

### Phase 4: Testing & Cleanup
9. **Verify responsive behavior** — max-width is 480px (mobile-first)
10. **Verify all states render correctly**:
    - Open public game
    - Full game
    - Cancelled game
    - Private match
    - User is host
    - User is already joined
    - User is pending approval
    - User is approved (needs payment)
11. **Remove unused imports** from `OpenGames.tsx` after extraction
12. **Check TypeScript** — `tsc --noEmit` or build

---

## 6. Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Extract component? | **Yes** | `OpenGames.tsx` is 1365 lines; card is 240 lines inline. Extraction is necessary. |
| Keep Features Bar? | **No** | New design doesn't have it. It adds clutter without value on the card. |
| Image height? | `h-48` (192px) | New design gives the image more visual weight. Current `h-36` (144px) feels cramped. |
| Player avatars on image? | **Yes** | Core visual element of the new design. Shows social proof. |
| Surface data source? | Turf lookup + fallback | `OpenGame` has no `surface` field. Look up from `turfs` array. |
| Light theme support? | **Yes** | Check `html.light` classes and ensure the new card works in both themes. The existing `TurfCard.tsx` has premium/light theme splits. For MVP, keep the dark-theme path since the design is dark. |
| Preserve existing interactions? | **Yes** | All click handlers, drawer opens, modal opens, and payment flows remain identical. Only the visual presentation changes. |

---

## 7. Estimated Effort

| Phase | Estimated Time | Complexity |
|-------|---------------|------------|
| Phase 1: Extract component | 20 min | Low |
| Phase 2: Apply new layout | 45 min | Medium |
| Phase 3: Polish & refinement | 20 min | Low-Medium |
| Phase 4: Testing & cleanup | 15 min | Low |
| **Total** | **~100 min** | **Medium** |

---

## 8. Files to Modify

1. **NEW**: `components/src/open-games/OpenGameCard.tsx`
2. **NEW**: `components/src/open-games/index.ts`
3. **MODIFY**: `components/src/pages/OpenGames.tsx` — replace inline card with component usage
4. **MODIFY**: `components/src/types/openGames.ts` — optional: add `surface?: string` if desired

---

## 9. Visual Comparison Summary

| Element | Before | After |
|---------|--------|-------|
| Image height | 144px (`h-36`) | ~192px (`h-48`) |
| Player avatars | Not shown | 3 avatars + "+N" on image |
| Sport icon | Small, overlaps image | Larger, more prominent |
| Title | Below image, alone | Next to sport icon |
| Features bar | 3-col: Secure, Fair Play, Easy Cancel | **Removed** |
| Host section | Separate bordered box | Cleaner inline row |
| CTA button | Standard size | Larger, more prominent |
| Bottom strip | Icons + labels | Cleaner 3-col layout |
| Overall feel | Information-heavy | Image-first, premium |

---

*Plan generated for replacing the existing Open Games card with the new premium basketball-match card design.*
