/**
 * Shared SportsActivityLocation JSON-LD builder — THE single source for turf
 * structured data. Consumed by:
 *   - lib/seo.ts (SPA head injection) — delegates here
 *   - generate-agent-content.mjs (build-time artifact → serve.js bot HTML)
 *
 * Truthfulness guards (master prompt §11 + owner round-2 item 7):
 *   - amenityFeature / openingHours / priceRange only from real stored fields
 *   - AggregateRating + Review ONLY from genuine review rows passed in; the
 *     static turfs.rating column is NEVER used for markup (it is admin-set,
 *     not review-computed — 00-audit.md §2.4)
 *   - everything escaped-safe: caller must JSON.stringify (textContent in SPA;
 *     `</` escaped in serve.js)
 */

/** Parse "06:00 AM – 11:00 PM" into OpeningHoursSpecification; [] when unparseable. */
export function openingHoursFromTimingShared(timing) {
  const match = String(timing || "").match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–\-to]+\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );
  if (!match) return [];
  const to24 = (h, ap) => {
    const n = Number(h) % 12;
    return String(ap.toUpperCase() === "PM" ? n + 12 : n).padStart(2, "0");
  };
  return [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: `${to24(match[1], match[3])}:${match[2]}`,
      closes: `${to24(match[4], match[6])}:${match[5]}`,
    },
  ];
}

/**
 * @param {object} turf real row (name, city, address, sport_types[], amenities[],
 *        price_per_hour, image, gallery[], timing, lat, lng)
 * @param {Array<{rating:number, user_name?:string, comment?:string, created_at?:string}>} reviews
 *        genuine visible review rows — [] means NO rating markup at all
 * @param {{ absoluteUrl: (path: string) => string }} io environment helpers
 */
export function buildTurfJsonLd(turf, reviews = [], { absoluteUrl }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: turf.name,
    url: absoluteUrl(`/turf/${turf.slug}/`),
    description:
      turf.description ||
      `${turf.name} is a sports turf in ${turf.city} offering ${
        (turf.sport_types || []).join(", ") || "sports"
      } bookings by the hour.`,
    image: [turf.image, ...(turf.gallery || [])]
      .filter(Boolean)
      .map((src) => (/^https?:/i.test(src) ? src : absoluteUrl(src)))
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
    data.geo = { "@type": "GeoCoordinates", latitude: turf.lat, longitude: turf.lng };
  }

  const hours = openingHoursFromTimingShared(turf.timing);
  if (hours.length) data.openingHoursSpecification = hours;

  if ((turf.amenities || []).length) {
    data.amenityFeature = (turf.amenities || []).map((a) => ({
      "@type": "LocationFeatureSpecification",
      name: a,
      value: true,
    }));
  }

  // Item 7: aggregate from genuine review rows ONLY; empty reviews → no markup.
  const real = (reviews || []).filter((r) => r && typeof r.rating === "number" && r.rating > 0);
  if (real.length >= 1) {
    const avg = real.reduce((sum, r) => sum + r.rating, 0) / real.length;
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
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    }));
  }

  data.potentialAction = {
    "@type": "ReserveAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: absoluteUrl(`/turf/${turf.slug}/?book=true`),
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

/** BreadcrumbList shared by all public pages. */
export function buildBreadcrumbJsonLd(items, { absoluteUrl }) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: absoluteUrl(path),
    })),
  };
}
