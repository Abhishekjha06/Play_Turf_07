import { describe, it, expect } from "vitest";
import { generateTurfMetadata } from "@/lib/seo-engine/generate.shared.mjs";
import { SEO_CONFIG } from "@/lib/seo-engine";

const turf = {
  id: "turf_1",
  name: "Greenfield Arena",
  slug: "greenfield-arena-turf-1",
  city: "Bangalore",
  locality: "Indiranagar",
  address: "Indiranagar, Bangalore",
  sport_types: ["Football", "Futsal"],
  amenities: ["Flood Lights", "Parking Available", "Washrooms", "Changing Room"],
  price_per_hour: 1200,
  image: "https://img.example/gf.webp",
  gallery: [],
  timing: "06:00 AM – 11:00 PM",
  description: "A floodlit football arena in Indiranagar.",
};

describe("deterministic metadata generator (master prompt §7)", () => {
  it("builds the spec title pattern within the configured cap", () => {
    const m = generateTurfMetadata({ ...turf, name: "ABC Turf", locality: "Baner", city: "Pune" });
    expect(m.seo_title).toBe("ABC Turf in Baner, Pune | Football Turf Booking");
    expect(m.seo_title.length).toBeLessThanOrEqual(SEO_CONFIG.titleMaxChars);
  });

  it("drops secondary sports first, then the suffix, never mid-word", () => {
    // "Greenfield Arena in Indiranagar, Bangalore | Football Turf Booking" is
    // 67 chars > 60 → suffix dropped (sports kept where they fit)
    const m = generateTurfMetadata(turf);
    expect(m.seo_title.length).toBeLessThanOrEqual(SEO_CONFIG.titleMaxChars);
    expect(m.seo_title).toBe("Greenfield Arena in Indiranagar, Bangalore");

    const long = generateTurfMetadata({ ...turf, name: "Greenfield Championship Arena Stadium Grounds" });
    expect(long.seo_title.length).toBeLessThanOrEqual(SEO_CONFIG.titleMaxChars);
    expect(long.seo_title.startsWith("Greenfield Championship")).toBe(true);
  });

  it("meta description is 120-160 chars from real fields, price included when stored", () => {
    const m = generateTurfMetadata(turf);
    expect(m.meta_description).toContain("₹1200/hour");
    expect(m.meta_description).toContain("Flood Lights"); // real amenity
    expect(m.meta_description.length).toBeLessThanOrEqual(SEO_CONFIG.metaDescriptionMaxChars);
  });

  it("never mentions price when none is stored", () => {
    const m = generateTurfMetadata({ ...turf, price_per_hour: null });
    expect(m.meta_description).not.toContain("/hour");
  });

  it("H1 is the venue name — identical to the H1 TurfDetail renders (DOM parity)", () => {
    expect(generateTurfMetadata(turf).h1).toBe("Greenfield Arena");
  });

  it("canonical is absolute with the trailing-slash policy", () => {
    const m = generateTurfMetadata(turf, { originEnv: { VITE_SITE_ORIGIN: "https://playturf.example" } });
    expect(m.canonical_url).toBe("https://playturf.example/turf/greenfield-arena-turf-1/");
  });

  it("filters junk sport values and never invents sports", () => {
    const m = generateTurfMetadata({ ...turf, sport_types: ["Football", "seed data", ""] });
    expect(m.seo_title).not.toContain("seed data");
    expect(m.focus_keyword).toContain("football");
  });

  it("contains NO rating/review fields (item 7 — aggregate is the caller's job from real reviews)", () => {
    const m = generateTurfMetadata({ ...turf, rating: 4.9 });
    expect(JSON.stringify(m)).not.toMatch(/rating|review/i);
  });

  it("handles minimal real data without fabricating", () => {
    const m = generateTurfMetadata({ id: "t9", name: "Basic Turf", city: "Pune", sport_types: [], amenities: [], price_per_hour: 0, address: "", image: null, gallery: [] });
    expect(m.h1).toBe("Basic Turf");
    expect(m.meta_description).toContain("Book Basic Turf in Pune");
    expect(m.og_image).toBe(null);
  });
});
