/**
 * Unit tests for Play Turf Recommendation Engine V1 (Phases 2–12, 17).
 * Pure scoring logic — DB-side behaviour is tested separately in
 * supabase_recommendation_engine.sql §6 (RLS, privileges, radius SQL).
 *
 * Spec test map (Phase 17): cases 1-8, 10-16, 21 covered here; 9/17 need an
 * is_active column (does not exist — documented); 18-20 are SQL-side (T1-T8);
 * 22 is the measured performance report.
 */
import { describe, it, expect } from "vitest";
import {
  RECOMMENDATION_WEIGHTS,
  distanceScore,
  sportsScore,
  priceScore,
  ratingScore,
  bayesianRating,
  facilitiesScore,
  popularityScore,
  weightedScore,
  explanationLabels,
  recommendSimilarTurfs,
  haversineKm,
  normalizeToken,
  type RecommendationCandidate,
} from "@/lib/recommendation";

const weightsSum = Object.values(RECOMMENDATION_WEIGHTS).reduce((a, b) => a + b, 0);

function candidate(overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  const id = overrides.id ?? "turf_x";
  return {
    id,
    // Unique name per fixture: the diversity filter collapses same-name+city
    // venues, so tests that don't target that rule must not collide on it.
    name: `Candidate ${id}`,
    city: "Mumbai",
    image: "img.jpg",
    lat: 18.9936,
    lng: 72.8258,
    price_per_hour: 1500,
    rating: 4.5,
    review_count: 10,
    sport_types: ["Football"],
    amenities: ["Floodlights", "Parking"],
    confirmed_bookings_30d: 0,
    distance_km: 2,
    ...overrides,
  };
}

const CURRENT: RecommendationCandidate = candidate({
  id: "turf_current",
  name: "Current Turf",
  sport_types: ["Football", "Futsal"],
  amenities: ["Floodlights", "Parking", "Washroom"],
});

function run(
  candidates: RecommendationCandidate[],
  opts: { selectedSport?: string | null; bookingDataAvailable?: boolean } = {}
) {
  return recommendSimilarTurfs(CURRENT, candidates, {
    selectedSport: opts.selectedSport ?? null,
    globalAvgRating: 4.5,
    bookingDataAvailable: opts.bookingDataAvailable ?? true,
  });
}

describe("weights (Phase 2)", () => {
  it("sum to exactly 100%", () => {
    expect(weightsSum).toBeCloseTo(1.0, 10);
    expect(RECOMMENDATION_WEIGHTS.distance).toBe(0.35);
    expect(RECOMMENDATION_WEIGHTS.sports).toBe(0.3);
    expect(RECOMMENDATION_WEIGHTS.price).toBe(0.15);
    expect(RECOMMENDATION_WEIGHTS.rating).toBe(0.1);
    expect(RECOMMENDATION_WEIGHTS.facilities).toBe(0.05);
    expect(RECOMMENDATION_WEIGHTS.popularity).toBe(0.05);
  });
});

describe("distance similarity (Phase 3)", () => {
  it("scores 100 at 0 km, 50 at half the radius, 0 at the radius", () => {
    expect(distanceScore(0, 10)).toBe(100);
    expect(distanceScore(5, 10)).toBe(50);
    expect(distanceScore(10, 10)).toBe(0);
  });
  it("never goes negative beyond the radius", () => {
    expect(distanceScore(25, 10)).toBe(0);
  });
  it("haversine: Mumbai→Bangalore ≈ 840+ km, same point = 0", () => {
    const mumbai = { lat: 18.9936, lng: 72.8258 };
    const bangalore = { lat: 12.9784, lng: 77.6408 };
    expect(haversineKm(mumbai, mumbai)).toBeCloseTo(0, 6);
    expect(haversineKm(mumbai, bangalore)).toBeGreaterThan(800);
    expect(haversineKm(mumbai, bangalore)).toBeLessThan(900);
  });
});

describe("sports similarity (Phase 4)", () => {
  it("spec examples of Jaccard", () => {
    // Current {Football, Futsal}
    expect(sportsScore(["Football", "Futsal"], ["Football", "Futsal"])).toBe(100); // A
    expect(sportsScore(["Football", "Futsal"], ["Football"])).toBe(50); // B
    expect(sportsScore(["Football", "Futsal"], ["Football", "Cricket"])).toBeCloseTo(33.33, 1); // C
    expect(sportsScore(["Football", "Futsal"], ["Cricket"])).toBe(0); // D
  });
  it("normalizes sport identifiers (case/whitespace)", () => {
    expect(sportsScore(["FOOTBALL ", "Futsal"], ["football", " Futsal"])).toBe(100);
  });
  it("selected sport is the primary matching context", () => {
    // Candidate has the selected sport: 0.5·100 (primary) + 0.5·50 (Jaccard) = 75.
    const strong = sportsScore(["Football", "Futsal"], ["Football"], "Football");
    // Candidate lacks the selected sport → heavily penalized even with overlap.
    const lacking = sportsScore(["Football", "Futsal"], ["Futsal", "Cricket"], "Football");
    expect(strong).toBe(75);
    expect(lacking).toBeCloseTo(16.67, 1);
    expect(strong).toBeGreaterThan(lacking);
  });
  it("returns null (not 0) for missing sports data and flags it", () => {
    expect(sportsScore(["Football"], [])).toBeNull();
    const { score, completeness } = weightedScore({
      distance: 50, sports: null, price: null, rating: null, facilities: null, popularity: null,
    });
    expect(score).toBeCloseTo(50, 6); // distance weight re-normalized to 1.0
    expect(completeness.missing).toContain("sports");
  });
});

describe("price similarity (Phase 5)", () => {
  it("spec: identical price = 100, ±20% ≈ 80", () => {
    expect(priceScore(1500, 1500)).toBe(100);
    expect(priceScore(1500, 1200)).toBe(80);
    expect(priceScore(1500, 1800)).toBe(80);
  });
  it("never negative; approaches 0 for wildly different prices", () => {
    expect(priceScore(1000, 5000)).toBe(0);
    expect(priceScore(1000, 1)).toBeCloseTo(0.1, 6); // 1₹ vs 1000₹ → 99.9% difference
    expect(priceScore(1000, 100000)).toBeGreaterThanOrEqual(0);
  });
  it("missing/zero prices are missing data, never scored as 0", () => {
    expect(priceScore(null, 1500)).toBeNull();
    expect(priceScore(1500, null)).toBeNull();
    expect(priceScore(0, 1500)).toBeNull();
    expect(priceScore(1500, 0)).toBeNull();
  });
});

describe("rating quality (Phase 6)", () => {
  it("a 2-review 5.0 ranks BELOW an established 4.7 with hundreds of reviews", () => {
    const small = ratingScore(5, 2, 4.5);
    const big = ratingScore(4.7, 300, 4.5);
    expect(small).toBeLessThan(big);
  });
  it("Bayesian pulls a small-sample rating toward the global average", () => {
    const br = bayesianRating(5, 2, 4.5);
    expect(br).toBeLessThan(5);
    expect(br).toBeGreaterThan(4.5);
  });
  it("no reviews → neutral prior contribution, never an invented rating", () => {
    expect(bayesianRating(null, 0, 4.5)).toBeCloseTo(4.5, 6);
    // The score is computable but the response carries rating=null (tested in runs below).
  });
});

describe("facilities similarity (Phase 7)", () => {
  it("Jaccard over normalized amenities", () => {
    expect(facilitiesScore(["Floodlights", "Parking"], ["Floodlights", "Parking"])).toBe(100);
    // {A,B} vs {A}: ∩ = 1, ∪ = 2 → 50 (matches the Phase 4 spec pattern)
    expect(facilitiesScore(["Floodlights", "Parking"], ["Floodlights"])).toBe(50);
  });
  it("missing facility data is not interpreted as confirmed absence", () => {
    expect(facilitiesScore([], ["Floodlights"])).toBeNull();
    expect(facilitiesScore(["Floodlights"], [])).toBeNull();
  });
});

describe("popularity (Phase 8)", () => {
  it("normalizes against the pool leader", () => {
    expect(popularityScore(10, 20)).toBe(50);
    expect(popularityScore(20, 20)).toBe(100);
  });
  it("a real zero is a real measurement (scores 0, not null)", () => {
    expect(popularityScore(0, 20)).toBe(0);
    expect(popularityScore(0, 0)).toBe(0);
  });
  it("unavailable booking source → null (weight dropped), never guessed", () => {
    expect(popularityScore(null, 20)).toBeNull();
  });
});

describe("weighted aggregation + missing data (Phases 2, 9)", () => {
  it("full-data weights produce the spec formula", () => {
    const { score, completeness } = weightedScore({
      distance: 100, sports: 100, price: 100, rating: 100, facilities: 100, popularity: 100,
    });
    expect(score).toBe(100);
    expect(completeness.available).toHaveLength(6);
    expect(completeness.missing).toHaveLength(0);
  });
  it("re-normalizes when a component is missing (price dropped → distance/sports share 0.5/0.5)", () => {
    const { score } = weightedScore({
      distance: 80, sports: 40, price: null, rating: null, facilities: null, popularity: null,
    });
    expect(score).toBeCloseTo((0.35 * 80 + 0.3 * 40) / 0.65, 6);
  });
  it("all-missing returns NaN so the candidate is skipped, not mis-ranked", () => {
    const { score } = weightedScore({
      distance: null, sports: null, price: null, rating: null, facilities: null, popularity: null,
    });
    expect(Number.isNaN(score)).toBe(true);
  });
  it("every component and total stays within 0–100 (Phase 17 validation)", () => {
    const { score } = weightedScore({
      distance: 150, sports: -20, price: 55, rating: 100, facilities: 90, popularity: 100,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("explanation labels (Phase 12)", () => {
  it("only grounded labels appear", () => {
    const labels = explanationLabels({
      components: { distance: 100, sports: 100, price: 90, rating: 90, facilities: 90, popularity: 0 },
      distance_km: 1.2,
      review_count: 25,
      rating: 4.8,
    });
    expect(labels).toEqual(
      expect.arrayContaining(["Very nearby", "Same sports", "Similar pricing", "Similar facilities", "Highly rated"])
    );
  });
  it("no invented claims: no reviews → never 'Highly rated'", () => {
    const labels = explanationLabels({
      components: { distance: 90, sports: 100, price: 95, rating: 92, facilities: 100, popularity: 0 },
      distance_km: 1,
      review_count: 0,
      rating: null, // neutral prior scored, but no real rating exists
    });
    expect(labels).not.toContain("Highly rated");
  });
  it("distant venue never gets 'Very nearby'", () => {
    const labels = explanationLabels({
      components: { distance: 10, sports: 100, price: 95, rating: 92, facilities: 100, popularity: 0 },
      distance_km: 8,
      review_count: 25,
      rating: 4.8,
    });
    expect(labels).not.toContain("Very nearby");
  });
});

describe("eligibility + ranking (Phases 10, 11)", () => {
  it("10.1 current turf is never recommended", () => {
    const res = run([CURRENT, candidate({ id: "a" })]);
    expect(res.recommendations.some((r) => r.turf_id === CURRENT.id)).toBe(false);
  });
  it("10.3/10.4 invalid or missing coordinates never bypass the filter", () => {
    const res = run([
      candidate({ id: "nocoords", lat: null, lng: null }),
      candidate({ id: "zeroes", lat: 0, lng: 0 }),
      candidate({ id: "faraway", lat: 12.9784, lng: 77.6408 }), // Bangalore ≈ 840 km
      candidate({ id: "nearby", lat: 19.0330, lng: 72.8598 }),  // ~5.2 km from Lower Parel
    ]);
    expect(res.recommendations.map((r) => r.turf_id)).toEqual(["nearby"]);
    expect(res.metadata.candidates_evaluated).toBe(1);
  });
  it("10.5 blank-name turfs are ineligible", () => {
    const res = run([candidate({ id: "blank", name: "   " }), candidate({ id: "ok" })]);
    expect(res.recommendations.map((r) => r.turf_id)).toEqual(["ok"]);
  });
  it("11 radius: 10 km pass used when enough candidates exist", () => {
    const near = [1, 2, 3, 4, 5, 6].map((i) =>
      candidate({
        id: `near_${i}`,
        lat: 18.9936 + i * 0.009,
        lng: 72.8258 + i * 0.009,
        sport_types: ["Football", "Futsal"],
        amenities: ["Floodlights", "Parking", "Washroom"],
      })
    );
    const res = run(near);
    expect(res.metadata.radius_km_used).toBe(10);
    expect(res.metadata.expanded_from_km).toBeNull();
  });
  it("11 fallback: expands to 20 km when fewer than five at 10 km", () => {
    const near1 = candidate({ id: "within_10", lat: 18.9936 + 0.05, lng: 72.8258 + 0.05 }); // ~6.7 km
    const near2 = candidate({ id: "within_20", lat: 18.9936 + 0.09, lng: 72.8258 + 0.09 }); // ~12 km
    const res = run([near1, near2]);
    expect(res.metadata.radius_km_used).toBe(20);
    expect(res.metadata.expanded_from_km).toBe(10);
    expect(res.recommendations.map((r) => r.turf_id)).toContain("within_20");
  });
  it("11 fewer than five candidates overall → return what genuinely exists (no filler)", () => {
    const res = run([candidate({ id: "only_one" })]);
    expect(res.recommendations).toHaveLength(1);
  });
  it("11 caps results at 10 even with many candidates", () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      candidate({
        id: `m_${String(i).padStart(2, "0")}`,
        lat: 18.9936 + i * 0.004,
        lng: 72.8258 + i * 0.004,
        sport_types: ["Football"],
        amenities: ["Floodlights", "Parking"],
      })
    );
    const res = run(many);
    expect(res.recommendations.length).toBeLessThanOrEqual(10);
    expect(res.recommendations.length).toBe(10);
  });
  it("11 deterministic tie-breaking: equal scores order by sports → distance → id", () => {
    const tie = (id: string, dist: number) =>
      candidate({
        id,
        lat: 18.9936 + dist / 111, // so haversine ≈ dist km
        lng: 72.8258,
        sport_types: ["Football"],
        amenities: ["Floodlights", "Parking"],
        price_per_hour: 1500,
        rating: 4.5,
        review_count: 10,
        confirmed_bookings_30d: 3,
      });
    const res = run([tie("t_b", 3), tie("t_a", 3), tie("t_c", 2)]);
    // t_c is closest → distance tie-break first; t_a before t_b by id.
    expect(res.recommendations.map((r) => r.turf_id)).toEqual(["t_c", "t_a", "t_b"]);
    // Same request is deterministic.
    expect(run([tie("t_b", 3), tie("t_a", 3), tie("t_c", 2)]).recommendations.map((r) => r.turf_id)).toEqual(
      res.recommendations.map((r) => r.turf_id)
    );
  });
  it("11 diversity: duplicate venues (same name+city) occupy one slot", () => {
    const res = run([
      candidate({ id: "dup_a", name: "Skyline Turf" }),
      candidate({ id: "dup_b", name: "skyline  TURF" }),
      candidate({ id: "other", name: "Arena X" }),
    ]);
    const names = res.recommendations.map((r) => normalizeToken(r.name));
    expect(names.filter((n) => n === normalizeToken("Skyline Turf"))).toHaveLength(1);
    expect(res.recommendations.map((r) => r.turf_id)).toContain("other");
  });
  it("17 fully-booked active venues remain discoverable (availability ≠ discovery)", () => {
    const res = run([candidate({ id: "full_but_active", confirmed_bookings_30d: 999 })]);
    expect(res.recommendations.map((r) => r.turf_id)).toContain("full_but_active");
  });
  it("9 booking source unavailable → popularity missing, weight re-normalized", () => {
    const res = run([candidate({ id: "a" })], { bookingDataAvailable: false });
    expect(res.metadata.booking_data_available).toBe(false);
    for (const rec of res.recommendations) {
      expect(rec.components.popularity).toBeNull();
      expect(rec.completeness.missing).toContain("popularity");
    }
  });
  it("21 invalid/unknown selected sport penalizes non-matching candidates honestly", () => {
    const res = run([candidate({ id: "hockey_only", sport_types: ["Hockey"] })], { selectedSport: "Golf" });
    expect(res.recommendations[0].components.sports).toBeCloseTo(0, 6);
  });
  it("14/17 response shape carries everything the UI needs", () => {
    const res = run([candidate({ id: "shape_check" })]);
    const rec = res.recommendations[0];
    expect(rec).toMatchObject({
      turf_id: "shape_check",
      name: expect.any(String),
      image: expect.any(String),
      distance_km: expect.any(Number),
      price_per_hour: expect.any(Number),
      sport_types: expect.any(Array),
      amenities: expect.any(Array),
      score: expect.any(Number),
      components: expect.any(Object),
      explanations: expect.any(Array),
      completeness: expect.objectContaining({ available: expect.any(Array), missing: expect.any(Array) }),
    });
    expect(res.metadata).toMatchObject({
      radius_km_used: expect.any(Number),
      candidates_evaluated: expect.any(Number),
      booking_data_available: expect.any(Boolean),
    });
  });
});
