import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Phase 2 DOM parity (owner round-2 item 6): the SPA consumes the SAME
 * published-only metadata the bot HTML serves (seo_public_metadata view,
 * anon-readable). When the row exists, TurfDetail's title/description match
 * serve.js byte-for-byte; when it doesn't (pre-worker, engine off, view
 * missing), the caller falls back to its local template — exactly the
 * pre-engine behaviour.
 */
export type PublicTurfMetadata = {
  seo_title: string;
  meta_description: string;
  h1: string;
  canonical_url: string;
  robots_index: boolean;
};

export function usePublicSeoMetadata(slug: string | null | undefined): PublicTurfMetadata | null {
  const [meta, setMeta] = useState<PublicTurfMetadata | null>(null);

  useEffect(() => {
    let alive = true;
    if (!slug) return;
    getSupabase()
      .then(async (supabase) => {
        const { data, error } = await supabase
          .from("seo_public_metadata")
          .select("seo_title, meta_description, h1, canonical_url, robots_index")
          .eq("entity_type", "turf")
          .eq("slug", slug)
          .maybeSingle();
        if (alive && !error && data) setMeta(data as PublicTurfMetadata);
      })
      .catch(() => {
        // view missing (migration 001 unapplied) or network — keep null
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  return meta;
}
