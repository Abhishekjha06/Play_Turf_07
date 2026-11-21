/**
 * Deterministic SEO metadata generator (master prompt §7 — templates first,
 * AI second). Pure .mjs shared by the worker, build scripts and serve.js.
 *
 * Truthfulness rules (§2.1): ONLY fields stored on the listing are used —
 * never invented facilities, prices, ratings, hours, distances or
 * superlatives. Price appears only when a real price is stored. Rating/
 * review markup is NEVER emitted here (owner round-2 item 7) — the aggregate
 * comes from the real reviews table only, computed by the caller.
 */
import { buildSeoTurfSlug } from "./slug.shared.mjs";
import { canonicalizeUrl } from "./canonical.shared.mjs";
import { SEO_ENGINE_CONFIG } from "../../config/seo-engine.config.mjs";

const CFG = SEO_ENGINE_CONFIG;

function wordSafeTruncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,|–-]+$/, "").trim();
}

/** Clean sport list: real values only, de-junked, primary first. */
function cleanSports(sportTypes) {
  return (sportTypes || [])
    .map((s) => String(s || "").trim())
    .filter((s) => s.length > 1 && !/test|demo|sample|debug|seed data/i.test(s));
}

function buildTitle({ name, locality, city, sports }) {
  // "{Turf} in {Locality}, {City} | {Top Sports} Turf Booking" (§7).
  // Too long → drop secondary sports first, then the suffix; never mid-word.
  const place = [locality, city].filter(Boolean).join(", ");
  const primary = sports[0] || "Sports";
  const withSuffix = (sportList) =>
    `${name} in ${place} | ${sportList} Turf Booking`;
  let title = withSuffix(primary);
  if (title.length <= CFG.titleMaxChars) return wordSafeTruncate(title, CFG.titleMaxChars);

  // try two sports, then one, then drop the suffix entirely
  if (sports.length > 1) {
    title = withSuffix(sports.slice(0, 2).join(" & "));
    if (title.length <= CFG.titleMaxChars) return title;
  }
  title = withSuffix(primary);
  if (title.length <= CFG.titleMaxChars) return title;
  return wordSafeTruncate(`${name} in ${place}`, CFG.titleMaxChars);
}

function buildMetaDescription({ name, locality, city, sports, pricePerHour, amenities }) {
  // Assembled from real fields only (§7). Price mentioned only when stored.
  const place = [locality, city].filter(Boolean).join(", ");
  const sportLine = sports.length
    ? `${sports.slice(0, 3).join(", ")}`
    : "sports";
  const parts = [];
  parts.push(`Book ${name}${place ? ` in ${place}` : ""} for ${sportLine}.`);
  if (Number.isFinite(pricePerHour) && pricePerHour > 0) {
    parts.push(`₹${Math.round(pricePerHour)}/hour.`);
  }
  const realAmenities = (amenities || []).filter((a) => String(a || "").trim().length > 1);
  if (realAmenities.length) {
    parts.push(`${realAmenities.slice(0, 3).join(", ")} available.`);
  }
  parts.push("See photos, timings and open slots on PlayTurf.");
  const description = parts.join(" ");
  if (description.length > CFG.metaDescriptionMaxChars) {
    return wordSafeTruncate(description, CFG.metaDescriptionMaxChars);
  }
  return description;
}

/**
 * Full deterministic metadata for a turf row.
 * @param {object} turf real row: { id, name, slug?, city, locality?, address,
 *        sport_types[], amenities[], price_per_hour, image, gallery[], timing }
 * @returns metadata object (no rating/review markup — caller handles reviews)
 */
export function generateTurfMetadata(turf, { originEnv = {} } = {}) {
  const name = String(turf.name || "").trim() || "Sports Turf";
  const locality = turf.locality || null;
  const city = (turf.city || "").trim() || null;
  const sports = cleanSports(turf.sport_types);

  const slug = turf.slug || buildSeoTurfSlug({ name, locality, city }, CFG);
  const canonicalUrl = canonicalizeUrl(`/turf/${slug}/`, originEnv);

  const title = buildTitle({ name, locality, city, sports });
  const metaDescription = buildMetaDescription({
    name, locality, city, sports,
    pricePerHour: Number(turf.price_per_hour),
    amenities: turf.amenities,
  });

  // H1 = the venue name — byte-identical to the H1 TurfDetail actually renders
  // (DOM parity, owner round-2 item 6). The long form lives in the title.
  const h1 = name;

  const place = [locality, city].filter(Boolean).join(", ");
  const focusKeyword = [sports[0], locality, city].filter(Boolean).join(" ").toLowerCase();
  const secondaryKeywords = [
    ...sports.map((s) => `${s.toLowerCase()} turf ${place}`.trim()),
    place ? `turf booking in ${place}`.toLowerCase() : "turf booking",
    `book ${name}`.toLowerCase(),
  ].filter(Boolean);

  const ogImage = turf.image
    ? /^https?:/i.test(turf.image) ? turf.image : canonicalizeUrl(turf.image, originEnv)
    : null;

  return {
    entity_type: "turf",
    entity_id: turf.id,
    slug,
    seo_title: title,
    meta_description: metaDescription,
    h1,
    canonical_url: canonicalUrl,
    robots_index: true,
    robots_follow: true,
    og_title: title,
    og_description: metaDescription,
    og_image: ogImage,
    twitter_title: title,
    twitter_description: metaDescription,
    focus_keyword: focusKeyword || null,
    secondary_keywords: secondaryKeywords,
    generated_by: "template",
  };
}
