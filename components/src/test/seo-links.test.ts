import { describe, it, expect } from "vitest";
import { buildInternalLinks } from "@/lib/seo-engine/internal-links.shared.mjs";

const categories = [
  { id: 1, name: "Cricket", slug: "cricket" },
  { id: 2, name: "Football", slug: "football" },
];
const locations = [
  { id: 10, type: "country", name: "India", slug: "india", parent_id: null },
  { id: 11, type: "city", name: "Pune", slug: "pune", parent_id: 10 },
  { id: 12, type: "locality", name: "Baner", slug: "baner", parent_id: 11 },
];
const categoryById = new Map(categories.map((c) => [c.id, c]));
const locationById = new Map(locations.map((l) => [l.id, l]));

const turf = {
  id: "t0",
  slug: "arena-baner-turf-0",
  name: "Arena Baner",
  city: "Pune",
  locality: "Baner",
  address: "Baner, Pune",
  sport_types: ["Cricket"],
};

const landings = [
  { page_type: "category_location", category_id: 1, location_id: 12, slug: "cricket-turf-baner", is_indexable: true },
  { page_type: "location", location_id: 12, slug: "baner", is_indexable: false }, // below thresholds
];

const otherTurfs = Array.from({ length: 10 }, (_, i) => ({
  id: `t${i + 1}`,
  slug: `turf-${i + 1}`,
  name: `Turf ${i + 1}`,
  city: i < 3 ? "Pune" : "Mumbai",
  sport_types: i % 2 === 0 ? ["Cricket"] : ["Football"],
}));

const ctx = {
  categories,
  locations,
  categoryById,
  locationById,
  landings,
  turfs: otherTurfs,
  knownRoutes: ["/", "/turfs/", "/sports/"],
  maxLinks: 15,
};

describe("internal linking engine (Phase 4b)", () => {
  it("emits category, city, locality, cat×loc and related-turf links", () => {
    const links = buildInternalLinks(turf, ctx);
    const kinds = links.map((l) => l.kind);
    expect(kinds).toContain("category");
    expect(kinds).toContain("city");
    expect(kinds).toContain("locality");
    expect(kinds).toContain("category_location");
    expect(kinds).toContain("turf");
  });

  it("caps the list at the configured maximum", () => {
    const links = buildInternalLinks(turf, { ...ctx, maxLinks: 5 });
    expect(links.length).toBeLessThanOrEqual(5);
  });

  it("never links to itself", () => {
    const links = buildInternalLinks(turf, ctx);
    expect(links.some((l) => l.path === "/turf/arena-baner-turf-0")).toBe(false);
  });

  it("prefers indexable landing targets and puts them first", () => {
    const links = buildInternalLinks(turf, ctx);
    expect(links[0].kind === "category" || links[0].kind === "category_location").toBe(true);
    // the noindex locality landing is NOT emitted as a preferred target
    expect(links.filter((l) => l.path.includes("baner")).every((l) => l.kind !== "category_location" || links.indexOf(l) < 3)).toBe(true);
  });

  it("validates targets: unknown category/city produce no invented links", () => {
    const links = buildInternalLinks(
      { ...turf, city: "Nowhere", sport_types: ["Unmapped Sport"] },
      { ...ctx, turfs: [] }
    );
    expect(links.filter((l) => l.kind === "category")).toEqual([]);
    expect(links.filter((l) => l.kind === "city")).toEqual([]);
    expect(links.filter((l) => l.kind === "locality")).toEqual([]);
  });

  it("related turfs: same-city, same-sport rank first", () => {
    const links = buildInternalLinks(turf, ctx).filter((l) => l.kind === "turf");
    const first = links[0];
    const turfRow = otherTurfs.find((t) => `/turf/${t.slug}` === first.path);
    expect(turfRow.city).toBe("Pune");
    expect(turfRow.sport_types).toContain("Cricket");
  });
});
