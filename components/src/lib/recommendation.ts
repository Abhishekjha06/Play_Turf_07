/**
 * Play Turf Recommendation Engine V1 — Balanced Recommendation Strategy.
 *
 * Single source of truth for the scoring algorithm. The SQL RPC
 * (`get_similar_turfs`, see supabase_recommendation_engine.sql) implements the
 * same formulas; this module powers the client-side fallback (used until the
 * SQL migration is run) and the unit tests.
 *
 * Weighted score (all components normalized 0–100):
 *   score = Σ(weight_i × score_i) / Σ(weight_i)   over components with data
 *
 * Missing-data policy (Phase 9): a component with no reliable data is `null`,
 * its weight is dropped from the denominator (re-normalization), and its
 * availability is reported in `completeness`. Missing is never scored as 0.
 */

export const RECOMMENDATION_WEIGHTS = {
  distance: 0.35,
  sports: 0.3,
  price: 0.15,
  rating: 0.1,
  facilities: 0.05,
  popularity: 0.05,
} as const;

export const INITIAL_RADIUS_KM = 10;
export const FALLBACK_RADIUS_KM = 20;
export const MAX_RECOMMENDATIONS = 10;
export const MIN_RECOMMENDATIONS_BEFORE_FALLBACK = 5;
/** Bayesian minimum-review threshold (m). */
export const MIN_REVIEWS_FOR_PRIOR = 5;

export type ComponentKey = keyof typeof RECOMMENDATION_WEIGHTS;

export type ComponentScores = Record<ComponentKey, number | null>;

export interface RecommendationCandidate {
  id: string;
  name: string;
  city: string;
  image: string;
  lat: number | null;
  lng: number | null;
  price_per_hour: number | null;
  /** Real review aggregate — null when the venue has no reviews. */
  rating: number | null;
  review_count: number;
  sport_types: string[];
  amenities: string[];
  /** Confirmed bookings in the last 30 days; null when the source is unavailable. */
  confirmed_bookings_30d: number | null;
  /** Pre-computed distance from the current turf in km (null = invalid coords). */
  distance_km: number | null;
}

export interface RecommendationCompleteness {
  /** Components that had real data and participated in the weighted score. */
  available: ComponentKey[];
  /** Components dropped from the weighted average because data was missing. */
  missing: ComponentKey[];
}

export interface SimilarTurfRecommendation {
  turf_id: string;
  name: string;
  image: string;
  city: string;
  /** Haversine distance — an approximation, never presented as driving distance. */
  distance_km: number;
  /** Actual starting hourly price, separate from the similarity score. */
  price_per_hour: number | null;
  rating: number | null;
  review_count: number;
  sport_types: string[];
  amenities: string[];
  /** 0–100 weighted similarity (re-normalized over available components). */
  score: number;
  components: ComponentScores;
  explanations: string[];
  completeness: RecommendationCompleteness;
}

export interface RecommendationMetadata {
  radius_km_used: number;
  expanded_from_km: number | null;
  candidates_evaluated: number;
  /** Whether the popularity factor came from real booking data. */
  booking_data_available: boolean;
}

export interface RecommendationResponse {
  recommendations: SimilarTurfRecommendation[];
  metadata: RecommendationMetadata;
}

// ── Normalization helpers ────────────────────────────────────────────────────

/** Lowercase alnum slug so "Floodlights" / "floodlights " compare equal. */
export function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

// ── Component scores (all 0–100, null = data unavailable) ───────────────────

/** Phase 3: D = 100 × MAX(0, 1 − distance_km / radius_km). */
export function distanceScore(distanceKm: number, radiusKm: number): number {
  return clamp(100 * Math.max(0, 1 - distanceKm / radiusKm));
}

/**
 * Phase 4: Jaccard similarity over normalized sport slugs.
 * When the player selected a sport, that sport is the primary matching
 * context: the score blends the selected-sport match (50%) with the
 * full-set Jaccard (50%) so declared intent dominates without discarding
 * overall similarity.
 */
export function sportsScore(
  currentSports: string[],
  candidateSports: string[],
  selectedSport?: string | null
): number | null {
  const current = currentSports.map(normalizeToken).filter(Boolean);
  const candidate = candidateSports.map(normalizeToken).filter(Boolean);
  if (current.length === 0 || candidate.length === 0) return null; // missing data, not a 0
  const full = jaccard(new Set(current), new Set(candidate)) * 100;
  const selected = selectedSport?.trim();
  if (!selected) return full;
  const primary = candidate.includes(normalizeToken(selected)) ? 100 : 0;
  return 0.5 * primary + 0.5 * full;
}

/**
 * Phase 5: P = 100 × MAX(0, 1 − |candidate − current| / current).
 * Missing, zero or non-finite prices are missing data (never 0).
 */
export function priceScore(currentPrice: number | null, candidatePrice: number | null): number | null {
  if (!currentPrice || currentPrice <= 0 || !candidatePrice || candidatePrice <= 0) return null;
  if (!Number.isFinite(currentPrice) || !Number.isFinite(candidatePrice)) return null;
  return clamp(100 * Math.max(0, 1 - Math.abs(candidatePrice - currentPrice) / currentPrice));
}

/**
 * Phase 6: Bayesian adjusted rating.
 * BR = (v/(v+m))·R + (m/(v+m))·C, normalized to 0–100 over the 1–5 scale.
 * A venue with no reviews gets the neutral prior (BR = C) — never an
 * invented rating; `rating` stays null in the response and "Highly rated"
 * labels require real reviews.
 */
export function bayesianRating(
  rating: number | null,
  reviewCount: number,
  globalAvgRating: number,
  minReviews = MIN_REVIEWS_FOR_PRIOR
): number {
  const R = rating ?? globalAvgRating;
  const v = Math.max(0, reviewCount);
  const m = Math.max(1, minReviews);
  const br = (v / (v + m)) * R + (m / (v + m)) * globalAvgRating;
  return br;
}

export function ratingScore(
  rating: number | null,
  reviewCount: number,
  globalAvgRating: number,
  minReviews = MIN_REVIEWS_FOR_PRIOR
): number {
  const br = bayesianRating(rating, reviewCount, globalAvgRating, minReviews);
  return clamp(((br - 1) / 4) * 100);
}

/** Phase 7: Jaccard similarity over normalized amenity slugs. */
export function facilitiesScore(current: string[], candidate: string[]): number | null {
  const a = current.map(normalizeToken).filter(Boolean);
  const b = candidate.map(normalizeToken).filter(Boolean);
  if (a.length === 0 || b.length === 0) return null; // missing data ≠ confirmed absence
  return jaccard(new Set(a), new Set(b)) * 100;
}

/**
 * Phase 8: popularity from confirmed bookings in the last 30 days,
 * normalized against the best performer in the candidate pool (0–100).
 * A true zero is a real measurement and scores 0; null means the booking
 * source itself was unavailable (weight dropped).
 */
export function popularityScore(
  confirmedBookings30d: number | null,
  poolMaxBookings: number
): number | null {
  if (confirmedBookings30d == null) return null;
  if (poolMaxBookings <= 0) return 0;
  return clamp(100 * (confirmedBookings30d / poolMaxBookings));
}

// ── Weighted aggregation ─────────────────────────────────────────────────────

/**
 * Phase 2 + Phase 9: weighted total, re-normalized over components that
 * actually have data. Returns null only when no component is available.
 */
export function weightedScore(
  components: ComponentScores,
  weights: Record<ComponentKey, number> = RECOMMENDATION_WEIGHTS
): { score: number; completeness: RecommendationCompleteness } {
  let weighted = 0;
  let weightSum = 0;
  const available: ComponentKey[] = [];
  const missing: ComponentKey[] = [];
  for (const key of Object.keys(weights) as ComponentKey[]) {
    const value = components[key];
    if (value == null || !Number.isFinite(value)) {
      missing.push(key);
      continue;
    }
    available.push(key);
    weighted += weights[key] * clamp(value);
    weightSum += weights[key];
  }
  if (available.length === 0 || weightSum === 0) {
    return { score: Number.NaN, completeness: { available, missing } };
  }
  return { score: weighted / weightSum, completeness: { available, missing } };
}

/** Phase 12: grounded labels — each requires supporting data, never invented. */
export function explanationLabels(
  rec: {
    components: ComponentScores;
    distance_km: number;
    review_count: number;
    rating: number | null;
  },
  minReviews = MIN_REVIEWS_FOR_PRIOR
): string[] {
  const labels: string[] = [];
  const { distance, price, rating, facilities, sports } = rec.components;
  if (distance != null && rec.distance_km <= 2) labels.push("Very nearby");
  if (sports != null && sports >= 90) labels.push("Same sports");
  if (price != null && price >= 80) labels.push("Similar pricing");
  if (facilities != null && facilities >= 80) labels.push("Similar facilities");
  // "Highly rated" only with real reviews at or above the Bayesian threshold.
  if (rec.rating != null && rec.review_count >= minReviews && rating != null && rating >= 85) {
    labels.push("Highly rated");
  }
  return labels;
}

// ── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Phase 11: deterministic ordering — total score desc, then sports score,
 * then shorter distance, then higher Bayesian rating, then turf_id so
 * exact ties remain stable across runs.
 */
function compareRecommendations(
  a: { rec: SimilarTurfRecommendation; bayesian: number },
  b: { rec: SimilarTurfRecommendation; bayesian: number }
): number {
  const EPS = 1e-9;
  if (Math.abs(b.rec.score - a.rec.score) > EPS) return b.rec.score - a.rec.score;
  const aSports = a.rec.components.sports ?? -1;
  const bSports = b.rec.components.sports ?? -1;
  if (Math.abs(bSports - aSports) > EPS) return bSports - aSports;
  if (Math.abs(a.rec.distance_km - b.rec.distance_km) > EPS) return a.rec.distance_km - b.rec.distance_km;
  if (Math.abs(b.bayesian - a.bayesian) > EPS) return b.bayesian - a.bayesian;
  return a.rec.turf_id.localeCompare(b.rec.turf_id);
}

/** Phase 11: light diversity — same venue listed twice under the same name/city. */
function isDuplicateVenue(a: { name: string; city: string }, b: { name: string; city: string }): boolean {
  return normalizeToken(a.name) === normalizeToken(b.name) && normalizeToken(a.city) === normalizeToken(b.city);
}

export interface ScoreOptions {
  /** Normalized, distance-filtered, eligible candidates (current turf excluded). */
  candidates: RecommendationCandidate[];
  currentSports: string[];
  currentPrice: number | null;
  currentAmenities: string[];
  globalAvgRating: number;
  radiusKm: number;
  selectedSport?: string | null;
  /** True when confirmed-booking counts came from a real source. */
  bookingDataAvailable: boolean;
}

/** Phase 11: rank, cap and de-duplicate an already-filtered candidate pool. */
export function buildRecommendations(options: ScoreOptions): RecommendationResponse {
  const {
    candidates,
    currentSports,
    currentPrice,
    currentAmenities,
    globalAvgRating,
    radiusKm,
    selectedSport,
    bookingDataAvailable,
  } = options;

  const poolMaxBookings = candidates.reduce(
    (max, c) => Math.max(max, c.confirmed_bookings_30d ?? 0),
    0
  );

  const ranked: { rec: SimilarTurfRecommendation; bayesian: number }[] = [];
  for (const candidate of candidates) {
    const components: ComponentScores = {
      distance: candidate.distance_km != null ? distanceScore(candidate.distance_km, radiusKm) : null,
      sports: sportsScore(currentSports, candidate.sport_types, selectedSport),
      price: priceScore(currentPrice, candidate.price_per_hour),
      rating: ratingScore(candidate.rating, candidate.review_count, globalAvgRating),
      facilities: facilitiesScore(currentAmenities, candidate.amenities),
      popularity: bookingDataAvailable
        ? popularityScore(candidate.confirmed_bookings_30d, poolMaxBookings)
        : null,
    };
    const { score, completeness } = weightedScore(components);
    if (!Number.isFinite(score)) continue; // no usable data at all
    const bayesian = bayesianRating(candidate.rating, candidate.review_count, globalAvgRating);
    const rec: SimilarTurfRecommendation = {
      turf_id: candidate.id,
      name: candidate.name,
      image: candidate.image,
      city: candidate.city,
      distance_km: Math.round((candidate.distance_km ?? 0) * 10) / 10,
      price_per_hour: candidate.price_per_hour,
      rating: candidate.rating,
      review_count: candidate.review_count,
      sport_types: candidate.sport_types,
      amenities: candidate.amenities,
      score: Math.round(score * 10) / 10,
      components,
      explanations: explanationLabels({
        components,
        distance_km: candidate.distance_km ?? 0,
        review_count: candidate.review_count,
        rating: candidate.rating,
      }),
      completeness,
    };
    ranked.push({ rec, bayesian });
  }

  ranked.sort(compareRecommendations);

  const recommendations: SimilarTurfRecommendation[] = [];
  for (const { rec } of ranked) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break;
    // Light diversity: skip a venue already represented by the same name+city.
    if (recommendations.some((r) => isDuplicateVenue(r, rec))) continue;
    recommendations.push(rec);
  }

  return {
    recommendations,
    metadata: {
      radius_km_used: radiusKm,
      expanded_from_km: null,
      candidates_evaluated: candidates.length,
      booking_data_available: bookingDataAvailable,
    },
  };
}

/**
 * Phases 10 + 11: eligibility filters, then scoring, then the 10 km → 20 km
 * fallback when fewer than five recommendations exist.
 */
export function recommendSimilarTurfs(
  current: RecommendationCandidate,
  allCandidates: RecommendationCandidate[],
  options: { selectedSport?: string | null; globalAvgRating: number; bookingDataAvailable: boolean }
): RecommendationResponse {
  const eligible = (radiusKm: number) =>
    allCandidates.filter((c) => {
      if (c.id === current.id) return false; // Phase 10.1
      if (!c.name?.trim()) return false; // Phase 10.5
      // Phase 10.3/10.4 — invalid or missing coordinates never bypass the filter.
      if (
        c.lat == null ||
        c.lng == null ||
        !Number.isFinite(c.lat) ||
        !Number.isFinite(c.lng) ||
        (c.lat === 0 && c.lng === 0)
      ) {
        return false;
      }
      const currentHasCoords =
        current.lat != null && current.lng != null && Number.isFinite(current.lat) && Number.isFinite(current.lng);
      if (!currentHasCoords) return false;
      const km = haversineKm(
        { lat: current.lat as number, lng: current.lng as number },
        { lat: c.lat, lng: c.lng }
      );
      return km <= radiusKm;
    });

  const run = (radiusKm: number) => {
    const pool = eligible(radiusKm).map((c) => ({
      ...c,
      distance_km: haversineKm(
        { lat: current.lat as number, lng: current.lng as number },
        { lat: c.lat as number, lng: c.lng as number }
      ),
    }));
    return buildRecommendations({
      candidates: pool,
      currentSports: current.sport_types,
      currentPrice: current.price_per_hour,
      currentAmenities: current.amenities,
      globalAvgRating: options.globalAvgRating,
      radiusKm,
      selectedSport: options.selectedSport,
      bookingDataAvailable: options.bookingDataAvailable,
    });
  };

  const first = run(INITIAL_RADIUS_KM);
  if (first.recommendations.length >= MIN_RECOMMENDATIONS_BEFORE_FALLBACK) return first;

  const expanded = run(FALLBACK_RADIUS_KM);
  if (expanded.recommendations.length > first.recommendations.length) {
    return {
      ...expanded,
      metadata: { ...expanded.metadata, expanded_from_km: INITIAL_RADIUS_KM },
    };
  }
  // Phase 11: fewer than five even at 20 km — return what is genuinely relevant.
  return first;
}

/** Same haversine formula as src/lib/api/turfs.ts — great-circle km. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
