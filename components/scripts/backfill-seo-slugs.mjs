#!/usr/bin/env node
/**
 * SEO Engine Phase 1 backfill: populate turfs.slug for every existing turf.
 *
 * Batched (bulkBatchSize), resumable (skips rows that already have a slug
 * unless --force), dry-run capable (--dry-run), per-item error capture.
 *
 * Slug pattern in Phase 1 = the LEGACY runtime pattern (`{name}-{id}`), which
 * matches the URLs the SPA and sitemaps already emit — zero URL changes.
 * The master-prompt pattern ({name}-{locality}-{city}) lands in Phase 2 behind
 * the feature flag, together with 301s from these legacy slugs.
 *
 * Env:
 *   VITE_SUPABASE_URL            (or SUPABASE_URL)  — project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — REQUIRED for writes (RLS bypass); a
 *                                  dry-run can work with the anon key.
 *
 * Usage:
 *   node scripts/backfill-seo-slugs.mjs [--dry-run] [--force]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLegacyTurfSlug, uniqueSlug } from "../src/lib/seo-engine/slug.shared.mjs";
import { SEO_ENGINE_CONFIG } from "../src/config/seo-engine.config.mjs";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const FORCE = args.has("--force");

const here = dirname(fileURLToPath(import.meta.url));

// .env loading mirrors generate-sitemap.mjs (no dotenv dependency).
const env = { ...process.env };
for (const f of [".env", ".env.local"]) {
  const p = resolve(here, "..", f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !(SERVICE_KEY || ANON_KEY)) {
  console.error("backfill-seo-slugs: missing SUPABASE_URL or keys (.env/.env.local)");
  process.exit(1);
}
if (!DRY_RUN && !SERVICE_KEY) {
  console.error("backfill-seo-slugs: writes need SUPABASE_SERVICE_ROLE_KEY (anon is read-only via RLS). Use --dry-run to preview.");
  process.exit(1);
}
const READ_KEY = SERVICE_KEY || ANON_KEY;

async function fetchTurfs(offset) {
  const qs = new URLSearchParams({
    select: "id,name,city,address,slug,updated_at",
    order: "id.asc",
    limit: String(SEO_ENGINE_CONFIG.bulkBatchSize),
    offset: String(offset),
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/turfs?${qs}`, {
    headers: { apikey: READ_KEY, Authorization: `Bearer ${READ_KEY}` },
  });
  if (!res.ok) throw new Error(`turfs fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function patchSlug(id, slug) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/turfs?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ slug }),
  });
  if (!res.ok) throw new Error(`patch failed for ${id}: ${res.status} ${await res.text()}`);
}

async function main() {
  const taken = new Set(); // slugs claimed during this run
  let offset = 0;
  let scanned = 0, written = 0, skipped = 0, failed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let rows;
    try {
      rows = await fetchTurfs(offset);
    } catch (e) {
      console.error("backfill-seo-slugs: fetch error —", e.message);
      process.exit(1);
    }
    if (!rows.length) break;

    for (const t of rows) {
      scanned += 1;
      if (t.slug && !FORCE) { skipped += 1; continue; }
      try {
        // Backfill uses the legacy pattern: deterministic per row, so resumable
        // runs (and duplicate names) stay stable. Collision suffix only kicks
        // in if the same slug was claimed earlier in THIS run or already set
        // on another row (FORCE mode).
        const claimed = new Set(taken);
        if (t.slug) claimed.add(t.slug);
        const slug = uniqueSlug(buildLegacyTurfSlug(t.id, t.name, SEO_ENGINE_CONFIG), claimed, SEO_ENGINE_CONFIG);
        taken.add(slug);
        if (DRY_RUN) {
          console.log(`[dry-run] ${t.id}: ${t.slug ?? "(none)"} -> ${slug}`);
        } else {
          await patchSlug(t.id, slug);
          console.log(`patched ${t.id} -> ${slug}`);
        }
        written += 1;
      } catch (e) {
        failed += 1;
        console.error(`FAILED ${t.id}:`, e.message);
      }
    }
    offset += rows.length;
  }

  console.log(`\nbackfill complete: scanned=${scanned} written=${written} skipped=${skipped} failed=${failed}${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`);
  if (failed > 0) process.exit(2);
}

main();
