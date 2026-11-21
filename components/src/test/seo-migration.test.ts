import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Owner review round 2, item 3 (static half).
 *
 * Live-DB behaviour of the RLS setup is asserted on staging via
 * docs/seo-engine/rls-verification.sql. Here we pin the STRUCTURE of the
 * migration so the RLS guarantees cannot silently regress:
 *   - base seo_* tables get NO public/anon read policy
 *   - every public surface is a view with a published-only WHERE clause
 *   - views are granted to anon; base tables are not
 *   - worker RPCs are revoked from PUBLIC/anon and guarded
 *   - the outbox trigger swallows exceptions and writes 410 tombstones
 *   - the trigger is column-scoped and GUC-gated
 */

const sql = readFileSync(resolve(__dirname, "../../../supabase_seo_001_foundation.sql"), "utf8");
const vercel = JSON.parse(readFileSync(resolve(__dirname, "../../../vercel.json"), "utf8"));

const adminOnlyTables = [
  "seo_generation_jobs",
  "seo_generation_logs",
  "seo_validation_issues",
  "seo_redirects",
];
const contentTables = [
  "seo_metadata",
  "seo_metadata_versions",
  "seo_sport_categories",
  "seo_category_aliases",
  "seo_category_associations",
  "seo_locations",
  "seo_location_associations",
  "seo_landing_pages",
];

describe("migration 001 RLS structure (static)", () => {
  it("enables RLS on every seo_* table", () => {
    for (const t of [...adminOnlyTables, ...contentTables]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`));
    }
  });

  it("creates admin-only policies with is_playturf_admin() (DO-block format)", () => {
    // Policies are created via EXECUTE format(...) inside a DO block; assert
    // the table lists and the policy shape rather than literal policy names.
    for (const t of adminOnlyTables) {
      expect(sql).toMatch(new RegExp(`'${t}'`)); // in the admin-only loop
    }
    for (const t of contentTables) {
      expect(sql).toMatch(new RegExp(`'${t}'`)); // in the content-tables loop
    }
    expect(sql).toMatch(/FOR ALL TO authenticated USING \(public\.is_playturf_admin\(\)\) WITH CHECK \(public\.is_playturf_admin\(\)\)/);
  });

  it("has NO anon/public read policy on any base seo_* table (views only)", () => {
    // the RLS section must contain zero FOR SELECT USING (true) policies —
    // public reads go exclusively through the views
    const rlsSection = sql.slice(sql.indexOf("ENABLE ROW LEVEL SECURITY"));
    expect(rlsSection).not.toMatch(/FOR SELECT USING \(true\)/);
    // and the file never grants SELECT on a base table
    for (const t of contentTables) {
      expect(sql).not.toMatch(new RegExp(`GRANT SELECT ON public\\.${t} `));
    }
  });

  it("public surfaces are views with published-only filters, granted to anon", () => {
    expect(sql).toMatch(/CREATE VIEW public\.seo_public_metadata AS[\s\S]*?WHERE status = 'published' AND robots_index/);
    expect(sql).toMatch(/CREATE VIEW public\.seo_public_turfs AS[\s\S]*?WHERE status = 'published'/);
    for (const v of ["seo_public_metadata", "seo_public_turfs", "seo_public_landing_pages", "seo_public_categories", "seo_public_locations", "seo_public_redirects"]) {
      expect(sql).toMatch(new RegExp(`GRANT SELECT ON public\\.${v} TO anon`));
    }
  });

  it("worker RPCs are guarded and revoked from PUBLIC/anon", () => {
    expect(sql).toMatch(/seo_worker_set_slug[\s\S]*?is_playturf_admin\(\) OR coalesce\(auth\.role\(\), ''\) = 'service_role'/);
    expect(sql).toMatch(/seo_claim_jobs[\s\S]*?is_playturf_admin\(\) OR coalesce\(auth\.role\(\), ''\) = 'service_role'/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.seo_worker_set_slug\(text, text\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.seo_claim_jobs\(integer\) FROM PUBLIC, anon/);
    // transaction-local GUC (pooler-safe): is_local := true, never a bare SET
    expect(sql).toMatch(/set_config\('app\.seo_skip_trigger', 'on', true\)/);
    expect(sql).not.toMatch(/SET app\.seo_skip_trigger/);
  });

  it("outbox trigger: exception-swallowed, column-scoped, 410 tombstone", () => {
    expect(sql).toMatch(/EXCEPTION WHEN OTHERS THEN[\s\S]{0,120}-- Never re-raise/);
    expect(sql).toMatch(/AFTER INSERT\s+OR UPDATE OF name, city, address, locality, slug[\s\S]*?OR DELETE/);
    expect(sql).toMatch(/INSERT INTO public\.seo_redirects \(from_path, to_path, status_code, reason\)[\s\S]*?410, 'turf_deleted'/);
  });
});

describe("sitemap route wiring (static, item 4)", () => {
  it("forces /sitemap.xml through serve.js so no static file shadows it", () => {
    const rewrite = vercel.rewrites[0];
    expect(rewrite).toEqual({ source: "/sitemap.xml", destination: "/api/serve", force: true });
  });

  it("keeps trailingSlash:true consistent with the canonical policy", () => {
    expect(vercel.trailingSlash).toBe(true);
  });
});

// ── Live-style serve.js route checks (item 4) — real handler via child
//    process; no bundler, exactly what the Vercel function runs. ────────────

import { execSync } from "node:child_process";

function runHarness(env = {}) {
  const out = execSync("node scripts/serve-harness.mjs", {
    cwd: resolve(__dirname, "../.."), // components/
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, ...env },
  });
  return JSON.parse(out.trim().split("\n").pop());
}

describe("serve.js live-style (item 4: 200, XML type, no redirect, no shadowing)", () => {
  it("GET /sitemap.xml → 200, application/xml, urlset body", () => {
    const r = runHarness();
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/application\/xml/);
    expect(r.body).toMatch(/^<\?xml version="1\.0"/);
    expect(r.body).toContain("<urlset");
    expect((r.body.match(/<url>/g) || []).length).toBeGreaterThan(0);
    // no redirect was served
    expect(r.status).not.toBe(301);
    expect(r.status).not.toBe(308);
  });

  it("sitemap locs carry the trailing slash (amendment 7) and absolute origin", () => {
    const r = runHarness();
    const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc.startsWith(ORIGIN_ARTIFACT.origin)).toBe(true);
      const bare = loc.replace(/^https?:\/\/[^/]+/, "");
      expect(bare === "/" || bare.endsWith("/") || /\.[a-z0-9]{2,5}$/i.test(bare)).toBe(true);
    }
  });

  it("robots.txt Sitemap line matches the serve.js origin (no origin drift)", () => {
    const robots = readFileSync(resolve(__dirname, "../../../components/public/robots.txt"), "utf8");
    const m = robots.match(/^Sitemap: (.+)$/m);
    expect(m).toBeTruthy();
    expect(m[1]).toBe(`${ORIGIN_ARTIFACT.origin}/sitemap.xml`);
  });

  it("turf route bot HTML: 200 HTML with title/h1/canonical", () => {
    const r = runHarness({ HARNESS_PATH: "turf/greenfield-arena-turf-1", HARNESS_MODE: "bot" });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/html/);
    expect(r.body).toMatch(/<title>Greenfield Arena/);
    expect(r.body).toMatch(/<h1[^>]*>Greenfield Arena<\/h1>/);
    expect(r.body).toMatch(/rel="canonical" href="[^"]*\/turf\/greenfield-arena-turf-1\/?"/);
  });

  it("production env on a vercel origin still serves (prebuild is the loud gate), preview env noindexes", () => {
    const prod = runHarness({ VERCEL_ENV: "production" });
    expect(prod.headers["x-robots-tag"]).toMatch(/index/);
    const preview = runHarness({ VERCEL_ENV: "preview" });
    expect(preview.headers["x-robots-tag"]).toMatch(/noindex/);
  });
});

const ORIGIN_ARTIFACT = JSON.parse(readFileSync(resolve(__dirname, "../../../api/seo-config.json"), "utf8"));
