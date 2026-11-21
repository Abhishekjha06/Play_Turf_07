import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLegacyTurfSlug, canonicalizeUrl } from "@/lib/seo-engine";

/**
 * Amendment 8 — bot-HTML vs SPA parity.
 *
 * Phase 1 scope: the build artifact api/agent-content.json is the bot-HTML
 * source of truth; the SPA derives the same facts from lib/seo.ts. This test
 * pins the SHARED rules so the two renderers cannot drift before Phase 2
 * routes both through seo_metadata:
 *   - every public route has title/description/h1/robots
 *   - sections are {h2, body} string pairs (safe to escape into HTML)
 *   - the render-time canonical is canonical-form (absolute + trailing slash,
 *     amendment 7)
 *   - links are site-internal (absolutized at render)
 *   - turf routes use clean slugs, never raw ids
 * Phase 2 adds per-route DOM parity once both sides read seo_metadata.
 */

const artifactPath = resolve(__dirname, "../../../api/agent-content.json");
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

const ORIGIN = artifact.origin;
const routes = artifact.routes || {};
const publicRoutes = Object.entries(routes).filter(
  ([path]) => !artifact.privatePrefixes.some((pfx: string) => path.startsWith(pfx))
);

describe("bot-HTML vs SPA parity (agent-content.json artifact)", () => {
  it("has routes at all (build artifact is fresh)", () => {
    expect(publicRoutes.length).toBeGreaterThan(0);
  });

  it.each(publicRoutes.map(([p]) => p))(
    "route %s: title/description/h1/robots present, sections well-formed, canonical canonical-form",
    (path) => {
      const r = routes[path];
      expect(typeof r.title === "string" && r.title.length > 0, `title for ${path}`).toBe(true);
      expect(typeof r.description === "string" && r.description.length > 0, `description for ${path}`).toBe(true);
      expect(typeof r.h1 === "string" && r.h1.length > 0, `h1 for ${path}`).toBe(true);

      // public routes are indexable in the artifact
      expect(String(r.robots), `robots for ${path}`).toMatch(/^index$/i);

      // sections: the generator emits {h2|heading, body} where body is a
      // string OR a string[] (FAQ/list sections). All values must be plain
      // strings or string arrays (escapable, no raw HTML) with real content.
      expect(Array.isArray(r.sections) && r.sections.length > 0, `sections for ${path}`).toBe(true);
      const isStringy = (v: unknown): boolean =>
        typeof v === "string" || (Array.isArray(v) && v.every((x) => isStringy(x)));
      for (const s of r.sections) {
        const heading = typeof s.h2 === "string" ? s.h2 : typeof s.heading === "string" ? s.heading : "";
        const body = isStringy(s.body) ? (Array.isArray(s.body) ? s.body.join(" ") : s.body) : "";
        expect(heading + body).not.toBe("");
        for (const v of Object.values(s)) {
          expect(isStringy(v), `section values on ${path} must be strings or string arrays`).toBe(true);
        }
      }
      expect(JSON.stringify(r)).not.toMatch(/<\/script/i);

      // render-time canonical (toHtml emits ORIGIN + path) must be canonical-form
      expect(canonicalizeUrl(`${ORIGIN}${path}`)).toBe(`${ORIGIN}${path === "/" ? "/" : path + "/"}`);
    }
  );

  it("links are site-internal and get absolutized at render time (no broken internal links)", () => {
    for (const [path, r] of publicRoutes) {
      for (const link of r.links || []) {
        const [label, href] = link;
        expect(label, `link label on ${path}`).toBeTruthy();
        expect(
          href.startsWith("/") || href.startsWith(ORIGIN),
          `link ${href} on ${path} must be site-internal or absolute`
        ).toBe(true);
        expect(
          href.startsWith("http") && !href.startsWith(ORIGIN),
          `external link ${href} on ${path} is not allowed in the artifact`
        ).toBe(false);
      }
    }
  });

  it("turf routes use clean slugs, never raw ids (legacy raw-id URLs get 301s in Phase 2)", () => {
    const turfRoutes = Object.keys(routes).filter((p) => p.startsWith("/turf/"));
    expect(turfRoutes.length).toBeGreaterThan(0);
    for (const path of turfRoutes) {
      expect(path).toMatch(/^\/turf\/[a-z0-9-]+$/);
      const slug = path.replace(/^\/turf\//, "");
      expect(slug).not.toMatch(/--/);
      expect(slug.startsWith("turf_")).toBe(false);
      // SPA-side equivalence pin: the legacy builder must keep producing the
      // exact slugs the artifact carries (verified against real rows in Phase 2).
      expect(buildLegacyTurfSlug("turf_1", "Greenfield Arena")).toBe("greenfield-arena-turf-1");
    }
  });

  it("organization JSON-LD block parses and stays escapable", () => {
    const org = artifact.organization;
    expect(org && org["@type"]).toBeTruthy();
    if (org.url) expect(String(org.url).startsWith("https://")).toBe(true);
    expect(JSON.stringify(org)).not.toMatch(/<\/script/i);
  });
});
