# Phase 5.3A: Modal Accessibility Audit Report

**Date:** 2026-07-05  
**Scope:** All custom modal, sheet, and overlay components (not Radix UI)  
**Method:** Static code analysis — read every custom modal file  
**Rule:** Audit only. No fixes applied.

---

## Executive Summary

| Component | Uses Radix | Focus Trap | ESC | Return Focus | Backdrop Click | aria-modal | Status |
|-----------|-----------|------------|-----|--------------|----------------|------------|--------|
| TeamManagerModal | ✅ Yes | ✅ Built-in | ✅ Built-in | ✅ Built-in | ✅ Built-in | ✅ Built-in | ✅ Pass |
| TossModal | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes | ❌ No | 🔴 Needs work |
| FeedbackModal | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes | ❌ No | 🔴 Needs work |
| MultiRoleLoginModal | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | 🔴 Needs work |
| AvatarPicker | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes | ❌ No | 🔴 Needs work |
| LocationFilter (LocationSheet) | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes | ❌ No | 🔴 Needs work |
| BookingConfirmPay (Privacy Policy) | ❌ No | ❌ No | ❌ No | ❌ No | ⚠️ Partial | ❌ No | 🔴 Needs work |
| BookingSuccessReceipt (Ticket) | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | 🔴 Needs work |
| TurfDetail (Join Game Bottom Sheet) | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes | ❌ No | 🔴 Needs work |
| **Total** | **1/9** | **1/9** | **1/9** | **1/9** | **6/9** | **1/9** | **1 Pass, 8 Need Work** |

**Key finding:** Only `TeamManagerModal` uses Radix UI `Dialog` and inherits full accessibility. **All other 8 custom modals are manually built and lack focus trapping, ESC-to-close, and `aria-modal`.**

---

## 1. TeamManagerModal (`src/cricket/components/TeamManagerModal.tsx`)

| Check | Status | Notes |
|-------|--------|-------|
| Uses Radix Dialog | ✅ Yes | `import { Dialog, DialogContent } from "@/ui/dialog"` |
| Focus trap | ✅ Built-in | Radix handles it |
| ESC to close | ✅ Built-in | Radix handles it |
| Return focus | ✅ Built-in | Radix handles it |
| aria-modal | ✅ Built-in | Radix sets it |
| aria-label on inputs | ⚠️ Missing | `input` for "Add new team" has no `aria-label` or `<label>` |
| aria-label on buttons | ❌ Missing | Save/Trash buttons inside TeamEditor are icon-only with no `aria-label` |

**Recommendation:** Add `aria-label` to the internal input and buttons. The modal shell is already accessible via Radix.

**Migration to Radix:** Already using Radix. Just need minor internal fixes.

---

## 2. TossModal (`src/home/TossModal.tsx`)

| Check | Status | Notes |
|-------|--------|-------|
| Structure | Custom | `fixed inset-0 z-[100]`, `AnimatePresence` + `motion.div` |
| Backdrop | ✅ Yes | `bg-black/80 backdrop-blur-md`, click to close |
| Close button | ✅ Yes | X button with `onClick` |
| aria-label on close | ❌ No | `<X className="h-4 w-4" />` with no `aria-label` |
| Focus trap | ❌ No | Tab can escape to background |
| ESC to close | ❌ No | No `keydown` listener |
| Return focus | ❌ No | Focus not returned to trigger |
| aria-modal | ❌ No | Not set |
| aria-labelledby | ❌ No | Title present but not referenced |
| Role | ❌ No | No `role="dialog"` |

**Code pattern:**
```tsx
<AnimatePresence>
  {open && (
    <motion.div className="fixed inset-0 z-[100] ...">
      <motion.div onClick={handleClose} className="absolute inset-0 bg-black/80" />
      <motion.div className="relative z-10 ..."> {/* content */} </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

**Recommendation:** 
- **Migrate to Radix Dialog** if possible. The coin toss animation is framer-motion based but can be wrapped inside `DialogContent`.
- If migration is complex, implement custom `useModalFocus()` hook for this and other custom modals.

---

## 3. FeedbackModal (`src/ui/FeedbackModal.tsx`)

| Check | Status | Notes |
|-------|--------|-------|
| Structure | Custom | `fixed inset-0 z-[100]`, `AnimatePresence` + `motion.div` |
| Backdrop | ✅ Yes | `bg-black/60 backdrop-blur-sm`, click to close |
| Close button | ✅ Yes | X button with `onClick` |
| aria-label on close | ❌ No | No `aria-label` on X button |
| Focus trap | ❌ No | Tab can escape to background |
| ESC to close | ❌ No | No `keydown` listener |
| Return focus | ❌ No | Focus not returned to trigger |
| aria-modal | ❌ No | Not set |
| aria-labelledby | ❌ No | Title "Send Feedback" present but not referenced |
| Role | ❌ No | No `role="dialog"` |
| Form inputs | ⚠️ Partial | Name, email, message inputs have no `aria-label` or `<label>` |

**Code pattern:**
```tsx
<AnimatePresence>
  {isOpen && (
    <>
      <motion.div className="fixed inset-0 z-[100] ..." onClick={onClose} />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <motion.div className="pointer-events-auto ..."> {/* content */} </motion.div>
      </div>
    </>
  )}
</AnimatePresence>
```

**Recommendation:**
- **Migrate to Radix Dialog**. This is a standard form modal. The content can be moved into `DialogContent` with minimal changes. The `pointer-events-none` / `pointer-events-auto` pattern is a workaround for a problem Radix already solves.

---

## 4. MultiRoleLoginModal (`src/components/MultiRoleLoginModal.tsx`)

| Check | Status | Notes |
|-------|--------|-------|
| Structure | Custom | `fixed inset-0 z-[9999]`, `AnimatePresence` |
| Backdrop | ⚠️ Partial | `bg-black/80 backdrop-blur-md` but **no click handler** |
| Close button | ❌ No | No close button — modal is forced-choice |
| ESC to close | ❌ No | No `keydown` listener |
| Focus trap | ❌ No | Tab can escape to background |
| Return focus | ❌ No | Focus not returned |
| aria-modal | ❌ No | Not set |
| aria-labelledby | ❌ No | Title "Welcome Back" present but not referenced |
| Role | ❌ No | No `role="dialog"` |

**Note:** This is a forced-choice modal (no close button, no backdrop click). This is acceptable UX for a role selection modal, but it still needs:
- Focus trapping (so keyboard users can't tab out)
- `aria-modal="true"` and `role="dialog"` so screen readers know it's a modal
- `aria-labelledby` pointing to the title

**Recommendation:**
- **Migrate to Radix Dialog**. This is a standard dialog with no close button — Radix supports this via `Dialog` without a `DialogTrigger`. The `onInteractOutside` and `onEscapeKeyDown` can be disabled if needed for forced-choice behavior.

---

## 5. AvatarPicker (`src/ui/AvatarPicker.tsx`)

| Check | Status | Notes |
|-------|--------|-------|
| Structure | Custom with `createPortal` | `fixed inset-0 z-[9999]`, `AnimatePresence` |
| Backdrop | ✅ Yes | `bg-black/80 backdrop-blur-sm`, click to close |
| Close button | ✅ Yes | X button with `onClick` |
| aria-label on close | ❌ No | No `aria-label` on X button |
| Focus trap | ❌ No | Tab can escape to background |
| ESC to close | ❌ No | No `keydown` listener |
| Return focus | ❌ No | Focus not returned to trigger |
| aria-modal | ❌ No | Not set |
| aria-labelledby | ❌ No | Title "Choose Avatar" present but not referenced |
| Role | ❌ No | No `role="dialog"` |

**Recommendation:**
- **Migrate to Radix Dialog**. This is a standard selection modal. The `createPortal` usage is unnecessary since Radix Dialog already uses portals internally. The avatar grid and file upload can be moved into `DialogContent`.

---

## 6. LocationFilter / LocationSheet (`src/home/LocationFilter.tsx`)

| Check | Status | Notes |
|-------|--------|-------|
| Structure | Custom sheet | `fixed inset-0 z-40` backdrop, `fixed top-1/2 z-50` sheet |
| Backdrop | ✅ Yes | `rgba(0,0,0,0.45)`, click to close, `aria-hidden` on backdrop ✅ |
| Close button | ⚠️ Partial | `X` button inside `LocationSheet` component (not in the portion read) |
| aria-expanded | ✅ Yes | On the pill trigger button |
| aria-label | ✅ Yes | `"Open location filter"` on trigger |
| Focus trap | ❌ No | Tab can escape to background |
| ESC to close | ❌ No | No `keydown` listener |
| Return focus | ❌ No | Focus not returned to trigger pill |
| aria-modal | ❌ No | Not set |
| Role | ❌ No | No `role="dialog"` |

**Recommendation:**
- **Migrate to Radix Sheet**. This is a bottom/center sheet pattern — exactly what Radix `Sheet` is designed for. The existing `AnimatePresence` and `motion.div` animations can be preserved by customizing `SheetContent`.

---

## 7. BookingConfirmPay — Privacy Policy Modal (`src/booking/BookingConfirmPay.tsx`)

| Check | Status | Notes |
|-------|--------|-------|
| Structure | Inline conditional | `{showPolicyModal && (...)}` |
| Backdrop | ✅ Yes | `fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm pointer-events-auto` |
| Backdrop click | ❌ No | No `onClick` on backdrop — click does nothing |
| Close button | ✅ Yes | X button, but no `aria-label` |
| Focus trap | ❌ No | Tab can escape to background |
| ESC to close | ❌ No | No `keydown` listener |
| Return focus | ❌ No | Focus not returned to "Privacy Policy" link |
| aria-modal | ❌ No | Not set |
| Role | ❌ No | No `role="dialog"` |
| Scroll lock | ❌ No | Body can scroll behind modal |

**Recommendation:**
- **Migrate to Radix Dialog**. This is a standard content dialog with a scrollable body. Move the privacy policy content into `DialogContent`.

---

## 8. BookingSuccessReceipt — Ticket Modal (`src/booking/BookingSuccessReceipt.tsx`)

| Check | Status | Notes |
|-------|--------|-------|
| Structure | Inline conditional | `{showTicket && (...)}` inside `AnimatePresence` |
| Backdrop | ✅ Yes | `fixed inset-0 z-50 bg-black/90 backdrop-blur-md` |
| Backdrop click | ❌ No | No `onClick` on backdrop — click does nothing |
| Close button | ✅ Yes | X button, but no `aria-label` |
| Focus trap | ❌ No | Tab can escape to background |
| ESC to close | ❌ No | No `keydown` listener |
| Return focus | ❌ No | Focus not returned to "Ticket" button |
| aria-modal | ❌ No | Not set |
| Role | ❌ No | No `role="dialog"` |
| Scroll lock | ❌ No | Body can scroll behind modal |

**Recommendation:**
- **Migrate to Radix Dialog**. The `BookingTicket` component can be rendered inside `DialogContent`.

---

## 9. TurfDetail — Join Game Bottom Sheet (`src/pages/TurfDetail.tsx`)

| Check | Status | Notes |
|-------|--------|-------|
| Structure | Inline conditional | `{selectedJoinGame && (...)}` inside `AnimatePresence` |
| Backdrop | ✅ Yes | `fixed inset-0 z-[45] bg-black/70 backdrop-blur-sm` |
| Backdrop click | ✅ Yes | `onClick={() => setSelectedJoinGame(null)}` |
| Close button | ✅ Yes | X button, but no `aria-label` |
| Focus trap | ❌ No | Tab can escape to background |
| ESC to close | ❌ No | No `keydown` listener |
| Return focus | ❌ No | Focus not returned to "Join Game" button |
| aria-modal | ❌ No | Not set |
| Role | ❌ No | No `role="dialog"` |
| Scroll lock | ❌ No | Body can scroll behind modal |

**Recommendation:**
- **Migrate to Radix Sheet**. This is a bottom-sheet pattern (fixed bottom, slides up). Radix `Sheet` with `side="bottom"` is the perfect fit.

---

## Migration Feasibility Matrix

| Component | Type | Radix Component | Migration Complexity | Recommendation |
|-----------|------|-----------------|---------------------|----------------|
| TeamManagerModal | Dialog | Already Radix Dialog | N/A | ✅ Keep — add internal aria-labels |
| TossModal | Centered Dialog | Radix Dialog | Medium (framer-motion animations) | 🟡 Try Radix Dialog first |
| FeedbackModal | Centered Dialog | Radix Dialog | Low | 🟢 Migrate to Radix Dialog |
| MultiRoleLoginModal | Centered Dialog | Radix Dialog | Low | 🟢 Migrate to Radix Dialog |
| AvatarPicker | Centered Dialog | Radix Dialog | Low | 🟢 Migrate to Radix Dialog |
| LocationFilter | Centered Sheet | Radix Sheet | Medium (custom animation) | 🟡 Try Radix Sheet first |
| BookingConfirmPay (Privacy) | Centered Dialog | Radix Dialog | Low | 🟢 Migrate to Radix Dialog |
| BookingSuccessReceipt (Ticket) | Centered Dialog | Radix Dialog | Low | 🟢 Migrate to Radix Dialog |
| TurfDetail (Join Game) | Bottom Sheet | Radix Sheet | Medium | 🟡 Try Radix Sheet first |

---

## Reusable Hook Recommendation

If Radix migration is not practical for some modals (e.g., TossModal with complex framer-motion animations), build a reusable `useModalFocus` hook:

```tsx
// useModalFocus.ts
export function useModalFocus({
  open,
  onClose,
  modalRef,
}: {
  open: boolean;
  onClose: () => void;
  modalRef: React.RefObject<HTMLElement>;
}) {
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement as HTMLElement;
      // Focus first focusable element inside modal
      const focusable = modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      focusable?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
        if (e.key === 'Tab') {
          const focusableElements = modalRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as NodeListOf<HTMLElement>;
          if (!focusableElements.length) return;
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else if (lastFocusedRef.current) {
      lastFocusedRef.current.focus();
    }
  }, [open, onClose, modalRef]);
}
```

---

## STOP

Phase 5.3A complete. **Audit only. No fixes applied.**

**Recommendation:** Migrate 6 of 8 custom modals to Radix Dialog/Sheet. For the 2 complex ones (TossModal, LocationFilter), try Radix first; if migration is too complex, use the `useModalFocus` reusable hook.

Awaiting approval for Phase 5.3B implementation.
