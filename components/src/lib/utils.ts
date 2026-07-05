import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Minimal debounce utility — replaces lodash-es to save ~200KB in bundle.
 * @param fn — function to debounce
 * @param wait — milliseconds to wait
 * @returns debounced function
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  }) as T;
}
