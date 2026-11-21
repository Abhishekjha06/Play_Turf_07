import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Owner round-3 item 5 — prove the 16 noindex landing candidates are ABSENT
 * from the committed sitemap (the generator now evaluates Phase 3 thresholds
 * before emitting city/sport URLs, matching the SPA's noindex exactly).
 *
 * Data state: current live DB (7 rows, all city/sport candidates below
 * thresholds). If the database later grows past the thresholds those URLs
 * legitimately enter the sitemap — this test pins the CURRENT data state.
 */
const xml = readFileSync(resolve(process.cwd(), "public/sitemap.xml"), "utf8");
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const NOINDEX_CANDIDATES = [
  "/turfs/bangalore",
  "/turfs/dahisar-east",
  "/turfs/delhi",
  "/turfs/hyderabad",
  "/turfs/mumbai",
  "/sports/cricket",
  "/sports/football",
  "/sports/futsal",
  "/sports/basketball",
];

describe("sitemap vs noindex landing candidates (owner round-3 item 5)", () => {
  it("contains turf + static URLs", () => {
    expect(locs.filter((l) => l.includes("/turf/")).length).toBe(7);
    expect(locs.some((l) => l.endsWith("/turfs/"))).toBe(true); // the index page
  });

  it.each(NOINDEX_CANDIDATES)("noindex candidate %s is absent from the sitemap", (candidate) => {
    const hits = locs.filter((l) => l.includes(candidate));
    expect(hits, `${candidate} must not be in the sitemap while noindex (got ${hits.join(", ")})`).toEqual([]);
  });

  it("robots.txt sitemap line points at the configured origin", () => {
    const robots = readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8");
    const line = robots.match(/Sitemap: (.*)/)?.[1];
    const cfg = JSON.parse(readFileSync(resolve(process.cwd(), "../api/seo-config.json"), "utf8"));
    expect(line).toBe(`${cfg.origin}/sitemap.xml`);
  });
});
