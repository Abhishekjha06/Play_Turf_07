# PlayTurf Component Standards

> **Version:** 1.0 | **Status:** Active | **Framework:** React + Tailwind CSS

---

## Button (`ui/button.tsx`)

### Purpose
Primary interactive element. Supports variants, sizes, and icon-only mode.

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" \| "destructive" \| "outline" \| "ghost"` | `"default"` | Visual style |
| `size` | `"default" \| "sm" \| "lg" \| "icon"` | `"default"` | Size preset |
| `asChild` | `boolean` | `false` | Render as child element |
| `className` | `string` | — | Additional classes |

### States
| State | Visual |
|-------|--------|
| Default | `bg-primary text-primary-foreground` |
| Hover | `hover:bg-primary/90` |
| Focus | `focus-visible:ring-2 focus-visible:ring-ring` |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed` |
| Active/Pressed | `active:scale-[0.98]` (optional) |

### Sizes
| Size | Height | Padding | Font |
|------|--------|---------|------|
| Default | 44px | `px-6 py-3` | `text-base` |
| sm | 44px | `px-3` | `text-sm` |
| lg | 48px | `px-8` | `text-lg` |
| icon | 44x44px | — | — |

### Accessibility
- Minimum touch target: 44x44px
- `focus-visible` ring for keyboard navigation
- Icon-only buttons must have `aria-label`

### Usage Example
```tsx
<Button variant="default" size="default">Book Now</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="ghost" size="icon" aria-label="Close">
  <X className="h-4 w-4" />
</Button>
```

---

## Card (`ui/card.tsx`)

### Purpose
Container for grouped content. Supports size variants and border options.

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"xs" \| "sm" \| "default" \| "lg"` | `"default"` | Padding preset |
| `bordered` | `boolean` | `true` | Show border |

### Size Variants
| Size | Title Size | Padding |
|------|-----------|---------|
| xs | `text-sm` (14px) | `p-3` |
| sm | `text-base` (16px) | `p-4` |
| default | `text-lg` (18px) | `p-6` |
| lg | `text-xl` (20px) | `p-8` |

### Sub-Components
- `<CardHeader>` — Top section with title + description
- `<CardTitle>` — Heading (uses `size` prop)
- `<CardDescription>` — Subtitle text
- `<CardContent>` — Main body
- `<CardFooter>` — Bottom action area

### Accessibility
- Title should be semantic heading (`<h2>`–`<h4>`)
- Content should have sufficient color contrast

---

## Dialog (`ui/dialog.tsx`)

### Purpose
Modal overlay for confirmations, forms, and detail views.

### Props
| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Controlled visibility |
| `onOpenChange` | `(open: boolean) => void` | Change handler |

### Responsive Behavior
| Width | Behavior |
|-------|----------|
| 320px | `w-[92vw]` = 294px |
| 375px | `w-[92vw]` = 345px |
| 640px+ | `max-w-md` = 448px |
| 768px+ | `max-w-lg` = 512px |
| 1024px+ | `max-w-xl` = 576px |

### Accessibility (Known Issues)
- **MISSING:** `aria-labelledby` on DialogPrimitive.Content
- **MISSING:** Focus trap may not return focus to trigger on close
- Close button is 32x32px — below WCAG 2.5.5 minimum

### Fix Required (Phase 5)
```tsx
// Add to DialogContent
aria-labelledby="dialog-title"

// Ensure DialogTitle has id
<DialogTitle id="dialog-title">Title</DialogTitle>

// Enlarge close button to 44x44px
```

---

## Drawer (`ui/drawer.tsx`)

### Purpose
Bottom sheet / side panel for mobile-first interactions.

### Responsive Behavior
- Mobile: Slides up from bottom, full width
- Desktop (768px+): Consider side-panel variant

### Accessibility
- Should trap focus when open
- Should close on Escape key
- Should have `aria-modal="true"`

---

## Input (`ui/input.tsx`)

### Purpose
Text input with consistent styling and focus states.

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `string` | `"text"` | Input type |
| `disabled` | `boolean` | `false` | Disabled state |
| `className` | `string` | — | Additional classes |

### States
| State | Visual |
|-------|--------|
| Default | `bg-surface border-border text-[#f9fafb]` |
| Focus | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary` |
| Disabled | `disabled:cursor-not-allowed disabled:opacity-50` |
| Error | Border color changes to `destructive` |

### Accessibility
- Minimum height: 44px (WCAG 2.5.5)
- Must have associated `<label>`
- Placeholder is not a substitute for label

### Known Issue
```tsx
// ui/input.tsx line 11 — hardcoded text color
"text-[#f9fafb]"  // Fix in Phase 4A: use text-foreground
```

---

## Badge (`ui/badge.tsx`)

### Purpose
Status indicator, label, or category tag.

### Variants
| Variant | Classes |
|---------|---------|
| Default | `bg-primary text-primary-foreground hover:bg-primary/80` |
| Secondary | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| Destructive | `bg-destructive text-destructive-foreground hover:bg-destructive/80` |
| Outline | `border-border bg-background hover:bg-muted hover:text-foreground` |

### Usage
```tsx
<Badge>Upcoming</Badge>
<Badge variant="destructive">Cancelled</Badge>
<Badge variant="outline">Cricket</Badge>
```

---

## Avatar (`ui/avatar.tsx`)

### Purpose
User profile image with fallback initials.

### Props
| Prop | Type | Description |
|------|------|-------------|
| `src` | `string` | Image URL |
| `alt` | `string` | Accessible name |
| `className` | `string` | Size classes |

### Sizes
| Size | Class | Dimensions |
|------|-------|-----------|
| sm | `h-8 w-8` | 32px |
| md | `h-9 w-9` | 36px |
| lg | `h-12 w-12` | 48px |
| xl | `h-16 w-16` | 64px |

### Accessibility
- Must have meaningful `alt` text
- Fallback should show initials with `aria-label`

---

## Bottom Navigation (`layout/BottomNav.tsx`)

### Purpose
Primary navigation for mobile. Fixed to bottom with FAB center.

### Current Architecture (Pre Phase 4E)
```tsx
// PROBLEM: Two parallel implementations
if (isPremium) {
  return <PremiumNav />;  // White bg, teal accent
} else {
  return <LegacyNav />;   // Glass bg, neon accent
}
```

### Target Architecture (Post Phase 4E)
```tsx
// Single component driven by CSS variables
<BottomNav
  items={navItems}
  fabAction={quickBook}
/>
// Colors from: var(--nav-bg), var(--nav-accent), var(--nav-text)
```

### Accessibility
- `aria-label="Main navigation"`
- Active item: `aria-current="page"`
- FAB: `aria-label="Quick book"`

---

## Header (`layout/AppHeader.tsx`)

### Purpose
Collapsible header with logo, greeting, search, and actions.

### Behavior
- Height animates from 300px to 80px on scroll
- Greeting/search fade out as user scrolls
- Logo scales from 1.0 to 0.85

### Responsive
| Width | Header Max Width |
|-------|-----------------|
| Mobile | 480px |
| md (768px+) | 640px |
| lg (1024px+) | 768px |

---

## Search Bar (`components/SearchBar.tsx`)

### Purpose
Global search input with location awareness.

### States
- Default: Blurred glass background
- Focus: Scale 1.015, glow ring
- Loading: Spinner inside input

---

## Turf Card (`turf/TurfCard.tsx`)

### Purpose
Display turf information in lists and grids.

### Current Architecture (Pre Phase 4B)
```tsx
// PROBLEM: Two implementations in one file
if (isPremium) {
  return <PremiumTurfCard />;  // Lines 55-175
} else {
  return <LegacyTurfCard />;   // Lines 178-254
}
```

### Target Architecture (Post Phase 4B)
```tsx
// Single implementation with semantic tokens
<TurfCard
  turf={turfData}
  variant="default" // or "compact", "featured"
/>
// Colors from CSS variables, not hardcoded
```

### Props
| Prop | Type | Description |
|------|------|-------------|
| `turf` | `Turf` | Turf data object |
| `variant` | `"default" \| "compact" \| "featured"` | Card style |
| `onBook` | `() => void` | Book action handler |

---

## Booking Card (`booking/BookingRow.tsx`)

### Purpose
Display booking information in the bookings list.

### Current Architecture (Pre Phase 4D)
Same dual-theme problem as TurfCard.

### Props
| Prop | Type | Description |
|------|------|-------------|
| `booking` | `Booking` | Booking data |
| `onCancel` | `() => void` | Cancel handler |
| `onView` | `() => void` | View details handler |

---

## Open Game Card (`open-games/OpenGameCard.tsx`)

### Purpose
Display open game listings with join functionality.

### Props
| Prop | Type | Description |
|------|------|-------------|
| `game` | `OpenGame` | Game data |
| `onJoin` | `() => void` | Join handler |

---

## Component Checklist

Before adding any new shared component:

- [ ] Defined in `ui/` or `components/` directory
- [ ] Has TypeScript interface for props
- [ ] Supports `className` prop for overrides
- [ ] Has `forwardRef` if it wraps a DOM element
- [ ] All interactive elements have focus states
- [ ] Icon-only buttons have `aria-label`
- [ ] Minimum touch target is 44px
- [ ] Tested at 320px width
- [ ] Documented in this file
