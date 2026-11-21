/**
 * Canonical URL builder + SITE ORIGIN single source — pure .mjs shared by the
 * app, build scripts and (via the generated api/seo-config.json snapshot)
 * api/serve.js.
 *
 * Amendment 2: production builds FAIL if the origin resolves to *.vercel.app;
 * preview deployments are noindexed at the edge (serve.js reads VERCEL_ENV).
 * Amendment 7: vercel.json sets trailingSlash:true, so canonicals, sitemap
 * URLs and og:url all carry the trailing slash; file paths (.xml/.txt) do not.
 */
import { SEO_FALLBACK_ORIGIN, SEO_ENGINE_CONFIG, resolveSeoFlags } from "../../config/seo-engine.config.mjs";

/** Tracking/filter params never allowed on canonical URLs (master prompt §7). */
const STRIPPED_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "msclkid", "ref", "referrer", "q", "sort", "filter",
  "page", "date", "price_min", "price_max",
];

/** Paths with a file extension keep vercel's no-trailing-slash form. */
function isFilePath(pathname) {
  return /\.[a-z0-9]{2,5}$/i.test(pathname);
}

/** Origin resolution: env first, then the documented fallback. */
export function siteOrigin(env = {}) {
  const raw = env.VITE_SITE_ORIGIN || env.SEO_SITE_ORIGIN || SEO_FALLBACK_ORIGIN;
  return raw.replace(/\/+$/, "").toLowerCase();
}

/**
 * Amendment 2 guard — call in production build steps; a *.vercel.app origin in
 * production throws and fails the deploy. Dev/preview builds never throw.
 */
export function assertProductionOrigin(env = {}) {
  const isProduction =
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.VITE_BUILD_MODE === "production";
  const origin = siteOrigin(env);
  if (isProduction && /(^|\.)vercel\.app$/.test(new URL(origin).hostname)) {
    throw new Error(
      `seo-engine: refusing production build — VITE_SITE_ORIGIN resolves to a Vercel URL (${origin}). ` +
        "Set the real production domain (see docs/seo-engine/runbook.md §2).",
    );
  }
  return origin;
}

/**
 * Canonical form of any URL/path: HTTPS, lowercase host, tracking/filter
 * params dropped, and — matching vercel.json trailingSlash:true — page paths
 * end with "/", file paths do not.
 */
export function canonicalizeUrl(input, env = {}) {
  try {
    const url = new URL(input, siteOrigin(env));
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    url.search = "";
    url.hash = "";
    const bare = url.pathname.replace(/\/+$/, "") || "/";
    if (isFilePath(bare)) {
      url.pathname = bare;
    } else if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    return url.toString();
  } catch {
    return absoluteUrl(input, env);
  }
}

/** Absolute URL for an app path, canonical trailing-slash rules applied. */
export function absoluteUrl(path, env = {}) {
  const origin = siteOrigin(env);
  const clean = path.startsWith("/") ? path : `/${path}`;
  return canonicalizeUrl(`${origin}${clean}`, env);
}

/** True when a URL carries any param that would split SEO signals. */
export function hasTrackingOrFilterParams(input) {
  try {
    const url = new URL(input, siteOrigin());
    return Array.from(url.searchParams.keys()).some((k) => STRIPPED_PARAMS.includes(k.toLowerCase()));
  } catch {
    return false;
  }
}

/**
 * Runtime config snapshot written to api/seo-config.json at build time —
 * api/serve.js (CommonJS) requires this file instead of importing ESM.
 * One source of truth; serve.js never hardcodes origin/limits/flags.
 */
export function buildRuntimeSeoConfig(env = {}) {
  return {
    generatedAt: new Date().toISOString(),
    origin: siteOrigin(env),
    flags: resolveSeoFlags(env),
    sitemapMaxUrlsPerFile: SEO_ENGINE_CONFIG.sitemapMaxUrlsPerFile,
    isPreview: Boolean(env.VERCEL_ENV && env.VERCEL_ENV !== "production"),
  };
}
