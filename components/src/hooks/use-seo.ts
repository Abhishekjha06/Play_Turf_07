import { useEffect } from "react";
import { applySeo, type SeoInput } from "@/lib/seo";

/**
 * Declare a page's search identity:
 *
 *   useSeo({ title, description, path, jsonLd: [...] })
 *
 * Pass `null` while loading to keep the previous head, then call again with
 * real data. Re-renders only touch the DOM when the serialized input changes.
 */
export function useSeo(input: SeoInput | null): void {
  const key = input ? JSON.stringify(input) : "";

  useEffect(() => {
    if (!input) return;
    applySeo(input);
  }, [key]);
}
