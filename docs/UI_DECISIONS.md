# PlayTurf UI Architecture Decision Log (ADL)

> **Version:** 1.0 | **Updated:** 2025-07-05 | **Owner:** Principal Frontend Architect
> **Status:** Active | **Scope:** All UI/UX decisions

---

## How to Use This Document

Every architectural decision is recorded here with:
- **Decision ID** — unique identifier
- **Decision** — what was decided
- **Context** — why it was needed
- **Rationale** — why this option was chosen
- **Consequences** — what this means for the codebase
- **Status** — Active, Deprecated, or Under Review

When considering a change that contradicts a recorded decision, first update this document with a new decision explaining the override.

---

## AD-001: Minimum Readable Font Size is 12px (`text-xs`)

| | |
|---|---|
| **Decision** | No text in the application may be smaller than 12px (`text-xs` in Tailwind). All `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]` must be replaced. |
| **Context** | Audit found 200+ inline `fontSize` declarations ranging from 8px to 48px with no consistency. 8px text (~6pt) is illegible for many users. |
| **Rationale** | WCAG 1.4.4 Resize Text requires text to be readable at browser default sizes. 12px is the minimum size for body text that remains legible on standard displays. It also standardizes the typography system. |
| **Consequences** | Booking flow labels grew from 8–9px to 12px, which may cause slight layout shifts but dramatically improves readability. No exceptions without ADL override. |
| **Status** | Active |
| **Phase** | Phase 2 |
| **Related** | AD-002 (inline styles), AD-013 (Tailwind tokens) |

---

## AD-002: No Inline `style={{ ... }}` for Styling

| | |
|---|---|
| **Decision** | Inline `style={{ fontSize: "...", color: "#..." }}` is prohibited for visual styling. Use Tailwind utility classes or CSS custom properties exclusively. |
| **Context** | Audit found ~200 inline `fontSize` declarations, ~150 hardcoded hex colors, ~50 fixed heights, ~40 fixed widths. Changing a single color required editing 50+ files. |
| **Rationale** | Inline styles bypass the design system entirely. They cannot be overridden by themes, media queries, or user preferences. They make bulk changes impossible and guarantee inconsistency. |
| **Consequences** | All component styling now flows through Tailwind or CSS variables. This enables theme switching, responsive behavior, and bulk color changes from a single source of truth. |
| **Status** | Active |
| **Phase** | Phase 2, ongoing Phase 4 |
| **Exception** | `react-pdf` components (`InvoiceDocument.tsx`) may use inline styles because they render to a PDF context outside the DOM/CSS cascade. |
| **Related** | AD-001 (font size), AD-003 (hardcoded colors), AD-014 (CSS variables) |

---

## AD-003: No Hardcoded Hex/RGBA Colors

| | |
|---|---|
| **Decision** | All colors must use CSS custom properties (`var(--color-...)`) or Tailwind semantic utilities (`text-primary`, `bg-surface`). No `#14B8B0`, `rgba(255,255,255,0.55)`, or similar literals in JSX/CSS. |
| **Context** | Audit found 150+ hardcoded hex colors across 20+ files. The premium teal theme and AMOLED dark theme duplicated entire component implementations because colors were baked into JSX. |
| **Rationale** | Hardcoded colors make theme switching impossible and create visual inconsistency. A design system requires a single source of truth for color values. |
| **Consequences** | Phase 4 will systematically replace all hardcoded colors with semantic tokens. Until complete, some visual inconsistency remains. |
| **Status** | Active (enforcement in progress) |
| **Phase** | Phase 4.1–4.2 |
| **Related** | AD-002 (inline styles), AD-014 (CSS variables), AD-015 (semantic naming) |

---

## AD-004: Minimum Touch Target is 44px

| | |
|---|---|
| **Decision** | All interactive elements (buttons, inputs, nav items, checkboxes, dialog close) must have a minimum touch target of 44×44px. This is non-negotiable. |
| **Context** | Audit found `ui/input.tsx` at 40px (`h-10`), `ui/button.tsx` `sm:` variant at 36px (`h-9`), dialog close at 32px, header buttons at 36px. |
| **Rationale** | WCAG 2.5.5 Target Size (Level AAA) recommends 44×44px minimum. On touch devices, smaller targets lead to mis-taps and user frustration. |
| **Consequences** | Input and button heights increased. Some layouts shifted slightly. Dialog close and header buttons still need fixes (tracked in DESIGN_DEBT.md). |
| **Status** | Active |
| **Phase** | Phase 1, Phase 5 |
| **Related** | AD-005 (accessibility baseline) |

---

## AD-005: WCAG 2.1 AA as Accessibility Baseline

| | |
|---|---|
| **Decision** | The application targets WCAG 2.1 AA compliance as a minimum. This is a floor, not a ceiling. |
| **Context** | Initial audit found missing labels, missing ARIA attributes, insufficient color contrast, and sub-minimum touch targets. |
| **Rationale** | Legal compliance (many jurisdictions require it), ethical responsibility, and business value (broader user base including users with disabilities). |
| **Consequences** | Auth forms now have labels. Password toggles have `aria-label`. Touch targets meet 44px. Color contrast fixes are scheduled for Phase 5. |
| **Status** | Active |
| **Phase** | Phase 1, Phase 5 |
| **Related** | AD-004 (touch targets), AD-006 (form labels), AD-007 (ARIA) |

---

## AD-006: All Form Inputs Must Have Explicit `<label>`

| | |
|---|---|
| **Decision** | Every `<input>`, `<select>`, and `<textarea>` must have an associated `<label htmlFor="id">` or be wrapped in `<label>`. Placeholder text is not a substitute for a label. |
| **Context** | Login, Signup, and ForgotPassword forms used `placeholder` attributes as the only visible label, violating WCAG 3.3.2 Labels or Instructions. |
| **Rationale** | Screen readers announce labels. Placeholders disappear when users start typing, removing context. Labels are visible at all times and clickable to focus the input. |
| **Consequences** | Auth forms now have visible labels above each input. This increased vertical space slightly but dramatically improved usability. |
| **Status** | Active |
| **Phase** | Phase 1 |
| **Related** | AD-005 (WCAG AA), AD-007 (ARIA) |

---

## AD-007: Icon-Only Buttons Must Have `aria-label`

| | |
|---|---|
| **Decision** | Any `<button>` or `<a>` that contains only an icon (no visible text) must have an `aria-label` describing its action. |
| **Context** | Password visibility toggles, header notification bell, and dialog close buttons contained only icons with no accessible name. |
| **Rationale** | Screen readers cannot announce the purpose of an icon-only button without an accessible name. Users navigating by voice or keyboard have no way to understand what the button does. |
| **Consequences** | Password toggles now announce "Show password" / "Hide password". Header notification bell and dialog close still need fixes (tracked in DESIGN_DEBT.md). |
| **Status** | Active |
| **Phase** | Phase 1, Phase 5 |
| **Related** | AD-005 (WCAG AA), AD-006 (labels) |

---

## AD-008: One Mobile Shell with Responsive Breakpoints

| | |
|---|---|
| **Decision** | The application uses a single `MobileShell` container with responsive `max-width` breakpoints (`480px` → `640px` → `768px`) rather than multiple layouts or a fixed mobile-only width. |
| **Context** | `MobileShell` was hardcoded to `max-w-[480px]`, making the app a tiny centered column on tablets and desktops (33% width utilization on 1440px screens). |
| **Rationale** | Users open mobile web apps on iPads, tablets, and desktops. A 480px column on a 1440px monitor looks broken. Responsive breakpoints allow graceful expansion while maintaining the mobile-first design language. |
| **Consequences** | Shell now expands to 640px on tablets and 768px on desktops. Header, bottom nav, and dialogs scale accordingly. No layout duplication needed. |
| **Status** | Active |
| **Phase** | Phase 3 |
| **Related** | AD-009 (responsive breakpoints), AD-010 (mobile-first) |

---

## AD-009: Use Standard Tailwind Breakpoints Only

| | |
|---|---|
| **Decision** | Use Tailwind's standard breakpoints (`sm:`, `md:`, `lg:`, `xl:`) exclusively. Avoid arbitrary breakpoints like `min-[360px]:`. |
| **Context** | `Home.tsx` used `min-[360px]:grid-cols-2`, a non-standard breakpoint that doesn't align with the design system. |
| **Rationale** | Arbitrary breakpoints create inconsistency and are harder to maintain. Standard breakpoints are documented, tested, and understood by the whole team. |
| **Consequences** | `min-[360px]:grid-cols-2` will be replaced with `sm:grid-cols-2` in Phase 6. All future responsive work uses standard breakpoints. |
| **Status** | Active |
| **Phase** | Phase 6 |
| **Related** | AD-008 (mobile shell), AD-010 (mobile-first) |

---

## AD-010: Mobile-First Design Philosophy

| | |
|---|---|
| **Decision** | All design and implementation starts at 320px mobile width and scales up. Never design desktop-first and scale down. |
| **Context** | PlayTurf is a mobile-first sports turf booking app. 90%+ of users will access it on smartphones. |
| **Rationale** | Mobile-first forces prioritization of content and interaction. It's easier to add complexity for larger screens than to remove it for smaller ones. It aligns with Tailwind's mobile-first breakpoint philosophy. |
| **Consequences** | Base styles target 320px. `sm:`, `md:`, `lg:` progressively enhance. This is already the project's approach and will continue. |
| **Status** | Active |
| **Phase** | Ongoing |
| **Related** | AD-008 (shell), AD-009 (breakpoints) |

---

## AD-011: Use `aspect-ratio` Instead of Fixed Heights for Images

| | |
|---|---|
| **Decision** | Images, carousels, and media containers must use `aspect-[ratio]` (or `aspect-ratio` CSS property) instead of fixed pixel heights like `h-56` (224px). |
| **Context** | `TurfDetail.tsx` carousel used `h-56` (224px), which was 70% of screen height on 320px devices and looked tiny on tablets. |
| **Rationale** | Fixed heights don't adapt to screen width. `aspect-[16/9]` maintains proportions across all widths while allowing the container to scale naturally. |
| **Consequences** | TurfDetail carousel now uses `aspect-[16/9]`. All future image components must follow this pattern. Legacy fixed heights will be refactored in Phase 6. |
| **Status** | Active |
| **Phase** | Phase 3, Phase 6 |
| **Related** | AD-002 (inline styles) |

---

## AD-012: Global Word Breaking Uses `break-word`, Not `anywhere`

| | |
|---|---|
| **Decision** | Global word breaking uses `overflow-wrap: break-word` (breaks at word boundaries only). `overflow-wrap: anywhere` is prohibited globally. |
| **Context** | `index.css` had `button, a { overflow-wrap: anywhere; }`, causing words like "Cricket", "Football", and "Book Now" to break mid-character on narrow screens. |
| **Rationale** | `anywhere` inserts line breaks at any character position, producing unreadable text. `break-word` only breaks at natural word boundaries. For proper nouns (turf names), `word-break: keep-all` should be used. |
| **Consequences** | All buttons and links now break cleanly at word boundaries. Turf names may still need `word-break: keep-all` in narrow contexts. |
| **Status** | Active |
| **Phase** | Phase 1 |
| **Related** | AD-013 (Tailwind tokens) |

---

## AD-013: Use Tailwind Utility Classes, Not Arbitrary Values

| | |
|---|---|
| **Decision** | Prefer standard Tailwind utilities (`text-xs`, `p-4`, `rounded-lg`) over arbitrary values (`text-[11px]`, `p-[13px]`, `rounded-[7px]`). |
| **Context** | Audit found ~20 `text-[...px]` arbitrary values and numerous `p-[...px]`, `m-[...px]` patterns. These bypass the design system's spacing and typography scales. |
| **Rationale** | Arbitrary values create inconsistency and make the design system unenforceable. The spacing scale (4px base) and typography scale exist for a reason. |
| **Consequences** | Most arbitrary values have been replaced. Remaining ones are tracked in DESIGN_DEBT.md and will be addressed in Phase 6. |
| **Status** | Active |
| **Phase** | Phase 2, Phase 6 |
| **Related** | AD-001 (font size), AD-002 (inline styles) |

---

## AD-014: CSS Custom Properties as the Single Source of Truth

| | |
|---|---|
| **Decision** | All design tokens (colors, spacing, radius, shadows, motion) are defined as CSS custom properties in `index.css` and consumed via `var(--token)`. |
| **Context** | Colors were scattered across 20+ files as hardcoded hex values. There was no single source of truth for the design system. |
| **Rationale** | CSS variables are runtime-modifiable, theme-switchable, and cascade naturally. They work with Tailwind via `hsl(var(--token))` patterns and enable dark/light themes without conditional JSX. |
| **Consequences** | Phase 4 will expand the token system. Both themes will be driven by CSS variable overrides (`html.dark` / `html.light`), eliminating `isPremium` branches. |
| **Status** | Active |
| **Phase** | Phase 4.1 |
| **Related** | AD-003 (hardcoded colors), AD-015 (semantic naming) |

---

## AD-015: Semantic Token Naming, Not Literal

| | |
|---|---|
| **Decision** | Token names describe purpose, not value. Use `--color-primary`, not `--color-teal`. Use `--text-secondary`, not `--text-gray`. |
| **Context** | Early code used variable names like `$teal` or `$dark-bg`, which become meaningless when themes change. |
| **Rationale** | Semantic names survive theme changes. If the primary color changes from teal to purple, `--color-primary` is still correct. Literal names become lies. |
| **Consequences** | Token names in Phase 4 will follow this convention. All existing hardcoded colors will map to semantic tokens. |
| **Status** | Active |
| **Phase** | Phase 4.1 |
| **Related** | AD-014 (CSS variables) |

---

## AD-016: One Design System, Two Color Themes

| | |
|---|---|
| **Decision** | PlayTurf maintains a single design system with two color themes (dark/AMOLED and premium teal). There is no "premium mode" with different components — only different color tokens. |
| **Context** | The codebase had two parallel implementations of TurfCard, CompactTurfCard, BookingRow, and BottomNav based on `isPremium` flags. This was 2× code, 2× maintenance, and easy to desync. |
| **Rationale** | A design system has one set of components. Themes are skin changes, not structural changes. Duplicating components for themes is an anti-pattern that guarantees inconsistency. |
| **Consequences** | Phase 4.4 will remove all `isPremium` branches from components. `LuxuryThemeProvider` will inject CSS variables. Components will use semantic tokens exclusively. |
| **Status** | Active |
| **Phase** | Phase 4.4 |
| **Related** | AD-014 (CSS variables), AD-015 (semantic naming) |

---

## AD-017: Git Commit Between Every Sub-Phase

| | |
|---|---|
| **Decision** | Every sub-phase (4.1, 4.2, 4.3, 4.4, 4.5) ends with validation, a git commit, and a clean rollback point. No batching of unrelated changes. |
| **Context** | Phase 4 involves high-risk changes (color migration, theme unification, component refactoring). A single mistake could break the entire UI. |
| **Rationale** | Small commits with clear rollback points minimize blast radius. If 4.3 breaks TurfCard, we can revert just that commit without losing 4.1 and 4.2 work. |
| **Consequences** | More commits, but safer development. Each commit message describes the sub-phase for easy history reading. |
| **Status** | Active |
| **Phase** | All future phases |
| **Related** | AD-018 (validation gates) |

---

## AD-018: Validation Gate Before Every Commit

| | |
|---|---|
| **Decision** | Before every git commit in the modernization phases, run: `tsc --noEmit`, visual inspection, and responsive check at 320px/768px/1024px. |
| **Context** | TypeScript compiles cleanly but doesn't catch visual regressions, color mismatches, or layout shifts. |
| **Rationale** | Automated checks catch type and lint issues. Manual checks catch what automation misses. The combination prevents broken commits. |
| **Consequences** | Slightly slower commits, but dramatically higher confidence. The validation report template from Phase 3 will be reused for each sub-phase. |
| **Status** | Active |
| **Phase** | All future phases |
| **Related** | AD-017 (git commits) |

---

## AD-019: `text-balance` for All Headings

| | |
|---|---|
| **Decision** | All heading elements (`h1`–`h4`) and card titles should use `text-balance` for optimal line breaks. |
| **Context** | `index.css` defines `.text-balance { text-wrap: balance; }` but it is never used in any component. Headings often have awkward line breaks on narrow screens. |
| **Rationale** | `text-wrap: balance` distributes text evenly across lines, preventing single-word orphans and improving readability. It's supported in all modern browsers. |
| **Consequences** | Phase 6 will add `text-balance` to all headings. This is a purely additive improvement with no risk. |
| **Status** | Active |
| **Phase** | Phase 6 |
| **Related** | AD-013 (Tailwind utilities) |

---

## AD-020: No Component File Over 200 Lines

| | |
|---|---|
| **Decision** | React component files should not exceed 200 lines. Larger components must be decomposed into sub-components or hooks. |
| **Context** | `AppHeader.tsx` is 619 lines. `TurfCard.tsx` contains two complete component implementations in one file. This makes code review, testing, and maintenance difficult. |
| **Rationale** | Smaller files are easier to understand, test, and review. They encourage proper separation of concerns and reusable sub-components. |
| **Consequences** | Future refactoring will extract sub-components from large files. This is a guideline, not a hard rule — complex pages may reasonably exceed 200 lines if well-structured. |
| **Status** | Active (guideline) |
| **Phase** | Ongoing |
| **Related** | AD-016 (theme unification) |

---

## Decision Summary Table

| ID | Decision | Status | Phase | Risk |
|----|----------|--------|-------|------|
| AD-001 | Minimum font size 12px | Active | 2 | Low |
| AD-002 | No inline `style={{}}` for styling | Active | 2, 4 | Medium |
| AD-003 | No hardcoded hex/RGBA colors | Active | 4 | High |
| AD-004 | Minimum touch target 44px | Active | 1, 5 | Low |
| AD-005 | WCAG 2.1 AA baseline | Active | 1, 5 | Low |
| AD-006 | All inputs have `<label>` | Active | 1 | Low |
| AD-007 | Icon-only buttons have `aria-label` | Active | 1, 5 | Low |
| AD-008 | Responsive MobileShell | Active | 3 | Medium |
| AD-009 | Standard Tailwind breakpoints only | Active | 6 | Low |
| AD-010 | Mobile-first design | Active | Ongoing | Low |
| AD-011 | `aspect-ratio` for images | Active | 3, 6 | Low |
| AD-012 | `break-word`, not `anywhere` | Active | 1 | Low |
| AD-013 | Tailwind utilities, not arbitrary values | Active | 2, 6 | Low |
| AD-014 | CSS custom properties as SSOT | Active | 4.1 | Medium |
| AD-015 | Semantic token naming | Active | 4.1 | Low |
| AD-016 | One design system, two themes | Active | 4.4 | High |
| AD-017 | Git commit between sub-phases | Active | All | Low |
| AD-018 | Validation gate before commit | Active | All | Low |
| AD-019 | `text-balance` for headings | Active | 6 | Low |
| AD-020 | Max 200 lines per component | Active (guideline) | Ongoing | Low |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-07-05 | Initial ADL created with 20 decisions from Phases 1–3 and planned Phase 4 strategy |
