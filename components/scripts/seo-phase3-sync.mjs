/**
 * SEO Engine Phase 3 — association/location sync + landing-page evaluation.
 *
 * Called by the worker after each metadata job (per-turf sync) and once after
 * the drain (global landing evaluation). Also runnable standalone:
 *   node scripts/seo-phase3-sync.mjs --associations   # full re-sync
 *   node scripts/seo-phase3-sync.mjs --landings       # evaluation pass
 *
 * Uses ONLY admin-approved taxonomy (seo_sport_categories + aliases) and the
 * configured thresholds; junk/unknown sports queue as issues, locality
 * derivations queue for review, locality pages never auto-publish.
 */
import {
  resolveCategories,
  deriveLocationNodes,
  findLocationNode,
  evaluateLandingPage,
} from "../src/lib/seo-engine/associations.shared.mjs";
import { SEO_ENGINE_CONFIG } from "../src/config/seo-engine.config.mjs";

/**
 * Sync one turf's category + location associations (idempotent, stale removal).
 * @param {object} turf full row
 * @param {{ sb: (path: string, options?: object) => Promise<any>,
 *          issue: (t: string, id: string, code: string, sev: string, msg: string) => Promise<void>,
 *          cache: { categories?: any[], aliases?: any[], locations?: any[] } }} ctx
 */
export async function syncTurfAssociations(turf, ctx) {
  const { sb, issue } = ctx;
  if (!ctx.cache.categories) ctx.cache.categories = await sb("seo_sport_categories?select=*");
  if (!ctx.cache.aliases) ctx.cache.aliases = await sb("seo_category_aliases?select=*");
  if (!ctx.cache.locations) ctx.cache.locations = await sb("seo_locations?select=*");

  const { categoryIds, issues } = resolveCategories(turf.sport_types, ctx.cache.categories, ctx.cache.aliases);
  for (const i of issues) await issue("turf", turf.id, i.code, i.severity, i.message);

  // Category associations: upsert current, remove stale AUTO ones.
  const currentCats = await sb(`seo_category_associations?select=category_id,source&turf_id=eq.${encodeURIComponent(turf.id)}`);
  const wantCats = new Set(categoryIds.map(String));
  for (const cid of wantCats) {
    if (!currentCats.some((c) => String(c.category_id) === cid)) {
      await sb("seo_category_associations", {
        method: "POST",
        body: JSON.stringify({ turf_id: turf.id, category_id: Number(cid), source: "auto" }),
      });
    }
  }
  for (const c of currentCats) {
    if (!wantCats.has(String(c.category_id)) && c.source === "auto") {
      await sb(`seo_category_associations?turf_id=eq.${encodeURIComponent(turf.id)}&category_id=eq.${c.category_id}&source=eq.auto`, { method: "DELETE" });
    }
  }

  // Location associations: upsert the India→city→locality chain, remove stale.
  const { nodes, issues: locIssues } = deriveLocationNodes(turf, ctx.cache.locations);
  for (const i of locIssues) await issue("turf", turf.id, i.code, i.severity, i.message);

  const nodeIds = [];
  let parentId = null;
  for (const node of nodes) {
    let existing = findLocationNode(ctx.cache.locations, node.type, node.slug, node.parentSlug);
    if (!existing) {
      const parentRow = node.parentSlug
        ? ctx.cache.locations.find((l) => l.type !== "country" && l.slug === node.parentSlug)
        : null;
      const inserted = await sb("seo_locations", {
        method: "POST",
        body: JSON.stringify({ type: node.type, name: node.name, slug: node.slug, parent_id: parentRow?.id ?? null }),
        headers: { Prefer: "return=representation" },
      });
      existing = Array.isArray(inserted) ? inserted[0] : inserted;
      ctx.cache.locations.push(existing);
    }
    nodeIds.push(existing.id);
    parentId = existing.id;
  }

  const currentLocs = await sb(`seo_location_associations?select=location_id&turf_id=eq.${encodeURIComponent(turf.id)}`);
  const wantLocs = new Set(nodeIds.map(String));
  for (const lid of wantLocs) {
    if (!currentLocs.some((l) => String(l.location_id) === lid)) {
      await sb("seo_location_associations", {
        method: "POST",
        body: JSON.stringify({ turf_id: turf.id, location_id: Number(lid), is_primary: lid === String(nodeIds[nodeIds.length - 1]) }),
      });
    }
  }
  for (const l of currentLocs) {
    if (!wantLocs.has(String(l.location_id))) {
      await sb(`seo_location_associations?turf_id=eq.${encodeURIComponent(turf.id)}&location_id=eq.${l.location_id}`, { method: "DELETE" });
    }
  }

  return { categoryIds: [...wantCats], locationIds: [...wantLocs] };
}

/**
 * Global landing-page evaluation pass (run after the drain; gated by
 * SEO_LANDING_PAGES_ENABLED). Recomputes listing counts, unique words,
 * thresholds, cannibalization and approval state for every candidate; flips
 * is_indexable accordingly. Location/locality pages never auto-publish.
 * @returns summary {indexable, noindex, flips, candidates}
 */
export async function evaluateAndStoreLandings(ctx) {
  const { sb, issue } = ctx;
  const turfs = await sb("turfs?select=*&status=eq.published");
  const categories = await sb("seo_sport_categories?select=*");
  const catAssoc = await sb("seo_category_associations?select=*");
  const locAssoc = await sb("seo_location_associations?select=*");
  const locations = await sb("seo_locations?select=*");
  const landingRows = await sb("seo_landing_pages?select=*");
  const approvedSlugs = new Set(landingRows.filter((l) => l.status === "approved").map((l) => l.slug));

  const { landingCandidates } = await import("../src/lib/seo-engine/associations.shared.mjs");
  const candidates = landingCandidates(turfs, categories, catAssoc, locAssoc, locations);

  const summary = { indexable: 0, noindex: 0, flips: [], candidates: candidates.length };
  const seen = new Set();

  for (const cand of candidates) {
    const key = `${cand.categoryId ?? "-"}:${cand.locationId ?? "-"}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const existing = landingRows.find((l) => l.category_id === cand.categoryId && l.location_id === cand.locationId);
    const parentListings = cand.locationId
      ? candidates.filter((c) => c.locationId === cand.locationId && c.pageType === "location").flatMap((c) => c.listings)
      : undefined;
    const adminApproved = existing ? approvedSlugs.has(existing.slug) || existing.status === "approved" : false;

    const evalResult = evaluateLandingPage(cand.pageType, {
      listings: cand.listings,
      parentListings,
      adminApproved,
      overrideIndex: existing?.override_index ?? false,
      introWords: adminApproved && existing?.intro_words ? existing.intro_words : 0,
    });

    const upsert = {
      route_path: cand.routePath,
      page_type: cand.pageType,
      category_id: cand.categoryId,
      location_id: cand.locationId,
      slug: cand.slug,
      listing_count: evalResult.listingCount,
      unique_content_words: evalResult.uniqueWords,
      is_indexable: evalResult.indexable,
      status: evalResult.status,
      last_evaluated_at: new Date().toISOString(),
    };

    if (existing) {
      const flip = existing.is_indexable !== evalResult.indexable;
      await sb(`seo_landing_pages?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify(upsert) });
      if (flip) {
        summary.flips.push({ slug: cand.slug, from: existing.is_indexable ? "index" : "noindex", to: evalResult.indexable ? "index" : "noindex" });
        await issue("landing_page", cand.slug, evalResult.indexable ? "landing_now_indexable" : "landing_now_noindex", "info",
          `Landing page ${cand.slug} flipped ${existing.is_indexable ? "index→noindex" : "noindex→index"} (thresholds/approval).`);
      }
    } else {
      await sb("seo_landing_pages", { method: "POST", body: JSON.stringify(upsert) });
      if (evalResult.indexable) {
        summary.flips.push({ slug: cand.slug, from: "new", to: evalResult.indexable ? "index" : "noindex" });
      }
    }

    if (evalResult.indexable) summary.indexable += 1;
    else summary.noindex += 1;
    if (evalResult.reasons.some((r) => r.toLowerCase().includes("forced index"))) {
      await issue("landing_page", cand.slug, "forced_index_below_threshold", "warning",
        `Landing page ${cand.slug} forced indexable below thresholds by admin override.`);
    }
  }

  return summary;
}
