/**
 * Canonical URL builder — single origin source + normalization rules.
 * Pure .mjs (shared with scripts and api/serve.js).
 *
 * Replaces the 6 pre-engine hardcoded-origin copies (see Phase 0 audit §4):
 * lib/seo.ts, lib/business.ts, index.html, public/robots.txt and the two
 * generators now resolve their origin through this module (or its env logic).
 */
import { SEO_FALLBACK_ORIGIN } from "../../config/seo-engine.config.mjs";

/** Tracking/filter params never allowed on canonical URLs (master prompt §7). */
const STRIPPED_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "msclkid", "ref", "referrer", "q", "sort", "filter",
  "page", "date", "price_min", "price_max",
];

/** Origin resolution: env first, then the documented fallback. */
export function siteOrigin(env = {}) {
  const raw = env.VITE_SITE_ORIGIN || env.SEO_SITE_ORIGIN || SEO_FALLBACK_ORIGIN;
  return raw.replace(/\/+$/, "").toLowerCase();
}

/** Absolute URL for an app path — origin + path with exactly one trailing rule. */
export function absoluteUrl(path, env = {}) {
  const origin = siteOrigin(env);
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${clean}`;
}

/**
 * Canonical form of any URL: force HTTPS, lowercase host, drop tracking /
 * filter / sort / pagination params, drop trailing slash (root "/" keeps its
 * slash; matches serve.js's trailing-slash stripping and vercel.json).
 */
export function canonicalizeUrl(input, env = {}) {
  try {
    const url = new URL(input, siteOrigin(env));
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return absoluteUrl(input, env);
  }
}

/** True when a URL carries any param that would split SEO signals. */
export function hasTrackingOrFilterParams(input) {
  try {
    const url = new URL(input, siteOrigin());
    const lower = (key) => STRIPPED_PARAMS.includes(key.toLowerCase());
    return Array.from(url.searchParams.keys()).some(lower);
  } catch {
    return false;
  }
}
