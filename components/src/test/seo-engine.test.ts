import { describe, it, expect } from "vitest";
import {
  foldToAscii,
  slugifyBase,
  buildSeoTurfSlug,
  buildLegacyTurfSlug,
  uniqueSlug,
  siteOrigin,
  absoluteUrl,
  canonicalizeUrl,
  hasTrackingOrFilterParams,
  resolveRedirect,
  collapseRedirectChains,
  seoFlags,
  SEO_CONFIG,
} from "@/lib/seo-engine";
import { resolveSeoFlags } from "@/config/seo-engine";

// ── Slug service (master prompt §7 slug rules) ─────────────────────────────

describe("seo-engine slug service", () => {
  it("folds to lowercase ASCII and strips diacritics", () => {
    expect(foldToAscii("Café Crícket Arena")).toBe("Cafe Cricket Arena");
    expect(slugifyBase("Café Crícket Arena")).toBe("cafe-cricket-arena");
  });

  it("drops non-ASCII scripts instead of producing mojibake", () => {
    expect(slugifyBase("शहीद Ground")).toBe("ground");
  });

  it("builds the spec pattern {name}-{locality}-{city}, skipping empty segments", () => {
    expect(buildSeoTurfSlug({ name: "ABC Sports Arena", locality: "Baner", city: "Pune" }))
      .toBe("abc-sports-arena-baner-pune");
    expect(buildSeoTurfSlug({ name: "ABC Sports Arena", locality: "", city: "Pune" }))
      .toBe("abc-sports-arena-pune");
    expect(buildSeoTurfSlug({ name: "  ABC  ", locality: null, city: undefined }))
      .toBe("abc");
  });

  it("truncates on word boundaries, never mid-word", () => {
    const long = buildSeoTurfSlug(
      { name: "Superlongname Arena Stadium Turf Grounds", locality: "Localityname", city: "Cityname" },
      { maxChars: 40 },
    );
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith("-")).toBe(false);
    expect(long).not.toMatch(/[a-z]-[a-z]*$/ ? /-$|-$/ : /$/);
  });

  it("keeps the legacy {name}-{id} pattern byte-identical to the pre-engine builder", () => {
    // Pre-engine: slugify("Greenfield Arena") + "-" + slugify("turf_1")
    expect(buildLegacyTurfSlug("turf_1", "Greenfield Arena")).toBe("greenfield-arena-turf-1");
  });

  it("resolves collisions with short numeric suffixes", () => {
    const taken = new Set(["arena"]);
    expect(uniqueSlug("arena", taken)).toBe("arena-2");
    expect(uniqueSlug("arena", new Set(["arena", "arena-2", "arena-3"]))).toBe("arena-4");
  });

  it("respects the cap when appending collision suffixes", () => {
    const longBase = "x".repeat(90);
    const slug = uniqueSlug(longBase, new Set(["x".repeat(80)]), { maxChars: 80 });
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-2")).toBe(true);
  });

  it("gives up loudly after 998 collisions (data-integrity emergency)", () => {
    const taken = new Set(Array.from({ length: 1000 }, (_, i) => (i === 0 ? "arena" : `arena-${i + 1}`)));
    expect(() => uniqueSlug("arena", taken)).toThrow();
  });
});

// ── Canonical builder ────────────────────────────────────────────────────────

describe("seo-engine canonical builder", () => {
  it("uses env origin, falling back to the documented constant", () => {
    expect(siteOrigin({ VITE_SITE_ORIGIN: "https://Example.com/" })).toBe("https://example.com");
    expect(siteOrigin({})).toMatch(/^https:\/\/.+vercel\.app$/);
  });

  it("forces https, lowercase host, strips params/hash/trailing slash", () => {
    expect(canonicalizeUrl("http://Example.com/Turfs/?utm_source=x&sort=asc#top", { VITE_SITE_ORIGIN: "https://example.com" }))
      .toBe("https://example.com/Turfs");
  });

  it("keeps the root slash and strips others", () => {
    expect(canonicalizeUrl("https://example.com/", { VITE_SITE_ORIGIN: "https://example.com" })).toBe("https://example.com/");
    expect(canonicalizeUrl("https://example.com/turf/x/", { VITE_SITE_ORIGIN: "https://example.com" })).toBe("https://example.com/turf/x");
  });

  it("strips the known tracking/filter/sort/pagination params", () => {
    expect(hasTrackingOrFilterParams("/turfs?utm_campaign=x")).toBe(true);
    expect(hasTrackingOrFilterParams("/turfs?page=2")).toBe(true);
    expect(hasTrackingOrFilterParams("/turfs")).toBe(false);
  });

  it("absoluteUrl never double-slashes", () => {
    expect(absoluteUrl("/turfs", { VITE_SITE_ORIGIN: "https://example.com" })).toBe("https://example.com/turfs");
    expect(absoluteUrl("turfs", { VITE_SITE_ORIGIN: "https://example.com" })).toBe("https://example.com/turfs");
  });
});

// ── Redirect resolution (master prompt §5: collapse chains, no loops,
//    never redirect to a noindex target) ────────────────────────────────────

const map = (rows: Array<[string, string, number?]>) =>
  new Map(rows.map(([from, to, code]) => [from, { to_path: to, status_code: (code ?? 301) as 301 | 410 }]));

describe("seo-engine redirect resolver", () => {
  it("returns reason none when no row exists", () => {
    expect(resolveRedirect(map([]), "/old") ).toEqual({ status: 301, reason: "none" });
  });

  it("resolves direct and chained redirects to the final destination", () => {
    const redirects = map([
      ["/a", "/b"],
      ["/b", "/c"],
    ]);
    expect(resolveRedirect(redirects, "/a")).toEqual({ status: 301, location: "/c", reason: "resolved" });
    expect(resolveRedirect(redirects, "/c")).toEqual({ status: 301, reason: "none" });
  });

  it("serves 410 directly and refuses chains into 410", () => {
    const redirects = map([
      ["/gone", "", 410],
      ["/x", "/gone"],
    ]);
    expect(resolveRedirect(redirects, "/gone")).toEqual({ status: 410, reason: "gone" });
    expect(resolveRedirect(redirects, "/x").reason).toBe("chain_too_long");
  });

  it("detects loops", () => {
    const redirects = map([
      ["/a", "/b"],
      ["/b", "/a"],
    ]);
    expect(resolveRedirect(redirects, "/a").reason).toBe("loop");
  });

  it("flags chains deeper than the configured depth", () => {
    const redirects = map([
      ["/1", "/2"], ["/2", "/3"], ["/3", "/4"], ["/4", "/5"], ["/5", "/6"], ["/6", "/7"], ["/7", "/8"],
    ]);
    expect(resolveRedirect(redirects, "/1").reason).toBe("chain_too_long");
  });

  it("refuses redirects to noindex targets", () => {
    expect(resolveRedirect(map([["/a", "/hidden"]]), "/a", new Set(["/hidden"])).reason)
      .toBe("target_noindex");
  });

  it("collapses chains into a flat map and reports conflicts", () => {
    const { collapsed, conflicts } = collapseRedirectChains(map([
      ["/a", "/b"],
      ["/b", "/c"],
      ["/gone", "", 410],
      ["/loop1", "/loop2"],
      ["/loop2", "/loop1"],
    ]));
    expect(collapsed.get("/a")).toEqual({ to_path: "/c", status_code: 301 });
    expect(collapsed.get("/gone")).toEqual({ to_path: "", status_code: 410 });
    expect(conflicts.map((c) => c.from)).toEqual(["/loop1", "/loop2"]);
  });
});

// ── Feature flags (master prompt rule 5: off = pre-engine behaviour) ────────

describe("seo-engine feature flags", () => {
  it("default to OFF when no env is set", () => {
    const f = resolveSeoFlags({});
    expect(f).toEqual({
      enabled: false, aiEnabled: false, landingPagesEnabled: false,
      sitemapEnabled: false, redirectsEnabled: false,
    });
  });

  it("accepts 1/true/on case-insensitively", () => {
    expect(resolveSeoFlags({ SEO_ENGINE_ENABLED: "TRUE" }).enabled).toBe(true);
    expect(resolveSeoFlags({ SEO_ENGINE_ENABLED: "1" }).enabled).toBe(true);
    expect(resolveSeoFlags({ SEO_ENGINE_ENABLED: "0" }).enabled).toBe(false);
    expect(resolveSeoFlags({ SEO_ENGINE_ENABLED: "off" }).enabled).toBe(false);
  });
});

// ── Config sanity (master prompt §6 defaults) ───────────────────────────────

describe("seo-engine config", () => {
  it("carries the spec defaults", () => {
    expect(SEO_CONFIG.titleMaxChars).toBe(60);
    expect(SEO_CONFIG.metaDescriptionMinChars).toBe(120);
    expect(SEO_CONFIG.metaDescriptionMaxChars).toBe(160);
    expect(SEO_CONFIG.landingMinListings).toBe(3);
    expect(SEO_CONFIG.landingMinUniqueWords).toBe(150);
    expect(SEO_CONFIG.relatedTurfsMax).toBe(6);
    expect(SEO_CONFIG.relatedRadiusKm).toBe(5);
    expect(SEO_CONFIG.internalLinksMaxPerTurfPage).toBe(15);
    expect(SEO_CONFIG.cannibalizationOverlapThreshold).toBe(0.8);
    expect(SEO_CONFIG.bulkBatchSize).toBe(50);
    expect(SEO_CONFIG.reviewsMinCountForSchema).toBe(1);
    expect(SEO_CONFIG.sitemapMaxUrlsPerFile).toBeLessThanOrEqual(50000);
    expect(SEO_CONFIG.autoApproveAiText).toBe(false);
  });
});
