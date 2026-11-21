#!/usr/bin/env node
/**
 * SEO Engine Phase 2 — metadata worker.
 *
 * Drains public.seo_generation_jobs (the outbox the turfs trigger writes to)
 * and generates DETERMINISTIC metadata for each turf (master prompt §14):
 *   - claims a batch atomically via rpc seo_claim_jobs (SKIP LOCKED)
 *   - generates template metadata from real row data (generate.shared.mjs)
 *   - skips when content_hash unchanged (source_version intact)
 *   - assigns turfs.slug via rpc seo_worker_set_slug when missing
 *     (transaction-local GUC — pooler-safe, trigger skipped)
 *   - upserts seo_metadata (+ version snapshot), logs, validation issues
 *   - never touches booking tables; failures mark the job failed and are
 *     logged — a failing job can never affect a listing save or a booking
 *
 * Runs against STAGING by default discipline (runbook §1); production runs are
 * explicit owner actions. Requires the service key (RLS: jobs are admin-only).
 *
 * Usage:
 *   node scripts/seo-worker.mjs [--batch 50] [--dry-run] [--once]
 * Env:
 *   SUPABASE_URL / VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SEO_ENGINE_ENABLED (default off — worker no-ops when off)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSeoFlags, SEO_ENGINE_CONFIG } from "../src/config/seo-engine.config.mjs";
import { generateTurfMetadata } from "../src/lib/seo-engine/generate.shared.mjs";
import { buildLegacyTurfSlug, uniqueSlug } from "../src/lib/seo-engine/slug.shared.mjs";
import { deriveLocality } from "../src/lib/seo-engine/locality.shared.mjs";

const args = new Set(process.argv.slice(2));
const BATCH = Number((process.argv.find((a) => a === "--batch") && process.argv[process.argv.indexOf("--batch") + 1]) || SEO_ENGINE_CONFIG.bulkBatchSize);
const DRY_RUN = args.has("--dry-run");
const ONCE = args.has("--once");

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

const FLAGS = resolveSeoFlags(env);
if (!FLAGS.enabled) {
  console.log("seo-worker: SEO_ENGINE_ENABLED is off — no-op (pre-engine behaviour).");
  process.exit(0);
}

const SB_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SERVICE_KEY) {
  console.error("seo-worker: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required (jobs are admin-only via RLS).");
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

const sportOk = (s) => /^[a-z][a-z0-9 &-]{1,30}$/i.test(s) && !/test|demo|sample|debug|seed data/i.test(s);

async function log(entityType, entityId, trigger, component, status, extra = {}) {
  try {
    await sb("seo_generation_logs", {
      method: "POST",
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, trigger, component, status, ...extra }),
    });
  } catch (e) {
    console.warn(`log write failed: ${e.message}`);
  }
}

async function issue(entityType, entityId, code, severity, message) {
  try {
    await sb("seo_validation_issues", {
      method: "POST",
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, code, severity, message }),
    });
  } catch (e) {
    console.warn(`issue write failed: ${e.message}`);
  }
}

/** sha-256 hex of the source JSON (node crypto). */
async function sourceHash(turf) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(JSON.stringify(turf)).digest("hex");
}

async function claimJobs() {
  return sb("rpc/seo_claim_jobs", {
    method: "POST",
    body: JSON.stringify({ p_batch: BATCH }),
  });
}

async function fetchTurf(id) {
  const rows = await sb(`turfs?select=*&id=eq.${encodeURIComponent(id)}`);
  return rows[0] || null;
}

async function fetchExistingMeta(entityId) {
  const rows = await sb(`seo_metadata?select=id,version,content_hash,locked_fields&entity_type=eq.turf&entity_id=eq.${encodeURIComponent(entityId)}`);
  return rows[0] || null;
}

async function upsertMeta(metadata, prev, hash, autoPublish) {
  const body = {
    ...metadata,
    content_hash: hash,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: autoPublish ? "published" : "generated",
    source_version: prev ? (prev.version || 1) + 1 : 1,
    version: prev ? (prev.version || 1) + 1 : 1,
  };
  // Respect admin-locked fields (master prompt §2.7): never overwrite them.
  const locked = (prev && prev.locked_fields) || [];
  for (const field of locked) delete body[field];

  if (DRY_RUN) return;
  if (prev) {
    // version snapshot first (history + rollback, master prompt §5)
    await sb("seo_metadata_versions", {
      method: "POST",
      body: JSON.stringify({
        seo_metadata_id: prev.id,
        version: prev.version || 1,
        snapshot: { ...metadata, status: prev.status ?? null },
        changed_by: "seo-worker",
        change_reason: "regeneration",
      }),
    });
    await sb(`seo_metadata?entity_type=eq.turf&entity_id=eq.${encodeURIComponent(metadata.entity_id)}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
  } else {
    await sb("seo_metadata", { method: "POST", body: JSON.stringify(body) });
  }
}

async function markJob(id, status, error = null) {
  if (DRY_RUN) return;
  await sb(`seo_generation_jobs?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, last_error: error, processed_at: new Date().toISOString() }),
  });
}

async function processJob(job) {
  const started = Date.now();
  const { id, entity_id: turfId, op, payload, attempts } = job;
  try {
    if (op === "deleted") {
      // 410 tombstone was written by the trigger (same transaction). Nothing
      // else to generate — the sitemap drops the URL on its next refresh.
      await markJob(id, "done");
      return;
    }

    const turf = await fetchTurf(turfId);
    if (!turf) {
      await markJob(id, "done"); // deleted between enqueue and process
      return;
    }

    // data-quality signals → review queue (amendments 6/8: signals, not rules)
    if (!turf.locality && !deriveLocality(turf.address)) {
      await issue("turf", turfId, "missing_locality", "warning",
        `No locality and address does not follow "Locality, City".`);
    } else if (!turf.locality) {
      await issue("turf", turfId, "locality_needs_review", "info",
        `Derived locality "${deriveLocality(turf.address)}" needs admin confirmation.`);
    }
    for (const s of turf.sport_types || []) {
      if (!sportOk(s)) {
        await issue("turf", turfId, "junk_sport", "warning", `sport_types contains junk value "${s}".`);
      }
    }

    // Amendment 8: coordinate plausibility is a REVIEW-QUEUE SIGNAL, not a
    // hard rule — geo markup still emits from the stored row; only distance-
    // derived nearby links are gated on plausibility (wrong-city coords would
    // produce nonsense "nearby" recommendations).
    if (Number.isFinite(turf.lat) && Number.isFinite(turf.lng)) {
      try {
        const peers = await sb(`turfs?select=id,lat,lng&city=eq.${encodeURIComponent(turf.city)}&id=neq.${encodeURIComponent(turfId)}&status=eq.published`);
        const { localityValidationIssues } = await import("../src/lib/seo-engine/locality.shared.mjs");
        for (const vi of localityValidationIssues(turf, peers)) {
          if (vi.code === "implausible_coords" || vi.code === "missing_coords") {
            await issue("turf", turfId, vi.code, vi.severity, vi.message);
          }
        }
      } catch (e) {
        console.warn(`peer fetch failed (non-fatal): ${e.message}`);
      }
    } else {
      await issue("turf", turfId, "missing_coords", "info", `Turf has no usable coordinates — nearby links omitted, geo pending fix.`);
    }

    // slug assignment when missing (id-suffixed legacy pattern, amendment 7)
    if (!turf.slug) {
      const slug = uniqueSlug(buildLegacyTurfSlug(turfId, turf.name), new Set(), SEO_ENGINE_CONFIG);
      if (DRY_RUN) {
        console.log(`[dry-run] would set slug ${turfId} -> ${slug}`);
      } else {
        await sb("rpc/seo_worker_set_slug", { method: "POST", body: JSON.stringify({ p_turf_id: turfId, p_slug: slug }) });
      }
      turf.slug = slug;
    }

    const hash = await sourceHash(turf);
    const prev = await fetchExistingMeta(turfId);
    if (prev && prev.content_hash === hash && (prev.locked_fields || []).length >= 0 && !DRY_RUN) {
      // unchanged source → nothing to regenerate (master prompt §7)
      await markJob(id, "done");
      await log("turf", turfId, "turfs_trigger", "metadata", "skipped", { duration_ms: Date.now() - started });
      return;
    }

    const metadata = generateTurfMetadata(
      { ...turf, slug: turf.slug },
      { originEnv: env }
    );
    await upsertMeta(metadata, prev, hash, FLAGS.enabled && SEO_ENGINE_CONFIG.autoPublishTemplateSeo);
    await log("turf", turfId, "turfs_trigger", "metadata", "success", { duration_ms: Date.now() - started });
    await markJob(id, "done");
  } catch (e) {
    // A failing job NEVER affects a listing save or a booking (master prompt §2.2)
    await log("turf", turfId ?? "?", "turfs_trigger", "metadata", "failed", {
      error_message: String(e.message).slice(0, 500), duration_ms: Date.now() - started,
    }).catch(() => {});
    if (!DRY_RUN && attempts + 1 <= SEO_ENGINE_CONFIG.jobMaxAttempts) {
      await markJob(id, "pending", String(e.message).slice(0, 500)).catch(() => {}); // retry with backoff handled by scheduler
    } else {
      await markJob(id, "failed", String(e.message).slice(0, 500)).catch(() => {});
    }
  }
}

async function main() {
  console.log(`seo-worker: batch=${BATCH} dry-run=${DRY_RUN} strict=${!FLAGS.allowUnfilteredTurfsFallback}`);
  let processed = 0;
  do {
    const jobs = await claimJobs();
    if (!jobs.length) break;
    console.log(`claimed ${jobs.length} job(s)`);
    for (const job of jobs) {
      await processJob(job);
      processed += 1;
    }
  } while (!ONCE);
  console.log(`seo-worker: processed ${processed} job(s)${DRY_RUN ? " (DRY RUN)" : ""}`);
}

main().catch((e) => {
  console.error("seo-worker fatal:", e.message);
  process.exit(1);
});
