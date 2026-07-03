import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SeoConfig {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  twitterCard?: "summary" | "summary_large_image";
  canonical?: string;
  noindex?: boolean;
  schema?: Record<string, unknown>;
}

const DEFAULT_SEO: SeoConfig = {
  title: "PlayTurf — Book Sports Turfs & Tournaments Near You",
  description:
    "Book sports turfs, football grounds, cricket pitches, futsal courts, and tournaments near you. Real-time availability, instant booking, and best prices on PlayTurf.",
  keywords:
    "sports turf booking, football ground booking, cricket pitch booking, futsal court, badminton court, sports venue, tournament booking",
  ogImage: "https://playturf.app/og-image.jpg",
  ogType: "website",
  twitterCard: "summary_large_image",
};

/**
 * useSeo — React hook to dynamically update page SEO metadata.
 * Updates document title, meta tags, Open Graph, Twitter Cards, and JSON-LD schema.
 */
export function useSeo(config: SeoConfig = {}) {
  const location = useLocation();
  const merged = { ...DEFAULT_SEO, ...config };
  const canonical =
    merged.canonical || `https://playturf.app${location.pathname}`;

  useEffect(() => {
    // Update title
    document.title = merged.title || DEFAULT_SEO.title!;

    // Update meta tags helper
    const setMeta = (name: string, content?: string) => {
      if (!content) return;
      let meta = document.querySelector<HTMLMetaElement>(
        `meta[name="${name}"], meta[property="${name}"]`
      );
      if (!meta) {
        meta = document.createElement("meta");
        if (name.startsWith("og:") || name.startsWith("twitter:")) {
          meta.setAttribute("property", name);
        } else {
          meta.setAttribute("name", name);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    setMeta("description", merged.description);
    setMeta("keywords", merged.keywords);
    setMeta("robots", merged.noindex ? "noindex, nofollow" : "index, follow");

    // Open Graph
    setMeta("og:title", merged.title);
    setMeta("og:description", merged.description);
    setMeta("og:type", merged.ogType);
    setMeta("og:url", canonical);
    setMeta("og:image", merged.ogImage);

    // Twitter
    setMeta("twitter:card", merged.twitterCard);
    setMeta("twitter:title", merged.title);
    setMeta("twitter:description", merged.description);
    setMeta("twitter:image", merged.ogImage);

    // Canonical
    let linkCanonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.rel = "canonical";
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.href = canonical;

    // JSON-LD Schema
    if (merged.schema) {
      const schemaId = "playturf-dynamic-schema";
      let script = document.getElementById(schemaId);
      if (!script) {
        script = document.createElement("script");
        script.id = schemaId;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        ...merged.schema,
      });
    }

    return () => {
      // Cleanup dynamic schema on unmount
      if (!merged.schema) {
        const schemaId = "playturf-dynamic-schema";
        const script = document.getElementById(schemaId);
        if (script) script.remove();
      }
    };
  }, [
    merged.title,
    merged.description,
    merged.keywords,
    merged.ogImage,
    merged.ogType,
    merged.twitterCard,
    canonical,
    merged.noindex,
    merged.schema,
  ]);
}

/**
 * SchemaMarkup — Component to inject JSON-LD structured data.
 */
export function SchemaMarkup({
  schema,
}: {
  schema: Record<string, unknown> | Record<string, unknown>[];
}) {
  const schemas = Array.isArray(schema) ? schema : [schema];

  useEffect(() => {
    const scripts: HTMLScriptElement[] = [];

    schemas.forEach((s, i) => {
      const id = `playturf-schema-${i}`;
      let script = document.getElementById(id);
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      (script as HTMLScriptElement).textContent = JSON.stringify({
        "@context": "https://schema.org",
        ...s,
      });
      scripts.push(script as HTMLScriptElement);
    });

    return () => {
      scripts.forEach((s) => s.remove());
    };
  }, [schemas]);

  return null;
}

/**
 * Generate SportsActivityLocation schema for a specific turf.
 */
export function generateTurfSchema(turf: {
  id: string;
  name: string;
  description?: string;
  image?: string;
  address?: string;
  city?: string;
  rating?: number;
  reviewCount?: number;
  priceRange?: string;
  sports?: string[];
  latitude?: number;
  longitude?: number;
  telephone?: string;
  url?: string;
}): Record<string, unknown> {
  return {
    "@type": "SportsActivityLocation",
    "@id": turf.url || `https://playturf.app/turf/${turf.id}`,
    name: turf.name,
    description: turf.description,
    image: turf.image,
    url: turf.url || `https://playturf.app/turf/${turf.id}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: turf.city,
      streetAddress: turf.address,
      addressCountry: "IN",
    },
    geo: turf.latitude && turf.longitude
      ? {
          "@type": "GeoCoordinates",
          latitude: turf.latitude,
          longitude: turf.longitude,
        }
      : undefined,
    telephone: turf.telephone,
    priceRange: turf.priceRange || "$$",
    aggregateRating: turf.rating
      ? {
          "@type": "AggregateRating",
          ratingValue: turf.rating,
          reviewCount: turf.reviewCount || 0,
        }
      : undefined,
    amenityFeature: turf.sports?.map((sport) => ({
      "@type": "LocationFeatureSpecification",
      name: sport,
      value: true,
    })),
  };
}

/**
 * Generate Event schema for a tournament.
 */
export function generateTournamentSchema(tournament: {
  id: string;
  name: string;
  description?: string;
  image?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  city?: string;
  url?: string;
  organizer?: string;
  price?: string;
}): Record<string, unknown> {
  return {
    "@type": "SportsEvent",
    "@id": tournament.url || `https://playturf.app/tournaments/${tournament.id}`,
    name: tournament.name,
    description: tournament.description,
    image: tournament.image,
    url: tournament.url || `https://playturf.app/tournaments/${tournament.id}`,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    location: {
      "@type": "SportsActivityLocation",
      name: tournament.location,
      address: {
        "@type": "PostalAddress",
        addressLocality: tournament.city,
        addressCountry: "IN",
      },
    },
    organizer: tournament.organizer
      ? {
          "@type": "Organization",
          name: tournament.organizer,
        }
      : undefined,
    offers: tournament.price
      ? {
          "@type": "Offer",
          price: tournament.price,
          priceCurrency: "INR",
          availability: "https://schema.org/InStock",
          url: tournament.url || `https://playturf.app/tournaments/${tournament.id}`,
        }
      : undefined,
  };
}

/**
 * Generate BreadcrumbList schema for navigation.
 */
export function generateBreadcrumbSchema(
  items: { name: string; url: string }[]
): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
