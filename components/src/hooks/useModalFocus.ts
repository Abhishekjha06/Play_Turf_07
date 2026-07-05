import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Minimal focus-management hook for custom modal components.
 *
 * Provides:
 *   – Initial focus on the first focusable element inside the container
 *   – Tab focus trap (cycles back to first/last element)
 *   – Escape key closes the modal
 *   – Focus returns to the trigger element when modal closes
 *
 * Designed for one-off bottom sheets and custom modals that cannot
 * practically use Radix Dialog / Sheet.
 */
export function useModalFocus({
  isOpen,
  onClose,
  containerRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest onClose callback in a ref so the effect doesn't
  // re-subscribe every time the parent re-renders.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Save the element that had focus before the modal opened.
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  // Focus first element + keyboard listeners (focus trap + ESC).
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const container = containerRef.current;

    // Move focus to the first focusable element.
    const focusable = container.querySelectorAll(FOCUSABLE_SELECTORS);
    if (focusable.length > 0) {
      (focusable[0] as HTMLElement).focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab") return;

      const focusableElements = Array.from(
        container.querySelectorAll(FOCUSABLE_SELECTORS)
      ) as HTMLElement[];

      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, containerRef]);

  // Return focus to the trigger when the modal closes.
  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);
}
