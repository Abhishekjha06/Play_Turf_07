# PlayTurf Responsive Guidelines

> **Version:** 1.0 | **Updated:** 2025-07-05 | **Min Width:** 320px

---

## Supported Devices

| Width | Device | Priority | Notes |
|-------|--------|----------|-------|
| 320px | iPhone SE, small Android | **Must Support** | Baseline — everything must work |
| 360px | Samsung Galaxy S8 | **Must Support** | Common Android width |
| 375px | iPhone X/11/12 mini | **Must Support** | Primary iOS target |
| 390px | iPhone 12/13/14 | **Must Support** | Modern iOS standard |
| 412px | Pixel 5, Galaxy S20 | **Should Support** | Larger Android |
| 430px | iPhone 14 Pro Max | **Should Support** | Largest common mobile |
| 768px | iPad Mini, tablets | **Should Support** | Tablet portrait |
| 820px | iPad Air | **Should Support** | Tablet landscape start |
| 1024px | iPad Pro, small laptops | **Nice to Have** | Desktop-like |
| 1280px | Laptops | **Nice to Have** | Side-by-side layout potential |
| 1440px | Desktop | **Nice to Have** | Centered column or sidebar |
| 1920px | Large monitors | **Nice to Have** | Maximum expansion |

---

## Breakpoint Strategy

```
Mobile First:  default → sm(640px) → md(768px) → lg(1024px) → xl(1280px)
```

| Breakpoint | Tailwind | Use Case |
|------------|----------|----------|
| Default | — | Mobile base styles |
| `sm:` | 640px | Small tablets, large phones |
| `md:` | 768px | Tablets, iPad portrait |
| `lg:` | 1024px | iPad landscape, small laptops |
| `xl:` | 1280px | Desktop |
| `2xl:` | 1536px | Large desktop |

**Rule:** Never use `min-[360px]:` arbitrary breakpoints. Use standard Tailwind breakpoints only.

---

## Typography Rules

| Element | Mobile (320-480) | Tablet (768+) | Desktop (1024+) |
|---------|-----------------|---------------|-----------------|
| Page Title (h1) | `text-2xl` (24px) | `text-3xl` (30px) | `text-3xl` (30px) |
| Section Title (h2) | `text-xl` (20px) | `text-2xl` (24px) | `text-2xl` (24px) |
| Card Title (h3) | `text-lg` (18px) | `text-xl` (20px) | `text-xl` (20px) |
| Body | `text-sm` (14px) | `text-base` (16px) | `text-base` (16px) |
| Caption | `text-xs` (12px) | `text-xs` (12px) | `text-xs` (12px) |
| Badge | `text-xs` (12px) | `text-xs` (12px) | `text-xs` (12px) |

**Rule:** Minimum text size is `text-xs` (12px) at all breakpoints.

---

## Spacing Rules

| Context | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Page padding | `px-4` (16px) | `px-8` (32px) | `px-10` (40px) |
| Card padding | `p-4` (16px) | `p-6` (24px) | `p-6` (24px) |
| Section gap | `gap-4` (16px) | `gap-6` (24px) | `gap-6` (24px) |
| Grid gap | `gap-3` (12px) | `gap-4` (16px) | `gap-4` (16px) |

---

## Image Rules

| Context | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Turf carousel | `aspect-[16/9]` | `aspect-[16/9]` | `aspect-[16/9]` |
| Turf card image | `aspect-[4/3]` | `aspect-[4/3]` | `aspect-[4/3]` |
| Avatar | `h-9 w-9` (36px) | `h-10 w-10` (40px) | `h-10 w-10` (40px) |
| Thumbnail | `h-20` (80px) | `h-24` (96px) | `h-24` (96px) |

**Rule:** Always use `aspect-ratio` instead of fixed heights for images.

---

## Card Rules

| Context | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Turf cards grid | 1-2 cols | 2-3 cols | 3-4 cols |
| Stat cards grid | 1 col | 2 cols | 3 cols |
| Booking cards | 1 col (full width) | 1 col | 1-2 cols |

---

## Button Rules

| Context | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Full-width buttons | `w-full` | `w-auto` | `w-auto` |
| Button groups | Stack vertical | Horizontal row | Horizontal row |
| FAB size | 64px | 64px | 64px |

---

## Navigation Rules

| Context | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Bottom nav | Fixed bottom | Fixed bottom | Optional: side nav |
| Header | Fixed top, collapsible | Fixed top | Fixed top |
| Nav item width | 72px | 80px | 96px |

---

## Dialog Rules

| Width | Dialog Max Width | Margin |
|-------|-----------------|--------|
| 320px | 294px (92vw) | 4vw each side |
| 375px | 345px (92vw) | 4vw each side |
| 640px+ | 448px (max-w-md) | Auto-centered |
| 768px+ | 512px (max-w-lg) | Auto-centered |
| 1024px+ | 576px (max-w-xl) | Auto-centered |

**Rule:** Dialogs must have `max-h-[90dvh] overflow-y-auto` for scrollable content.

---

## Form Rules

| Context | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Input height | 44px | 44px | 44px |
| Form layout | Stack vertical | 2-column | 2-3 column |
| Label position | Above input | Above input | Above input (or inline) |
| Button alignment | Full width | Left-aligned | Left-aligned |

---

## Grid Rules

```
// Standard grid patterns

// Stat cards
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3

// Turf cards  
grid-cols-1 min-[360px]:grid-cols-2 gap-4
// FIX: Should be → grid-cols-1 sm:grid-cols-2 gap-4

// Amenities
grid-cols-2 md:grid-cols-3 gap-2

// Booking list
grid-cols-1 (always single column)
```

---

## Touch Targets

| Element | Minimum Size | Preferred |
|---------|-------------|-----------|
| Buttons | 44x44px | 48x48px |
| Input fields | 44px height | 48px height |
| Nav items | 44x72px | 48x80px |
| Cards (tap) | Full width | Full width |
| Dialog close | 44x44px | 44x44px |
| Checkboxes | 44x44px | 44x44px |

---

## Safe Areas

```css
/* Already implemented in MobileShell */
padding-top: env(safe-area-inset-top, 0px);
padding-bottom: env(safe-area-inset-bottom, 0px);
```

**Rule:** All fixed-position elements (header, nav) must account for safe areas.

---

## Landscape Mode

| Element | Behavior |
|---------|----------|
| Header | Maintain height; may need to hide greeting |
| Carousel | Maintain aspect-ratio |
| Bottom nav | Stay fixed bottom |
| Dialog | Centered, maintain max-width |
| Keyboard | Push content up (not overlay) |

---

## Tablet-Specific

| Feature | Implementation |
|---------|---------------|
| Shell width | `md:max-w-[640px]` |
| Two-pane layout | Consider sidebar + main (future) |
| Touch targets | Can stay same (44px minimum) |
| Typography | Scale up one step |

---

## Desktop-Specific (1024px+)

| Feature | Implementation |
|---------|---------------|
| Shell width | `lg:max-w-[768px]` |
| Centered column | Maintain mobile feel with comfortable margins |
| Hover states | Show tooltips, preview cards |
| Keyboard shortcuts | Optional power-user features |

---

## Testing Matrix

| Test | 320px | 375px | 430px | 768px | 1024px | 1440px |
|------|-------|-------|-------|-------|--------|--------|
| Home page | Required | Required | Required | Required | Should | Nice |
| Turf detail | Required | Required | Required | Required | Should | Nice |
| Booking flow | Required | Required | Required | Required | Should | Nice |
| Bookings list | Required | Required | Required | Required | Should | Nice |
| Profile | Required | Required | Required | Required | Should | Nice |
| Admin | Required | Required | Required | Required | Should | Nice |
| Open games | Required | Required | Required | Required | Should | Nice |
| Login/Signup | Required | Required | Required | Required | Should | Nice |
| Dialogs | Required | Required | Required | Required | Should | Nice |
| Receipt | Required | Required | Required | Required | Should | Nice |
