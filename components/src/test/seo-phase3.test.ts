import { describe, it, expect } from "vitest";
import {
  resolveCategories,
  deriveLocationNodes,
  uniqueContentWords,
  evaluateLandingPage,
  landingCandidates,
} from "@/lib/seo-engine/associations.shared.mjs";

const categories = [
  { id: 1, name: "Cricket", slug: "cricket" },
  { id: 2, name: "Football", slug: "football" },
  { id: 3, name: "Futsal", slug: "futsal" },
  { id: 4, name: "Basketball", slug: "basketball" },
];
const aliases = [{ id: 9, alias: "Box Cricket", category_id: 1 }];

// ── Category resolution: no silent guesses ──────────────────────────────────

describe("association sync — category resolution (Phase 3)", () => {
  it("maps exact sport names", () => {
    const r = resolveCategories(["Cricket", "Football"], categories, aliases);
    expect(r.categoryIds.sort()).toEqual([1, 2]);
    expect(r.issues).toEqual([]);
  });

  it("maps the sanctioned Box Cricket alias to Cricket", () => {
    const r = resolveCategories(["Box Cricket"], categories, aliases);
    expect(r.categoryIds).toEqual([1]);
    expect(r.issues).toEqual([]);
  });

  it("flags junk values (e.g. 'seed data') without associating anything", () => {
    const r = resolveCategories(["seed data"], categories, aliases);
    expect(r.categoryIds).toEqual([]);
    expect(r.issues[0].code).toBe("junk_sport");
  });

  it("flags plausible-but-unmapped sports as unknown (info) — never guessed", () => {
    const r = resolveCategories(["5-a-side"], categories, aliases);
    expect(r.categoryIds).toEqual([]);
    expect(r.issues[0].code).toBe("unknown_sport");
  });
});

// ── Location derivation: review queue, never silent ─────────────────────────

describe("association sync — location derivation (Phase 3)", () => {
  it("uses the admin-reviewed locality column without an issue", () => {
    const r = deriveLocationNodes({ id: "t1", city: "Pune", address: "Baner, Pune", locality: "Baner" }, []);
    expect(r.nodes).toEqual([
      { type: "country", name: "India", slug: "india", parentSlug: null },
      { type: "city", name: "Pune", slug: "pune", parentSlug: "india" },
      { type: "locality", name: "Baner", slug: "baner", parentSlug: "pune" },
    ]);
    expect(r.issues).toEqual([]);
  });

  it("derives from the address convention and queues it for review", () => {
    const r = deriveLocationNodes({ id: "t2", city: "Pune", address: "Baner, Pune" }, []);
    expect(r.nodes.some((n) => n.type === "locality")).toBe(true);
    expect(r.issues[0].code).toBe("locality_needs_review");
  });

  it("city-only when no locality is derivable (city association still works)", () => {
    const r = deriveLocationNodes({ id: "t3", city: "Pune", address: "no convention" }, []);
    expect(r.nodes.some((n) => n.type === "locality")).toBe(false);
    expect(r.issues[0].code).toBe("missing_locality");
  });
});

// ── Landing evaluation: configured thresholds, never lowered ────────────────

// Listings with genuinely distinct facts (name/address/amenities) that cross
// the 150-word threshold — mirrors a real populated locality page.
const makeListings = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `Green Valley Cricket Arena Sector ${i} With Floodlit Practice Nets And Turf Wickets`,
    address: `Baner Main Road Near Undri Chowk Landmark Suite ${i} Pune Maharashtra`,
    sport_types: ["Cricket"],
    amenities: ["Floodlights", "Parking", "Changing Room", "Drinking Water", "First Aid", "Washrooms"],
  }));

describe("landing-page evaluation (Phase 3 thresholds: 3 listings, 150 words, 0.8 overlap)", () => {
  it("category page above thresholds auto-approves (template content)", () => {
    const r = evaluateLandingPage("category", { listings: makeListings(4), introWords: 120 });
    expect(r.thresholdsPass).toBe(true);
    expect(r.indexable).toBe(true);
    expect(r.status).toBe("approved");
  });

  it("category page below the listing threshold is noindex", () => {
    const r = evaluateLandingPage("category", { listings: makeListings(2), introWords: 120 });
    expect(r.thresholdsPass).toBe(false);
    expect(r.indexable).toBe(false);
    expect(r.status).toBe("candidate");
    expect(r.reasons.some((s) => s.includes("listings 2 < 3"))).toBe(true);
  });

  it("location page above thresholds stays candidate — never auto-publishes", () => {
    const r = evaluateLandingPage("location", { listings: makeListings(5), introWords: 130 });
    expect(r.thresholdsPass).toBe(true);
    expect(r.indexable).toBe(false);
    expect(r.status).toBe("candidate");
    expect(r.reasons.some((s) => s.includes("awaiting admin approval"))).toBe(true);
  });

  it("location page publishes only with admin approval AND passing thresholds", () => {
    const r = evaluateLandingPage("location", { listings: makeListings(5), adminApproved: true, introWords: 120 });
    expect(r.thresholdsPass).toBe(true);
    expect(r.indexable).toBe(true);
    expect(r.status).toBe("approved");
  });

  it("override_index forces index below threshold and is reportable", () => {
    const r = evaluateLandingPage("location", { listings: makeListings(1), overrideIndex: true });
    expect(r.indexable).toBe(true);
    expect(r.reasons.some((s) => s.toLowerCase().includes("forced index"))).toBe(true);
    expect(r.reasons.some((s) => s.includes("override_index active below threshold"))).toBe(true);
  });

  it("cannibalization folds near-duplicate children into the parent", () => {
    const parent = makeListings(4);
    const child = parent.slice(0, 4); // 100% overlap
    const r = evaluateLandingPage("category_location", { listings: child, parentListings: parent });
    expect(r.cannibalizedWith).toBe("parent");
    expect(r.indexable).toBe(false);
    expect(r.status).toBe("rejected");
  });

  it("unique words exclude boilerplate — repeated listings never fake 150 words", () => {
    const identical = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      name: "Same Turf",
      address: "Same Address, Same City",
      sport_types: ["Cricket"],
    }));
    const words = uniqueContentWords(identical);
    expect(words).toBeLessThan(150);
    const r = evaluateLandingPage("category", { listings: identical });
    expect(r.indexable).toBe(false);
    expect(r.reasons.some((s) => s.includes("unique words"))).toBe(true);
  });
});

// ── Candidate grouping ───────────────────────────────────────────────────────

describe("landing candidates (Phase 3)", () => {
  const turfs = [
    { id: "a", name: "Turf A", address: "Baner, Pune", sport_types: ["Cricket"] },
    { id: "b", name: "Turf B", address: "Baner, Pune", sport_types: ["Cricket"] },
    { id: "c", name: "Turf C", address: "Kothrud, Pune", sport_types: ["Football"] },
  ];
  const assoc = [
    { turf_id: "a", category_id: 1 },
    { turf_id: "b", category_id: 1 },
    { turf_id: "c", category_id: 2 },
  ];
  const locations = [
    { id: 10, type: "country", name: "India", slug: "india", parent_id: null },
    { id: 11, type: "city", name: "Pune", slug: "pune", parent_id: 10 },
    { id: 12, type: "locality", name: "Baner", slug: "baner", parent_id: 11 },
    { id: 13, type: "locality", name: "Kothrud", slug: "kothrud", parent_id: 11 },
  ];
  const locAssoc = [
    { turf_id: "a", location_id: 12 },
    { turf_id: "b", location_id: 12 },
    { turf_id: "c", location_id: 13 },
    { turf_id: "a", location_id: 11 },
    { turf_id: "b", location_id: 11 },
    { turf_id: "c", location_id: 11 },
  ];

  it("groups category, location and category_location candidates", () => {
    const c = landingCandidates(turfs, categories, assoc, locAssoc, locations);
    const types = c.map((x) => x.pageType).sort();
    expect(types).toEqual([
      "category", "category",
      "category_location", "category_location", "category_location", "category_location",
      "location", "location", "location",
    ]);
    const banerCricket = c.find((x) => x.pageType === "category_location" && x.listings.length === 2);
    expect(banerCricket?.slug).toBe("cricket-turf-baner");
  });
});
