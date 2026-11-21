import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Phase 3 — seo_pages as the content-override + approval surface for the
 * generated landing pages. When an admin has saved an enabled override row
 * for (pageType, slug), its title/description/h1/content REPLACE the
 * template output, and its robots decision has PRECEDENCE
 * (amendment 9: admin can always noindex; forcing index is the explicit
 * override action — audit-logged in AdminSeo).
 *
 * The table is anon-readable only for enabled rows (RLS in
 * supabase_admin_rbac.sql), so overrides ship the moment they are enabled and
 * disappear the moment they are disabled.
 */
export type LandingOverride = {
  title: string;
  description: string;
  h1: string;
  content: string;
  /** true → force noindex regardless of thresholds; false → force index. */
  forceNoindex: boolean;
};

export function useLandingOverride(
  pageType: "location" | "sport" | "location_sport",
  slug: string | null | undefined
): LandingOverride | null {
  const [override, setOverride] = useState<LandingOverride | null>(null);

  useEffect(() => {
    let alive = true;
    if (!slug) return;
    getSupabase()
      .then(async (supabase) => {
        const { data, error } = await supabase
          .from("seo_pages")
          .select("title, description, h1, content, robots")
          .eq("page_type", pageType)
          .eq("slug", slug)
          .eq("enabled", true)
          .maybeSingle();
        if (alive && !error && data) {
          setOverride({
            title: String(data.title || ""),
            description: String(data.description || ""),
            h1: String(data.h1 || ""),
            content: String(data.content || ""),
            forceNoindex: String(data.robots || "index") === "noindex",
          });
        }
      })
      .catch(() => {
        /* table missing or network — keep template output */
      });
    return () => {
      alive = false;
    };
  }, [pageType, slug]);

  return override;
}
