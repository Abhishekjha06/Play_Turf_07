/**
 * Phase 3 — category/location association sync + landing-page evaluation.
 * Pure functions over the seeded taxonomy (seo_sport_categories,
 * seo_category_aliases, seo_locations). The worker (scripts/seo-worker.mjs)
 * applies them idempotently; tests exercise them as fixtures.
 *
 * Owner Phase 3 rules:
 *   - alias/category mapping is admin-editable ONLY (seo_category_aliases);
 *     nothing is silently guessed. Junk values ("seed data") and unknown
 *     sports become validation issues, never associations.
 *   - locations are derived from turfs.locality (migration 001) or the
 *     "Locality, City" address convention — derivations queue for review and
 *     locality pages never auto-publish (approval required for indexability).
 *   - landing evaluation uses the configured thresholds verbatim (3 listings,
 *     150 unique words, 0.8 overlap) — thresholds are never lowered.
 */
import { slugifyBase, uniqueSlug } from "./slug.shared.mjs";
import { SEO_ENGINE_CONFIG } from "../../config/seo-engine.config.mjs";

// ── Categories ──────────────────────────────────────────────────────────────

/**
 * Resolve a turf's sport_types into category ids.
 * @returns {{ categoryIds: bigint[], issues: Array<{code,severity,message}> }}
 */
export function resolveCategories(sportTypes, categories, aliases) {
  const issues = [];
  const ids = [];
  for (const sport of sportTypes || []) {
    const raw = String(sport || "").trim();
    if (!raw) continue;
    // 1. exact category name
    const exact = categories.find((c) => c.name.toLowerCase() === raw.toLowerCase());
    if (exact) { ids.push(exact.id); continue; }
    // 2. admin-approved alias
    const alias = aliases.find((a) => a.alias.toLowerCase() === raw.toLowerCase());
    if (alias) { ids.push(alias.category_id); continue; }
    // 3. no guess: junk-shaped values vs plausible-but-unmapped sports
    const junkShaped = /test|demo|sample|debug|seed data/i.test(raw) || !/^[a-z0-9][a-z0-9 &/-]{1,30}$/i.test(raw);
    issues.push({
      code: junkShaped ? "junk_sport" : "unknown_sport",
      severity: junkShaped ? "warning" : "info",
      message: `Sport value "${raw}" on a turf is ${junkShaped ? "junk" : "not mapped"} — add an admin alias in seo_category_aliases to associate it. Never guessed.`,
    });
  }
  return { categoryIds: [...new Set(ids)], issues };
}

// ── Locations ───────────────────────────────────────────────────────────────

const INDIA = { type: "country", name: "India", slug: "india", parentSlug: null };

/**
 * Derive the location node chain for a turf: India → city → locality (when
 * derivable). Reuses existing nodes by slug; new nodes are returned for
 * upsert. locality sourcing is flagged for review (never silently trusted).
 * @returns {{ nodes: Array<{type,name,slug,parentSlug|null}>, issues: Array }}
 */
export function deriveLocationNodes(turf, existingLocations) {
  const issues = [];
  const city = String(turf.city || "").trim();
  if (!city) {
    issues.push({ code: "missing_city", severity: "error", message: `Turf ${turf.id} has no city — no location association possible.` });
    return { nodes: [], issues };
  }
  const citySlug = slugifyBase(city);
  const nodes = [INDIA, { type: "city", name: city, slug: citySlug, parentSlug: INDIA.slug }];

  // locality: explicit column wins (migration 001, admin-reviewed); address
  // parse is a derivation that QUEUES for review.
  let locality = String(turf.locality || "").trim();
  if (locality) {
    nodes.push({ type: "locality", name: locality, slug: slugifyBase(locality), parentSlug: citySlug });
    return { nodes, issues };
  }
  const parts = String(turf.address || "").split(",");
  const derived = parts.length >= 2 ? parts[0].trim() : "";
  if (derived.length >= 3) {
    nodes.push({ type: "locality", name: derived, slug: slugifyBase(derived), parentSlug: citySlug });
    issues.push({
      code: "locality_needs_review",
      severity: "info",
      message: `Locality "${derived}" derived from address for turf ${turf.id} — confirm in the review queue before locality pages use it.`,
    });
  } else {
    issues.push({
      code: "missing_locality",
      severity: "warning",
      message: `Turf ${turf.id} has no locality and its address does not follow the "Locality, City" convention — city-level association only.`,
    });
  }
  return { nodes, issues };
}

/** Find an existing location node by type+slug (slug unique within parent). */
export function findLocationNode(existingLocations, type, slug, parentSlug) {
  const parent = parentSlug
    ? existingLocations.find((l) => l.type !== "country" && l.slug === parentSlug)
    : null;
  return existingLocations.find(
    (l) => l.type === type && l.slug === slug && (parent ? l.parent_id === parent.id : l.parent_id === null)
  );
}

// ── Landing-page evaluation ─────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "near", "turf", "turfs", "in", "at", "of", "on",
  "per", "hour", "book", "booking", "playturf", "sports", "sport", "venue",
]);

/** Distinct content words across a page's REAL listing facts (no boilerplate). */
export function uniqueContentWords(listings) {
  const words = new Set();
  for (const t of listings) {
    for (const w of slugifyBase(t.name || "").split("-")) if (w) words.add(w);
    for (const w of slugifyBase(t.address || "").split("-")) if (w) words.add(w);
    for (const s of t.sport_types || []) for (const w of slugifyBase(s).split("-")) if (w) words.add(w);
    for (const a of t.amenities || []) for (const w of slugifyBase(a).split("-")) if (w) words.add(w);
  }
  for (const w of [...words]) if (STOP_WORDS.has(w)) words.delete(w);
  return words.size;
}

/**
 * Evaluate one landing-page candidate against the configured thresholds.
 * @param {'category'|'location'|'category_location'} pageType
 * @param {{listings: Array, parentListings?: Array, adminApproved?: boolean, overrideIndex?: boolean}} ctx
 * @returns {{ listingCount:number, uniqueWords:number, thresholdsPass:boolean,
 *             cannibalizedWith:null|string, indexable:boolean, status:string,
 *             reasons:string[] }}
 */
export function evaluateLandingPage(pageType, ctx) {
  const reasons = [];
  const cfg = SEO_ENGINE_CONFIG;
  const listingCount = (ctx.listings || []).length;
  const introWords = Math.max(0, Number(ctx.introWords) || 0);
  const uniqueWords = uniqueContentWords(ctx.listings || []) + introWords;

  const enoughListings = listingCount >= cfg.landingMinListings;
  const enoughWords = uniqueWords >= cfg.landingMinUniqueWords;
  if (!enoughListings) reasons.push(`listings ${listingCount} < ${cfg.landingMinListings}`);
  if (!enoughWords) reasons.push(`unique words ${uniqueWords} < ${cfg.landingMinUniqueWords}`);

  // Cannibalization: a child page sharing more than the threshold of its
  // parent's listings is folded into the parent (keeps one indexable page).
  let cannibalizedWith = null;
  const parent = ctx.parentListings || [];
  if (pageType === "category_location" && parent.length && listingCount) {
    const childNames = new Set(ctx.listings.map((t) => t.id));
    const shared = parent.filter((t) => childNames.has(t.id)).length;
    const share = shared / Math.min(listingCount, parent.length);
    if (share > cfg.cannibalizationOverlapThreshold) {
      cannibalizedWith = "parent";
      reasons.push(`overlap ${Math.round(share * 100)}% > ${Math.round(cfg.cannibalizationOverlapThreshold * 100)}%`);
    }
  }

  const thresholdsPass = enoughListings && enoughWords && !cannibalizedWith;

  // Indexability decision (master prompt §10 + owner Phase 3 rules):
  //   * category pages above thresholds: auto-approved when
  //     autoPublishTemplateSeo is on (template content = deterministic).
  //   * location pages (locality/city): NEVER auto-published — admin approval
  //     required (no auto-publish of locality pages).
  //   * overrideIndex: explicit dashboard flag — forces indexable even below
  //     thresholds, and always raises a validation issue.
  const override = Boolean(ctx.overrideIndex);
  let indexable = false;
  let status = "candidate";
  if (cannibalizedWith) {
    indexable = false;
    status = "rejected";
    reasons.push("duplicate — canonical to the parent page");
  } else if (override) {
    indexable = true;
    status = ctx.adminApproved ? "approved" : "candidate";
    reasons.push("FORCED INDEX override — below-threshold, flagged in dashboard");
  } else if (thresholdsPass && pageType === "category" && cfg.autoPublishTemplateSeo) {
    indexable = true;
    status = "approved";
  } else if (thresholdsPass && ctx.adminApproved) {
    indexable = true;
    status = "approved";
  } else if (thresholdsPass) {
    reasons.push("eligible — awaiting admin approval (location pages never auto-publish)");
  }
  if (override && !thresholdsPass) reasons.push("override_index active below threshold");

  return { listingCount, uniqueWords, thresholdsPass, cannibalizedWith, indexable, status, reasons };
}

/** Group published turfs into candidate landing pages. */
export function landingCandidates(turfs, categories, categoryAssociations, locationAssociations, locations) {
  const byCategoryId = new Map();
  for (const a of categoryAssociations) {
    const list = byCategoryId.get(a.category_id) || [];
    const turf = turfs.find((t) => t.id === a.turf_id);
    if (turf) list.push(turf);
    byCategoryId.set(a.category_id, list);
  }
  const byLocationId = new Map();
  for (const a of locationAssociations) {
    const list = byLocationId.get(a.location_id) || [];
    const turf = turfs.find((t) => t.id === a.turf_id);
    if (turf) list.push(turf);
    byLocationId.set(a.location_id, list);
  }
  const locById = new Map(locations.map((l) => [l.id, l]));
  const candidates = [];
  for (const [categoryId, list] of byCategoryId) {
    const cat = categories.find((c) => c.id === categoryId);
    if (cat) candidates.push({ pageType: "category", categoryId, locationId: null, listings: list, slug: `${cat.slug}-turfs`, routePath: `/sports/${cat.slug}/` });
  }
  for (const [locationId, list] of byLocationId) {
    const loc = locById.get(locationId);
    if (!loc) continue;
    candidates.push({ pageType: "location", categoryId: null, locationId, listings: list, slug: `${loc.slug}`, routePath: `/turfs/${loc.slug}/` });
    for (const [catId, catList] of byCategoryId) {
      const shared = catList.filter((t) => list.some((lt) => lt.id === t.id));
      if (shared.length) {
        const cat = categories.find((c) => c.id === catId);
        if (cat) {
          const cityLoc = loc.type === "locality" ? locById.get(loc.parent_id) : loc;
          const citySlug = cityLoc ? slugifyBase(cityLoc.name) : "";
          if (!citySlug) continue;
          candidates.push({
            pageType: "category_location",
            categoryId: catId,
            locationId,
            listings: shared,
            slug: uniqueSlug(`${cat.slug}-${citySlug}`, new Set(candidates.map((c) => c.slug))),
            routePath: `/sports/${cat.slug}/${citySlug}/`,
          });
        }
      }
    }
  }
  return candidates;
}
