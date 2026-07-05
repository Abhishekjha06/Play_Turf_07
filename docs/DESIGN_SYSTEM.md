# PlayTurf Design System

> **Version:** 1.0 | **Status:** Active (Phase 3 Complete) | **Tech:** Tailwind CSS v3 + CSS Custom Properties

---

## Typography

### Font Family
```css
font-family: "Plus Jakarta Sans", system-ui, sans-serif;
```

### Scale (Tailwind Tokens)

| Token | Size | Line Height | Use Case |
|-------|------|-------------|----------|
| `text-xs` | 12px | 20px | Captions, badges, labels — **MINIMUM SIZE** |
| `text-sm` | 14px | 22px | Secondary text, descriptions |
| `text-base` | 16px | 24px | Body text, buttons |
| `text-lg` | 18px | 28px | Card titles, emphasis |
| `text-xl` | 20px | 28px | Section headers |
| `text-2xl` | 24px | 32px | Page titles |
| `text-3xl` | 30px | 36px | Logo, hero text |

### Heading Base Styles (index.css)

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| h1 | 1.75rem (28px) | 700 | 2.25rem | -0.02em |
| h2 | 1.5rem (24px) | 700 | 2rem | -0.015em |
| h3 | 1.25rem (20px) | 600 | 1.75rem | -0.01em |
| h4 | 1.125rem (18px) | 600 | 1.625rem | — |

### Font Weight Rules

| Weight | Class | Use |
|--------|-------|-----|
| 400 | `font-normal` | Body text |
| 500 | `font-medium` | Labels, captions |
| 600 | `font-semibold` | Card titles, section headers |
| 700 | `font-bold` | Page titles, prices |
| 800 | `font-extrabold` | Hero text, logo |
| 900 | `font-black` | Badges, emphasis (use sparingly) |

---

## Spacing

### Tailwind Scale (Default + Custom)

| Token | Value | Use |
|-------|-------|-----|
| `xs` | 0.25rem (4px) | Tight gaps |
| `sm` | 0.5rem (8px) | Small gaps |
| `md` | 1rem (16px) | Standard padding |
| `lg` | 1.5rem (24px) | Card padding |
| `xl` | 2rem (32px) | Section padding |
| `2xl` | 3rem (48px) | Page padding |

### Component Spacing

| Component | Padding | Gap |
|-----------|---------|-----|
| Card (default) | `p-6` (24px) | — |
| Card (compact) | `p-3` (12px) | — |
| Card (large) | `p-8` (32px) | — |
| Dialog | `p-4` / `sm:p-6` | `gap-4` |
| Form section | `space-y-3` | — |
| Button (default) | `px-6 py-3` | — |
| Button (sm) | `px-3` + `min-h-[44px]` | — |

---

## Grid & Containers

### MobileShell

| Breakpoint | Max Width | Behavior |
|------------|-----------|----------|
| Default (mobile) | 480px | Full width up to 480px |
| `md:` (768px+) | 640px | Centered with `md:my-4 md:rounded-[2rem]` |
| `lg:` (1024px+) | 768px | Expanded centered container |

### Grid Patterns

| Context | Classes |
|---------|---------|
| Stat cards | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3` |
| Turf cards | `grid-cols-1 min-[360px]:grid-cols-2 gap-4` |
| Amenities | `grid-cols-2` (with truncation guards) |
| Dialog footer | `flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2` |

---

## Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `rounded-sm` | 0.25rem (4px) | Small elements |
| `rounded` | 0.5rem (8px) | Inputs, small buttons |
| `rounded-lg` | 0.75rem (12px) | Cards |
| `rounded-xl` | 1rem (16px) | Modals, panels |
| `rounded-2xl` | 1.25rem (20px) | Mobile shell corners |
| `rounded-3xl` | 1.75rem (28px) | Large cards, bottom sheets |
| `rounded-full` | 9999px | Avatars, FABs, pills |

---

## Elevation (Shadows)

| Token | Value | Use |
|-------|-------|-----|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle depth |
| `shadow` | `0 1px 3px rgba(0,0,0,0.1)` | Cards at rest |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Elevated cards |
| `shadow-neon` | `0 0 16px hsl(195 90% 50% / 0.35)` | Primary accent glow |
| `shadow-neon-lg` | `0 0 32px ... + 0 0 10px ...` | FAB, emphasis |
| `shadow-card` | `0 4px 20px hsl(0 0% 0% / 0.3)` | Dark theme cards |

---

## Colors

### Dark Theme (Default)

| Token | HSL | Hex | Use |
|-------|-----|-----|-----|
| `--background` | 215 25% 10% | #13171f | Page background |
| `--foreground` | 210 20% 98% | #f8fafc | Primary text |
| `--foreground-soft` | 215 15% 75% | #94a3b8 | Secondary text |
| `--foreground-muted` | 215 10% 60% | #64748b | Tertiary text |
| `--primary` | 195 90% 50% | #0cc0f5 | Accent color |
| `--primary-foreground` | 215 30% 10% | #111827 | Text on primary |
| `--surface` | 217 28% 16% | #1e2735 | Card/panel backgrounds |
| `--panel` | 215 22% 14% | #1b212c | Elevated surfaces |
| `--border` | 220 26% 22% | #2a3448 | Borders, dividers |
| `--muted` | 215 15% 16% | #1e293b | Muted backgrounds |
| `--destructive` | 0 84% 60% | #ef4444 | Errors, cancellations |
| `--success` | 150 70% 45% | #22c55e | Success states |
| `--warning` | 38 92% 50% | #f59e0b | Warnings |

### Premium Teal Theme

| Token | Value | Notes |
|-------|-------|-------|
| Background | `#F1F5F9` (slate-100) | Light mode |
| Primary | `#14B8B0` | Teal accent |
| Card bg | `#FFFFFF` | White cards |
| Text | `#0F172A` | Slate-900 |
| Text muted | `#64748B` | Slate-500 |
| Border | `#E2E8F0` | Slate-200 |

**Important:** Premium theme values are currently hardcoded inline. Phase 4A will migrate these to CSS custom properties with `html.light` / `html.dark` selectors.

---

## Theme Tokens (Post Phase 4A)

```css
:root {
  /* All themes share these semantic tokens */
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-surface: hsl(var(--surface));
  --color-border: hsl(var(--border));
  
  /* Component-specific */
  --card-padding: 1.5rem;
  --input-height: 44px;
  --button-height: 44px;
  --touch-target: 44px;
  --text-minimum: 0.75rem; /* 12px */
}
```

---

## Icon Sizes

| Context | Size | Class |
|---------|------|-------|
| Navigation | 20px | `h-5 w-5` |
| Header actions | 18px | `h-[18px] w-[18px]` |
| Cards | 16px | `h-4 w-4` |
| FAB | 28px | `h-7 w-7` |
| Large display | 40px | `h-10 w-10` |

---

## Avatar Sizes

| Size | Dimensions | Use |
|------|-----------|-----|
| sm | 32px | Inline mentions |
| md | 36px | Header avatar |
| lg | 48px | Profile page |
| xl | 64px | Settings |

---

## Button Sizes

| Variant | Height | Padding | Radius | Font |
|---------|--------|---------|--------|------|
| Default | 44px | `px-6 py-3` | `rounded-md` | `text-base` |
| sm | 44px | `px-3` | `rounded-md` | `text-sm` |
| lg | 48px | `px-8` | `rounded-md` | `text-lg` |
| Icon | 44x44px | — | `rounded-full` | — |
| FAB | 64x64px | — | `rounded-full` | — |

---

## Input Sizes

| Metric | Value | Note |
|--------|-------|------|
| Default height | 44px | `min-h-[44px]` (WCAG 2.5.5) |
| Padding | `px-3 py-2` | Comfortable touch |
| Radius | `rounded-input` (8px) | Consistent with buttons |
| Focus ring | `ring-2 ring-ring ring-offset-2` | Visible focus state |

---

## Badge Styles

| Type | Classes |
|------|---------|
| Default | `px-2 py-0.5 rounded-full text-xs font-semibold` |
| Primary | `bg-primary text-primary-foreground` |
| Secondary | `bg-secondary text-secondary-foreground` |
| Destructive | `bg-destructive text-destructive-foreground` |
| Outline | `border border-border bg-transparent` |

---

## Card Variants

| Variant | Padding | Shadow | Border |
|---------|---------|--------|--------|
| Default | `p-6` | `shadow-card` | `border-border/40` |
| Compact | `p-3` | `shadow-sm` | `border-border/20` |
| Large | `p-8` | `shadow-lg` | `border-border/60` |
| Bordered | `p-6` | none | `border-border` |
| Premium | `p-6` | `shadow-lg` | `border-slate-200` |

---

## Motion

### Durations

| Token | Value | Use |
|-------|-------|-----|
| `duration-150` | 150ms | Hover states, micro-interactions |
| `duration-200` | 200ms | Focus rings, toggles |
| `duration-300` | 300ms | Modals, dropdowns |

### Easing

| Name | Value | Use |
|------|-------|-----|
| Default | `ease-out` | Standard transitions |
| Spring (bouncy) | Custom cubic-bezier | Nav indicators, active states |
| Gentle | Custom cubic-bezier | Background pills, subtle |

### Keyframe Animations (Tailwind Config)

| Animation | Duration | Use |
|-----------|----------|-----|
| `fade-in` | 400ms | Page transitions |
| `scale-in` | 250ms | Modal/dialog open |
| `pulse-glow` | 2.2s infinite | FAB glow effect |
| `float` | 3s infinite | Subtle floating elements |

---

## Focus States

All interactive elements must have visible focus indicators:

```css
/* Tailwind pattern */
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

| Element | Focus Style |
|---------|-------------|
| Input | Ring 2px primary color |
| Button | Ring 2px primary color |
| Link | Underline + ring |
| Card | Border color change |
| Dialog close | Opacity 100% |

---

## Responsive Rules

See [RESPONSIVE_GUIDELINES.md](RESPONSIVE_GUIDELINES.md) for full device support matrix.

---

## Accessibility Rules

See [ACCESSIBILITY_GUIDELINES.md](ACCESSIBILITY_GUIDELINES.md) for WCAG compliance standards.

---

## Naming Conventions

### CSS Custom Properties
```
--category-purpose-variant
--color-background
--spacing-md
--shadow-card
```

### Tailwind Classes
- Use semantic utilities: `text-soft`, `bg-panel`, `border-border`
- Avoid arbitrary values: ❌ `text-[11px]` → ✅ `text-xs`
- Prefer `min-h` over `h` for touch targets

### Component Props
```tsx
// Good
interface ButtonProps {
  variant?: "default" | "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

// Bad
interface ButtonProps {
  color?: string;  // Too vague
  height?: number; // Use size enum
}
```

---

## Usage Guidelines

1. **Never use inline `style={{ fontSize: ... }}`** — use Tailwind tokens
2. **Never use hardcoded hex colors** — use CSS variables
3. **Minimum text size is `text-xs` (12px)** — no exceptions
4. **Minimum touch target is 44px** — WCAG 2.5.5 compliance
5. **Always add `aria-label` to icon-only buttons**
6. **Always pair `<input>` with `<label>`**
7. **Use `aspect-ratio` instead of fixed heights** for images
8. **Test at 320px** — this is the minimum supported width

---

## Best Practices

- Prefer composition over configuration
- Keep components under 200 lines; extract sub-components
- Use `cn()` utility for conditional classes
- Avoid prop drilling — use context for theme
- Lazy-load heavy components (dialogs, carousels)
- Use `React.memo` for expensive renders
- Prefer CSS transitions over JS animation where possible
