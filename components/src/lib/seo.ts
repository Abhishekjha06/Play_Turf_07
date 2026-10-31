/**
 * SEO core for PlayTurf.
 *
 * Everything a page needs to declare its search identity:
 *  - <title>, meta description, robots
 *  - canonical URL, Open Graph, Twitter card
 *  - JSON-LD structured data (page-scoped, cleaned up on navigation)
 *
 * Design rules:
 *  - Only REAL data goes into structured data (no invented ratings/reviews).
 *  - Private/user pages set noindex so they never enter the index.
 *  - Tags are upserted by key so repeated mounts never duplicate <meta> tags.
 */

import type { Turf, Review } from "@/data/seed";

// ---------------------------------------------------------------------------
// Site constants
// ---------------------------------------------------------------------------

export const SITE_NAME = "PlayTurf";
export const SITE_TAGLINE = "Book Sports Turfs & Tournaments Near You";

/** Canonical production origin. Override with VITE_SITE_ORIGIN when previewing. */
export const SITE_ORIGIN: string =
  import.meta.env.VITE_SITE_ORIGIN || "https://playturf.app";

export const DEFAULT_OG_IMAGE = "/og-image.jpg";

export function absoluteUrl(path: string): string {
  if (!path) return SITE_ORIGIN + "/";
  if (/^https?:\/\//i.test(path)) return path;
  return SITE_ORIGIN + (path.startsWith("/") ? path : `/${path}`);
}

/** Full-bleed default robots directive. */
export const DEFAULT_ROBOTS =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

export function slugify(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Stable public URL for a venue, e.g. /turf/greenfield-arena-turf-1 */
export function turfPath(turf: Pick<Turf, "id" | "name">): string {
  return `/turf/${buildTurfSlug(turf)}`;
}

export function buildTurfSlug(turf: Pick<Turf, "id" | "name">): string {
  const idPart = slugify(turf.id) || slugify(String(turf.id));
  const namePart = slugify(turf.name);
  return [namePart, idPart].filter(Boolean).join("-");
}

/** Resolve a /turf/:param — accept legacy ids (turf_1) and full slugs. */
export function matchTurfParam(
  param: string,
  turfs: Turf[]
): Turf | undefined {
  return (
    turfs.find((t) => t.id === param) ??
    turfs.find((t) => buildTurfSlug(t) === param)
  );
}

/** City/locality/sport route params are slugs; compare slug-to-slug. */
export function slugMatches(value: string | undefined, param: string): boolean {
  if (!value) return false;
  return slugify(value) === slugify(param);
}

// ---------------------------------------------------------------------------
// Head tag management
// ---------------------------------------------------------------------------

type SeoInput = {
  /** Page <title> (full string, ~50-60 chars ideal). */
  title: string;
  description: string;
  /** Canonical path WITHOUT origin, e.g. "/turfs/bangalore". */
  path: string;
  ogType?: "website" | "article";
  /** Absolute or root-relative social image. Defaults to /og-image.jpg. */
  image?: string;
  imageAlt?: string;
  robots?: string;
  /** Set true on private/thin pages to keep them out of the index. */
  noindex?: boolean;
  /** Page-scoped JSON-LD objects. Replaces the previous page's set. */
  jsonLd?: object[];
};

const PAGE_LD_ATTR = "data-seo-page";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"]`
  );
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Apply (idempotently) a page's full head configuration. */
export function applySeo(input: SeoInput): void {
  if (typeof document === "undefined") return;

  const robots = input.noindex
    ? "noindex, follow"
    : input.robots || DEFAULT_ROBOTS;
  const canonical = absoluteUrl(input.path);
  const image = absoluteUrl(input.image || DEFAULT_OG_IMAGE);

  document.title = input.title;

  upsertMeta("name", "description", input.description);
  upsertMeta("name", "robots", robots);

  upsertLink("canonical", canonical);

  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:title", input.title);
  upsertMeta("property", "og:description", input.description);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:type", input.ogType || "website");
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:image:alt", input.imageAlt || SITE_NAME);

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", input.title);
  upsertMeta("name", "twitter:description", input.description);
  upsertMeta("name", "twitter:image", image);

  // Replace page-scoped JSON-LD (site-wide defaults in index.html stay).
  document.head
    .querySelectorAll(`script[${PAGE_LD_ATTR}]`)
    .forEach((n) => n.remove());
  (input.jsonLd || []).forEach((obj) => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute(PAGE_LD_ATTR, "");
    script.textContent = JSON.stringify(obj);
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// JSON-LD builders — real data only
// ---------------------------------------------------------------------------

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_ORIGIN + "/",
    logo: absoluteUrl("/playturf-logo.webp"),
    description: `PlayTurf lets players find and book sports turfs — football grounds, cricket pitches, futsal and box-cricket courts — with live slot availability.`,
    sameAs: [
      "https://twitter.com/playturfapp",
      "https://instagram.com/playturfapp",
    ],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_ORIGIN + "/",
    inLanguage: "en-IN",
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}

export type Crumb = { name: string; path: string };

/** BreadcrumbList — call with the ACTUAL visible trail of the page. */
export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/**
 * Parse "06:00 AM – 11:00 PM" style timings into a Schema.org
 * OpeningHoursSpecification. Returns [] when timings can't be parsed —
 * never guess.
 */
export function openingHoursFromTiming(timing: string | undefined) {
  const match = String(timing || "").match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–\-to]+\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );
  if (!match) return [];
  const to24 = (h: string, ap: string) => {
    const n = Number(h) % 12;
    return String(ap.toUpperCase() === "PM" ? n + 12 : n).padStart(2, "0");
  };
  const opens = `${to24(match[1], match[3])}:${match[2]}`;
  const closes = `${to24(match[4], match[6])}:${match[5]}`;
  return [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
      ],
      opens,
      closes,
    },
  ];
}

/**
 * SportsActivityLocation for a venue. Ratings/reviews are included ONLY when
 * real review rows exist. Aggregates are computed from those rows.
 */
export function turfJsonLd(
  turf: Turf,
  reviews: Review[] = []
): object {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: turf.name,
    url: absoluteUrl(turfPath(turf)),
    description:
      turf.description ||
      `${turf.name} is a sports turf in ${turf.city} offering ${
        (turf.sport_types || []).join(", ") || "sports"
      } bookings by the hour.`,
    image: [turf.image, ...(turf.gallery || [])]
      .filter(Boolean)
      .map((src: string) => (/^https?:/i.test(src) ? src : absoluteUrl(src)))
      .slice(0, 10),
    address: {
      "@type": "PostalAddress",
      streetAddress: turf.address,
      addressLocality: turf.city,
      addressCountry: "IN",
    },
    sport: turf.sport_types || [],
    publicAccess: true,
    priceRange: `₹${turf.price_per_hour}/hour`,
    isAccessibleForFree: false,
  };

  if (typeof turf.lat === "number" && typeof turf.lng === "number") {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: turf.lat,
      longitude: turf.lng,
    };
  }

  const hours = openingHoursFromTiming(turf.timing);
  if (hours.length) data.openingHoursSpecification = hours;

  if ((turf.amenities || []).length) {
    data.amenityFeature = turf.amenities.map((a: string) => ({
      "@type": "LocationFeatureSpecification",
      name: a,
      value: true,
    }));
  }

  // Genuine reviews only — no fabricated aggregates.
  const real = (reviews || []).filter(
    (r) => r && typeof r.rating === "number" && r.rating > 0
  );
  if (real.length > 0) {
    const avg =
      real.reduce((sum, r) => sum + r.rating, 0) / real.length;
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.round(avg * 10) / 10,
      reviewCount: real.length,
      bestRating: 5,
      worstRating: 1,
    };
    data.review = real.slice(0, 8).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.user_name || "Player" },
      datePublished: (r.created_at || "").slice(0, 10) || undefined,
      reviewBody: r.comment,
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
    }));
  }

  data.potentialAction = {
    "@type": "ReserveAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: absoluteUrl(`${turfPath(turf)}?book=true`),
      inLanguage: "en-IN",
      actionPlatform: [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform",
      ],
    },
    result: { "@type": "Reservation", name: `Book ${turf.name}` },
  };

  return data;
}

/** Article schema for blog guides. */
export function articleJsonLd(post: {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: absoluteUrl(post.image || DEFAULT_OG_IMAGE),
    datePublished: post.datePublished,
    dateModified: post.dateModified || post.datePublished,
    inLanguage: "en-IN",
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN + "/" },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/playturf-logo.webp"),
      },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };
}
