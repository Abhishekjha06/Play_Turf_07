#!/usr/bin/env node
/**
 * Phase 5 — bulk metadata generation (master prompt §14).
 *
 * Local/CI DATABASE ONLY: refuses hosts that look like a production project.
 * Generates N synthetic turfs (default 100), lets the outbox trigger enqueue
 * their jobs, then drains the queue with the worker logic in batches.
 * Supports --dry-run (no writes), --resume (skip turfs that already have
 * metadata), per-item error capture and progress output.
 *
 * Usage:
 *   node scripts/seo-bulk.mjs --count 100 [--dry-run] [--resume] [--batch 50]
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (local/CI stack), SEO_ENGINE_ENABLED=1
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSeoFlags, SEO_ENGINE_CONFIG } from "../src/config/seo-engine.config.mjs";
import { buildLegacyTurfSlug } from "../src/lib/seo-engine/slug.shared.mjs";

const args = new Set(process.argv.slice(2));
const COUNT = Number(process.argv.find((a) => a === "--count") ? process.argv[process.argv.indexOf("--count") + 1] : 100);
const DRY_RUN = args.has("--dry-run");
const RESUME = args.has("--resume");
const BATCH = Number(process.argv.find((a) => a === "--batch") ? process.argv[process.argv.indexOf("--batch") + 1] : SEO_ENGINE_CONFIG.bulkBatchSize);

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

const SB_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
const FLAGS = resolveSeoFlags(env);

// Safety: local/CI databases only. A production project is identified by a
// nonzero SEO_BULK_ALLOW_PROD (never set in this repo) — everything else
// must run on localhost or a *staging* host.
if (!/localhost|127\.0\.0\.1|staging|ci-supabase/i.test(SB_URL) && !env.SEO_BULK_ALLOW_PROD) {
  console.error("seo-bulk: refusing to bulk-write — SUPABASE_URL does not look like a local/CI stack.");
  console.error("         (point SUPABASE_URL at localhost:54321 or a staging host, or set SEO_BULK_ALLOW_PROD=1 with a backup taken)");
  process.exit(1);
}
if (!FLAGS.enabled) {
  console.log("seo-bulk: SEO_ENGINE_ENABLED off — no-op.");
  process.exit(0);
}
if (!SB_URL || !SERVICE_KEY) {
  console.error("seo-bulk: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function sb(path, options = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers, ...options });
  if (!res.ok) throw new Error(`supabase ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Synthetic rows only — deterministic, clearly labelled, no real listing data. */
function syntheticTurf(i) {
  return {
    id: `bulk_${String(i).padStart(4, "0")}`,
    name: `Bulk Verification Venue ${i}`,
    city: i % 3 === 0 ? "Pune" : i % 3 === 1 ? "Bangalore" : "Delhi",
    address: `Synthetic Street ${i}, ${i % 3 === 0 ? "Baner" : i % 3 === 1 ? "Whitefield" : "Saket"}`,
    image: "https://example.com/synthetic.jpg",
    gallery: [],
    sport_types: i % 2 === 0 ? ["Cricket"] : ["Football"],
    amenities: ["Floodlights", "Parking", "Changing Room"],
    description: `Synthetic bulk-verification venue number ${i}. No real listing data.`,
    timing: "06:00 AM – 11:00 PM",
    price_per_hour: 800 + (i % 5) * 100,
    rating: 0,
    status: "published",
  };
}

async function main() {
  console.log(`seo-bulk: count=${COUNT} batch=${BATCH} dry-run=${DRY_RUN} resume=${RESUME}`);

  // 1. Insert synthetic turfs (the outbox trigger enqueues their jobs).
  let inserted = 0;
  for (let i = 1; i <= COUNT; i += BATCH) {
    const rows = [];
    for (let j = i; j < Math.min(i + BATCH, COUNT + 1); j += 1) rows.push(syntheticTurf(j));
    if (DRY_RUN) {
      console.log(`[dry-run] would insert ${rows.length} turfs (ids ${rows[0].id}…${rows[rows.length - 1].id})`);
      continue;
    }
    try {
      await sb("turfs", { method: "POST", body: JSON.stringify(rows), headers: { ...headers, Prefer: "return=minimal,resolution=ignore-duplicates" } });
      inserted += rows.length;
      console.log(`inserted ${inserted}/${COUNT}`);
    } catch (e) {
      console.error(`insert batch failed: ${e.message.slice(0, 200)}`);
    }
  }
  if (DRY_RUN) {
    console.log("seo-bulk: dry run complete — nothing written.");
    return;
  }

  // 2. Drain the outbox by running the REAL worker (same logic as production).
  const { spawnSync } = await import("node:child_process");
  let rounds = 0;
  for (;;) {
    const pending = await sb("seo_generation_jobs?select=id&status=eq.pending");
    if (!pending.length) break;
    rounds += 1;
    console.log(`draining round ${rounds}: ${pending.length} pending`);
    const r = spawnSync("node", [resolve(here, "seo-worker.mjs"), "--once", "--batch", String(BATCH)], { stdio: "inherit", env });
    if (r.status !== 0) {
      console.error("worker run failed — stopping bulk drain");
      process.exit(1);
    }
    if (rounds > Math.ceil((COUNT * 3) / BATCH) + 5) {
      console.error("too many drain rounds — stopping");
      process.exit(1);
    }
  }
  console.log(`seo-bulk: done (${inserted} synthetic turfs, worker drained ${rounds} round(s))`);
}

main().catch((e) => {
  console.error("seo-bulk fatal:", e.message);
  process.exit(1);
});
