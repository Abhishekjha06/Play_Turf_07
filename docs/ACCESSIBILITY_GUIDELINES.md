# PlayTurf Accessibility Guidelines

> **Version:** 1.0 | **Updated:** 2025-07-05 | **Target:** WCAG 2.1 AA

---

## WCAG 2.1 AA Compliance

| Criterion | Status | Evidence | Action |
|-----------|--------|----------|--------|
| 1.1.1 Non-text Content | Partial | Images have `alt` | Add `alt` to all decorative SVGs |
| 1.3.1 Info and Relationships | Pass | Semantic HTML | Maintain heading hierarchy |
| 1.4.3 Contrast (Minimum) | **Fail** | Premium teal: 2.6:1 for muted text | Phase 5: Adjust colors |
| 1.4.4 Resize Text | Pass | Rem units for headings | Continue using relative units |
| 1.4.10 Reflow | Pass | Mobile-first design | Test at 320px |
| 1.4.11 Non-text Contrast | Not tested | — | Test focus rings, icons |
| 2.1.1 Keyboard | Not tested | — | Manual keyboard nav test |
| 2.4.3 Focus Order | Not tested | — | Tab through all pages |
| 2.4.7 Focus Visible | Pass | `focus-visible:ring-2` | Ensure all interactive elements |
| 2.5.5 Target Size | **Partial** | Input 44px, Button 44px | Dialog close 32px needs fix |
| 3.3.2 Labels/Instructions | Pass | Auth forms have labels | Extend to all forms |
| 4.1.2 Name/Role/Value | **Partial** | Password toggles have aria-label | Dialog needs aria-labelledby |

---

## Keyboard Navigation

### Required Behaviors

| Element | Keyboard Interaction |
|---------|---------------------|
| Links | `Tab` to focus, `Enter` to activate |
| Buttons | `Tab` to focus, `Enter`/`Space` to activate |
| Checkboxes | `Tab` to focus, `Space` to toggle |
| Radio buttons | `Tab` to group, `Arrow` keys to select |
| Select/Dropdown | `Tab` to focus, `Arrow` keys + `Enter` to select |
| Dialogs | `Tab` traps focus inside, `Escape` to close |
| Drawers | `Tab` traps focus inside, `Escape` to close |
| Carousels | `Arrow` keys to navigate (optional) |

### Focus Order

```
Skip Link (hidden) → Logo → Nav items → Main content → Footer
```

**Rule:** Focus order must match visual order.

---

## Focus Management

### Focus Rings

All interactive elements must have visible focus:

```css
/* Tailwind pattern */
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

| Element | Focus Style |
|---------|-------------|
| Input | Ring 2px primary |
| Button | Ring 2px primary |
| Link | Underline + ring |
| Card (clickable) | Border color change |
| Dialog close | Background highlight + ring |

### Focus Restoration

When a dialog/drawer closes, focus must return to the element that opened it:

```tsx
// Pattern using useRef
const openButtonRef = useRef<HTMLButtonElement>(null);

// On dialog close
openButtonRef.current?.focus();
```

---

## ARIA

### Dialog

```tsx
// REQUIRED FIX (Phase 5)
<DialogPrimitive.Content
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <DialogTitle id="dialog-title">Title</DialogTitle>
  <DialogDescription id="dialog-description">Description</DialogDescription>
</DialogPrimitive.Content>
```

### Navigation

```tsx
<nav aria-label="Main navigation">
  <Link aria-current={isActive ? "page" : undefined}>
    <span>{label}</span>
  </Link>
</nav>
```

### Icon-Only Buttons

```tsx
// REQUIRED: aria-label
<button aria-label="Close dialog">
  <X className="h-4 w-4" />
</button>

<button aria-label="Notifications">
  <Bell className="h-4 w-4" />
  <span className="sr-only">{unreadCount} unread</span>
</button>
```

### Live Regions

```tsx
// For dynamic updates (notifications, toasts)
<div aria-live="polite" aria-atomic="true">
  {notificationMessage}
</div>
```

---

## Labels

### Forms

```tsx
// REQUIRED: Explicit label association
<label htmlFor="email">Email Address</label>
<input id="email" type="email" />

// OR: Implicit label
<label>
  Email Address
  <input type="email" />
</label>

// NEVER: Placeholder only
<input placeholder="Email Address" />  // ❌
```

### Fieldsets

Group related inputs with `<fieldset>` + `<legend>`:

```tsx
<fieldset>
  <legend>Booking Preferences</legend>
  {/* radio buttons */}
</fieldset>
```

---

## Color Contrast

### Required Ratios (WCAG AA)

| Text Size | Normal Text | Large Text (18px+ bold / 24px+) |
|-----------|------------|--------------------------------|
| AA | 4.5:1 | 3:1 |
| AAA | 7:1 | 4.5:1 |

### Current Issues

| Foreground | Background | Ratio | Status | Fix |
|------------|-----------|-------|--------|-----|
| `#94A3B8` | `#FFFFFF` | 2.6:1 | **FAIL** | Darken to `#64748B` or darker |
| `rgba(255,255,255,0.4)` | `#000000` | 2.8:1 | **FAIL** | Increase alpha to 0.55+ |
| `rgba(255,255,255,0.55)` | `#0F172A` | 4.2:1 | Marginal | Increase to 0.6+ for safety |

### Testing Tools

- WebAIM Contrast Checker
- Stark (Figma plugin)
- axe DevTools
- Lighthouse

---

## Reduced Motion

### Respect User Preference

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Framer Motion Components

```tsx
import { useReducedMotion } from "framer-motion";

function AnimatedComponent() {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      animate={shouldReduceMotion ? {} : { y: 0, opacity: 1 }}
    />
  );
}
```

---

## Touch Targets

| Element | Minimum | Preferred |
|---------|---------|-----------|
| Buttons | 44x44px | 48x48px |
| Inputs | 44px height | 48px height |
| Nav items | 44x72px | 48x80px |
| Checkboxes | 44x44px | 44x44px |
| Dialog close | 44x44px | 44x44px |

**Known Violations (Phase 5 Fixes):**
- Dialog close button: 32x32px
- Admin delete button: 36x36px
- Header bell/avatar buttons: 36x36px

---

## Screen Readers

### Testing Checklist

- [ ] NVDA (Windows) — Chrome, Firefox
- [ ] JAWS (Windows) — Chrome, Firefox
- [ ] VoiceOver (macOS) — Safari
- [ ] VoiceOver (iOS) — Safari
- [ ] TalkBack (Android) — Chrome

### Common Issues

| Issue | Fix |
|-------|-----|
| Decorative icons announced | Add `aria-hidden="true"` |
| Images without alt | Add descriptive `alt` or `aria-hidden` |
| Form errors not announced | Use `aria-live="polite"` |
| Dynamic content not announced | Use `aria-live` regions |

---

## Forms

### Required Pattern

```tsx
<form>
  <div>
    <label htmlFor="email">Email Address</label>
    <input
      id="email"
      type="email"
      required
      aria-required="true"
      aria-invalid={hasError}
      aria-describedby={hasError ? "email-error" : undefined}
    />
    {hasError && (
      <span id="email-error" role="alert">
        Please enter a valid email
      </span>
    )}
  </div>
</form>
```

---

## Images

```tsx
// Informative image
<img src="turf.jpg" alt="Green cricket pitch at Super Cricket Arena" />

// Decorative image
<img src="pattern.svg" alt="" aria-hidden="true" />

// Complex image (chart)
<img src="stats.png" alt="Bookings by day: Monday 12, Tuesday 8..." />
```

---

## Error Handling

```tsx
// Error message must be associated with input
<input aria-invalid={true} aria-describedby="error-id" />
<span id="error-id" role="alert">Please enter a valid date</span>

// Toast notifications
<Toaster
  position="top-center"
  toastOptions={{
    ariaProps: { role: "status", "aria-live": "polite" }
  }}
/>
```

---

## Accessibility Checklist

Before every release:

- [ ] All images have `alt` text
- [ ] All forms have labels
- [ ] All buttons have accessible names
- [ ] Focus order is logical
- [ ] Focus indicators are visible
- [ ] Color contrast meets 4.5:1
- [ ] Touch targets are 44x44px minimum
- [ ] Dialogs trap focus and restore on close
- [ ] Reduced motion is respected
- [ ] Screen reader testing completed
- [ ] Keyboard navigation tested
- [ ] Lighthouse accessibility score >= 90
