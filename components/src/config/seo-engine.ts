/**
 * Typed re-export of the central SEO engine config for app code.
 * Numbers live in seo-engine.config.mjs so Node build scripts share them.
 */
import { SEO_ENGINE_CONFIG, SEO_DEFAULT_SPORTS, SEO_DEFAULT_SPORT_ALIASES, SEO_FALLBACK_ORIGIN, resolveSeoFlags } from "./seo-engine.config.mjs";

export const SEO_CONFIG = SEO_ENGINE_CONFIG;
export { SEO_DEFAULT_SPORTS, SEO_DEFAULT_SPORT_ALIASES, resolveSeoFlags };

export type SeoFlags = {
  enabled: boolean;
  aiEnabled: boolean;
  landingPagesEnabled: boolean;
  sitemapEnabled: boolean;
  redirectsEnabled: boolean;
};

/** Flags for the current environment (build or browser). */
export function seoFlags(): SeoFlags {
  return resolveSeoFlags(import.meta.env as unknown as Record<string, string>);
}

/** Fallback origin mirrors the pre-engine constant (see lib/seo.ts). */
export const FALLBACK_ORIGIN = SEO_FALLBACK_ORIGIN;
