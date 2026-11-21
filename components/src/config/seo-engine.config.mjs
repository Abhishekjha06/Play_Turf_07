/**
 * PlayTurf Dynamic SEO Engine — central configuration (single source of truth).
 *
 * Plain .mjs so BOTH the app (TypeScript re-export in ./seo-engine.ts) and the
 * Node build scripts (generate-sitemap.mjs, generate-agent-content.mjs,
 * backfill-seo-slugs.mjs, api/serve.js) import the exact same numbers.
 * No magic numbers anywhere else. (Master prompt §6.)
 *
 * Feature flags: env vars win, site_settings overrides are applied by the
 * build/worker at their boundary. With SEO_ENGINE_ENABLED off, every consumer
 * must behave exactly as it did before the engine existed (master prompt rule 5).
 */
export const SEO_ENGINE_CONFIG = {
  // ── Length limits ──────────────────────────────────────────────
  titleMaxChars: 60,
  metaDescriptionMinChars: 120,
  metaDescriptionMaxChars: 160,
  slugMaxChars: 80,

  // ── Landing page indexability thresholds ───────────────────────
  landingMinListings: 3,
  landingMinUniqueWords: 150,

  // ── Internal linking ───────────────────────────────────────────
  relatedTurfsMax: 6,
  relatedRadiusKm: 5,
  internalLinksMaxPerTurfPage: 15,

  // ── Sitemaps ───────────────────────────────────────────────────
  // Hard caps per sitemap protocol: 50,000 URLs / 50 MB uncompressed per file.
  sitemapMaxUrlsPerFile: 10000,
  sitemapHardMaxUrls: 50000,

  // ── Cannibalization ────────────────────────────────────────────
  cannibalizationOverlapThreshold: 0.8,

  // ── Workflow ───────────────────────────────────────────────────
  autoPublishTemplateSeo: true,
  autoApproveAiText: false,

  // ── AI pipeline (Phase 5 — off until a provider is configured) ─
  aiMaxRetries: 3,
  aiRateLimitPerMin: 10,
  aiMonthlyCostCapUsd: 10,

  // ── Bulk jobs ──────────────────────────────────────────────────
  bulkBatchSize: 50,

  // ── Reviews ────────────────────────────────────────────────────
  // AggregateRating/Review JSON-LD only when genuine visible reviews exist.
  reviewsMinCountForSchema: 1,

  // ── Redirects ──────────────────────────────────────────────────
  redirectMaxChainDepth: 5,

  // ── Outbox / worker ────────────────────────────────────────────
  jobMaxAttempts: 3,
  jobRetryBackoffSeconds: 30,
};

/**
 * Known sport values seen in live data. Everything else (e.g. the junk
 * "seed data" row) is a validation issue, never silently mapped.
 * Aliases are admin-editable in seo_category_aliases — these are only the
 * seed defaults, and only mappings the master prompt itself sanctions.
 */
export const SEO_DEFAULT_SPORTS = ["Cricket", "Football", "Futsal", "Basketball"];

/** Sanctioned by the master prompt §8 example (Box Cricket under Cricket). */
export const SEO_DEFAULT_SPORT_ALIASES = [
  { alias: "Box Cricket", canonical: "Cricket" },
];

/** Fallback origin — mirrors the pre-engine hardcoded value everywhere. */
export const SEO_FALLBACK_ORIGIN = "https://play-turf-git-main-abhishekjha06s-projects.vercel.app";

/** env → flag resolution, shared by app, scripts and serve.js. */
export function resolveSeoFlags(env = {}) {
  const bool = (v) => {
    const s = String(v).toLowerCase();
    return s === "1" || s === "true" || s === "on";
  };
  return {
    enabled: bool(env.SEO_ENGINE_ENABLED),
    aiEnabled: bool(env.SEO_AI_ENABLED),
    landingPagesEnabled: bool(env.SEO_LANDING_PAGES_ENABLED),
    sitemapEnabled: bool(env.SEO_SITEMAP_ENABLED),
    redirectsEnabled: bool(env.SEO_REDIRECTS_ENABLED),
  };
}
