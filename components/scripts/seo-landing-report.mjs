#!/usr/bin/env node
/**
 * Phase 3 evidence: evaluate landing pages against the configured thresholds
 * on CURRENT data and print indexable vs noindex (owner request).
 *
 * Data source (labelled per owner requirement): reads turfs via the public
 * REST endpoint (anon key) — the SAME live database rows the SPA uses. Taxonomy
 * comes from the seeded defaults (4 sports + Box Cricket alias) until migration
 * 001 is applied; locations are derived from the address convention (review
 * queue semantics — never auto-published).
 *
 * Usage: node scripts/seo-landing-report.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSeoFlags, SEO_ENGINE_CONFIG, SEO_DEFAULT_SPORTS, SEO_DEFAULT_SPORT_ALIASES } from "../src/config/seo-engine.config.mjs";
import {
  resolveCategories,
  deriveLocationNodes,
  evaluateLandingPage,
  uniqueContentWords,
} from "../src/lib/seo-engine/associations.shared.mjs";
import { slugifyBase } from "../src/lib/seo-engine/slug.shared.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
for (const f of [".env", ".env.local"]) {
  const p = resolve(here, "..", f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SB_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
if (!SB_URL || !KEY) {
  console.error("seo-landing-report: Supabase env not configured");
  process.exit(1);
}

const rows = await (async () => {
  // Amendment 1 + strict flag: published-only, with the documented pre-migration fallback.
  const flags = resolveSeoFlags(env);
  const attempt = async (filtered) => {
    const qs = filtered ? "select=*&status=eq.published" : "select=*";
    const res = await fetch(`${SB_URL}/rest/v1/turfs?${qs}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) throw new Error(String(res.status) + (filtered ? " (filtered)" : ""));
    return res.json();
  };
  try {
    return await attempt(true);
  } catch (e) {
    if (!flags.allowUnfilteredTurfsFallback && !/\(filtered\)/.test(e.message)) throw e;
    console.warn("⚠ status column unavailable (migration 001 unapplied) — evaluating on the unfiltered read.");
    return await attempt(false);
  }
})();

// Taxonomy: seeded defaults (post-migration the worker reads the real tables).
const categories = SEO_DEFAULT_SPORTS.map((name, i) => ({ id: i + 1, name, slug: slugifyBase(name) }));
const catId = new Map(categories.map((c) => [c.name, c.id]));
const aliases = SEO_DEFAULT_SPORT_ALIASES.map((a, i) => ({ id: 100 + i, alias: a.alias, category_id: catId.get(a.canonical) }));

// Derive locations from the address convention (review-queue semantics).
const cityMap = new Map();
for (const t of rows) {
  const city = (t.city || "").trim();
  if (!city) continue;
  const { nodes, issues } = deriveLocationNodes(t, []);
  const localityNode = nodes.find((n) => n.type === "locality");
  const cityNode = nodes.find((n) => n.type === "city");
  if (!cityNode) continue;
  if (!cityMap.has(cityNode.slug)) cityMap.set(cityNode.slug, { city: cityNode, localities: new Map(), turfs: [] });
  const entry = cityMap.get(cityNode.slug);
  entry.turfs.push(t);
  for (const i of issues) void i; // issues are reported by the worker, not here
  if (localityNode) {
    if (!entry.localities.has(localityNode.slug)) entry.localities.set(localityNode.slug, { node: localityNode, turfs: [] });
    entry.localities.get(localityNode.slug).turfs.push(t);
  }
}

const lines = [];
let indexable = 0, noindex = 0;

// Category pages (auto-approve above thresholds)
for (const cat of categories) {
  const listings = rows.filter((t) => {
    const r = resolveCategories(t.sport_types || [], categories, aliases);
    return r.categoryIds.includes(cat.id);
  });
  const r = evaluateLandingPage("category", { listings });
  const route = `/sports/${cat.slug}/<city>`;
  lines.push(`${r.indexable ? "INDEX" : "noindex"}  category  ${cat.name}  listings=${r.listingCount} words=${r.uniqueWords}  (${route})`);
  r.indexable ? indexable++ : noindex++;
}

// City pages (/turfs/:city — location type, never auto-publishes)
for (const [slug, entry] of cityMap) {
  const r = evaluateLandingPage("location", { listings: entry.turfs });
  lines.push(`${r.indexable ? "INDEX" : "noindex"}  location  /turfs/${slug}/  listings=${r.listingCount} words=${r.uniqueWords}${r.thresholdsPass ? " (eligible — awaiting approval)" : ""}`);
  r.indexable ? indexable++ : noindex++;

  // Locality pages
  for (const [lslug, lentry] of entry.localities) {
    const lr = evaluateLandingPage("location", { listings: lentry.turfs });
    lines.push(`${lr.indexable ? "INDEX" : "noindex"}  location  /turfs/${slug}/${lslug}/  listings=${lr.listingCount} words=${lr.uniqueWords}${lr.thresholdsPass ? " (eligible — awaiting approval)" : ""}`);
    lr.indexable ? indexable++ : noindex++;
  }
}

console.log(`seo-landing-report — current data (${rows.length} published turfs)`);
console.log(`thresholds: ${SEO_ENGINE_CONFIG.landingMinListings} listings / ${SEO_ENGINE_CONFIG.landingMinUniqueWords} words / overlap ${SEO_ENGINE_CONFIG.cannibalizationOverlapThreshold}`);
console.log(`RESULT: indexable=${indexable} noindex=${noindex}`);
console.log(lines.sort().join("\n"));
console.log("\nNOTES: category pages auto-approve above thresholds (autoPublishTemplateSeo).");
console.log("Location/locality pages NEVER auto-publish — eligible pages await admin approval in AdminSeo → Review queue.");
