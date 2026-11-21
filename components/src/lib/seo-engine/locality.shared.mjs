/**
 * Locality derivation + coordinate plausibility (amendment 6).
 *
 * Live turfs have no locality column (migration 001 adds it) and their
 * coordinates are not validated against the city (00-audit.md §5.3). The
 * worker uses these helpers to derive/flag rather than trust:
 *   - locality is parsed from the "Locality, City" address convention and
 *     lands in an admin review queue (validation issue), never silently used
 *     as fact.
 *   - geo / nearby links are emitted ONLY when the turf's coordinates are
 *     plausible for its city (peer-centroid distance); implausible/missing
 *     coordinates log validation issues and the page omits them.
 *
 * Pure .mjs — shared by the worker, tests and future scripts.
 */

/** Address convention: "Locality, City" (e.g. "Indiranagar, Bangalore") —
 *  only strings actually following the convention yield a locality. */
export function deriveLocality(address) {
  const parts = String(address || "").split(",");
  if (parts.length < 2) return null; // convention requires the comma
  const first = parts[0].trim();
  return first.length >= 3 ? first : null;
}

/** Haversine distance in km. */
export function distanceKm(aLat, aLng, bLat, bLng) {
  if (![aLat, aLng, bLat, bLng].every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Max plausible km between a turf and its city's peer centroid. */
const PLAUSIBLE_MAX_KM = 150;

/**
 * Coordinates plausible for the city? Peer consensus: centroid of other
 * turfs in the same city. Returns true/false, or null when it cannot be
 * judged (no peers / no coords) — callers omit geo on null as well.
 */
export function coordsPlausibleForCity(turf, cityPeers) {
  const others = (cityPeers || []).filter(
    (p) => p.id !== turf.id && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  if (!Number.isFinite(turf.lat) || !Number.isFinite(turf.lng) || others.length === 0) return null;
  const cLat = others.reduce((s, p) => s + p.lat, 0) / others.length;
  const cLng = others.reduce((s, p) => s + p.lng, 0) / others.length;
  const d = distanceKm(turf.lat, turf.lng, cLat, cLng);
  if (d === null) return null;
  return d <= PLAUSIBLE_MAX_KM;
}

/**
 * Validation issue rows for a turf's location data (codes consumed by the
 * admin review queue / dashboard; master prompt §5 seo_validation_issues).
 * @returns {Array<{code: string, severity: string, message: string}>}
 */
export function localityValidationIssues(turf, cityPeers) {
  const issues = [];
  const locality = deriveLocality(turf.address);
  if (!turf.locality && !locality) {
    issues.push({
      code: "missing_locality",
      severity: "warning",
      message: `Turf ${turf.id} has no locality column and its address does not follow the "Locality, City" convention.`,
    });
  } else if (!turf.locality && locality) {
    issues.push({
      code: "locality_needs_review",
      severity: "info",
      message: `Derived locality "${locality}" from address for turf ${turf.id} — admin confirmation required before landing pages use it.`,
    });
  }
  const plausible = coordsPlausibleForCity(turf, cityPeers);
  if (plausible === null) {
    issues.push({
      code: "missing_coords",
      severity: "info",
      message: `Turf ${turf.id} has no usable coordinates or no city peers — geo and nearby links omitted.`,
    });
  } else if (plausible === false) {
    issues.push({
      code: "implausible_coords",
      severity: "warning",
      message: `Turf ${turf.id} coordinates are implausible for city "${turf.city}" — geo and nearby links omitted pending fix.`,
    });
  }
  return issues;
}
