/**
 * PlayTurf Dynamic SEO Engine — Phase 1 foundation API.
 *
 * Typed surface over the shared .mjs implementations (which are also imported
 * directly by Node build scripts and api/serve.js). App code should import
 * only from this module.
 */
import {
  foldToAscii,
  slugifyBase,
  buildSeoTurfSlug,
  buildLegacyTurfSlug,
  uniqueSlug,
} from "./slug.shared.mjs";
import {
  siteOrigin,
  absoluteUrl,
  canonicalizeUrl,
  hasTrackingOrFilterParams,
  assertProductionOrigin,
  buildRuntimeSeoConfig,
} from "./canonical.shared.mjs";
import { resolveRedirect, collapseRedirectChains } from "./redirects.shared.mjs";
import {
  deriveLocality,
  distanceKm,
  coordsPlausibleForCity,
  localityValidationIssues,
} from "./locality.shared.mjs";
import { SEO_CONFIG, seoFlags, FALLBACK_ORIGIN, type SeoFlags } from "@/config/seo-engine";

export {
  foldToAscii,
  slugifyBase,
  buildSeoTurfSlug,
  buildLegacyTurfSlug,
  uniqueSlug,
  siteOrigin,
  absoluteUrl,
  canonicalizeUrl,
  hasTrackingOrFilterParams,
  assertProductionOrigin,
  buildRuntimeSeoConfig,
  resolveRedirect,
  collapseRedirectChains,
  deriveLocality,
  distanceKm,
  coordsPlausibleForCity,
  localityValidationIssues,
  SEO_CONFIG,
  seoFlags,
  FALLBACK_ORIGIN,
};
export type { SeoFlags };

export type SeoTurfSlugInput = { name: string; locality?: string | null; city?: string | null };
export type RedirectEntry = { to_path: string; status_code: 301 | 410 };
export type RedirectResult = {
  status: 301 | 410;
  location?: string;
  reason: "none" | "gone" | "resolved" | "loop" | "chain_too_long" | "target_noindex";
};
