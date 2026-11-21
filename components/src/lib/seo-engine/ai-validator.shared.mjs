/**
 * Phase 5 — AI content validator (master prompt §7).
 *
 * Every AI-generated description must pass this validator before it reaches
 * `needs_review`. Rejection rules (each maps to a validation issue code):
 *   - invented_facilities : an amenity/feature name not present in the source
 *   - invented_price      : any number that is not a real stored price/date/count
 *   - invented_place      : a place name not present in the source
 *   - superlatives        : banned marketing language (best/cheapest/#1/…)
 *   - html                : raw HTML or script-closing sequences
 *   - prompt_injection    : the LISTING text itself contained injection markers
 *                           (detected at source-build time, before the model runs)
 *   - too_similar         : near-duplicate of existing content (word overlap)
 *   - length              : outside the configured description bounds
 *
 * Pure functions; fixtures in tests, worker in production.
 */

const BANNED_SUPERLATIVES = /\b(best|cheapest|number\s*one|#1|top-rated|world-class|unbeatable|perfect)\b/i;
const HTML_TAG = /<\/?[a-z][^>]*>|<\/\s*script\s*/i;
const INJECTION_MARKERS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(your|the)\s+instructions/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /system\s*:\s*/i,
  /<\/?\s*script/i,
];

/** Numbers allowed in output = numbers present in the source snapshot. */
function sourceNumbers(source) {
  const nums = new Set();
  for (const v of [source.price_per_hour, source.lat, source.lng]) {
    if (typeof v === "number" && Number.isFinite(v)) nums.add(String(v));
  }
  for (const s of [source.name, source.city, source.address, source.locality, source.description, ...(source.sport_types || []), ...(source.amenities || [])]) {
    for (const n of String(s || "").matchAll(/\d[\d,.]*/g)) nums.add(n[0].replace(/,$/, ""));
  }
  return nums;
}

/** Word-level Jaccard similarity (0..1) used for the near-duplicate check. */
export function textSimilarity(a, b) {
  const words = (s) =>
    new Set(String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared += 1;
  return shared / Math.min(A.size, B.size);
}

/**
 * Detect prompt-injection markers in LISTING text (untrusted input, master
 * prompt rule 11) — such text is treated as data and the AI job is refused.
 * @returns {Array<{code:string,severity:string,message:string}>}
 */
export function injectionIssues(source) {
  const haystack = [
    source.name, source.description, source.address,
    ...(source.sport_types || []), ...(source.amenities || []),
  ].join("\n");
  const issues = [];
  for (const re of INJECTION_MARKERS) {
    if (re.test(haystack)) {
      issues.push({
        code: "prompt_injection",
        severity: "error",
        message: `Listing text for ${source.id} contains the pattern ${re} — AI generation refused; the text is treated as data.`,
      });
    }
  }
  return issues;
}

/**
 * Validate AI output against the source snapshot.
 * @param {string} text the generated description
 * @param {object} source the listing snapshot (truth)
 * @param {{existingTexts?: string[], minChars?: number, maxChars?: number, similarityMax?: number}} opts
 * @returns {{ ok: boolean, issues: Array<{code:string,severity:string,message:string}> }}
 */
export function validateAiContent(text, source, opts = {}) {
  const min = opts.minChars ?? 120;
  const max = opts.maxChars ?? 200;
  const issues = [];

  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, issues: [{ code: "empty_output", severity: "error", message: "AI returned no content." }] };
  }
  if (HTML_TAG.test(text)) {
    issues.push({ code: "html", severity: "error", message: "Output contains raw HTML tags." });
  }
  if (BANNED_SUPERLATIVES.test(text)) {
    issues.push({ code: "superlatives", severity: "error", message: "Output contains banned superlatives (best/cheapest/#1/…)." });
  }

  // Invented numbers: prices, distances, counts not present in the source.
  const nums = sourceNumbers(source);
  for (const n of text.matchAll(/\b\d[\d,.]*\b/g)) {
    const token = n[0];
    // Years present in the SOURCE data (e.g. "Established 2018") are already
    // in nums via the description tokens — no blanket 4-digit exemption.
    if (!nums.has(token)) {
      issues.push({
        code: "invented_price",
        severity: "error",
        message: `Output contains the number "${token}" which is not present in the listing data.`,
      });
    }
  }

  // Invented facilities: capitalized feature-like phrases not in the source.
  const facilityWords = new Set(
    [...(source.amenities || []), ...(source.sport_types || [])]
      .flatMap((f) => String(f).toLowerCase().split(/[^a-z]+/))
      .filter(Boolean)
  );
  for (const m of text.matchAll(/\b(?:features?|offers?|includes?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/g)) {
    const claimed = m[1].toLowerCase().split(/\s+/);
    if (!claimed.every((w) => facilityWords.has(w))) {
      issues.push({
        code: "invented_facilities",
        severity: "error",
        message: `Output claims facilities "${m[1]}" not present in the listing amenities.`,
      });
    }
  }

  // Invented places.
  const placeWords = new Set(
    [source.name, source.city, source.locality, source.address]
      .flatMap((p) => String(p || "").toLowerCase().split(/[^a-z]+/))
      .filter(Boolean)
  );
  for (const m of text.matchAll(/\b(?:in|near|at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/g)) {
    const place = m[1].toLowerCase();
    if (!placeWords.has(place) && place !== source.city?.toLowerCase()) {
      issues.push({
        code: "invented_place",
        severity: "error",
        message: `Output mentions the place "${m[1]}" which is not part of the listing data.`,
      });
    }
  }

  // Length bounds.
  if (text.length < min || text.length > max) {
    issues.push({ code: "length", severity: "error", message: `Output is ${text.length} chars (allowed ${min}–${max}).` });
  }

  // Near-duplicate of existing approved content.
  const sim = (opts.existingTexts || [])
    .map((t) => textSimilarity(text, t))
    .reduce((m, v) => Math.max(m, v), 0);
  if (sim > (opts.similarityMax ?? 0.8)) {
    issues.push({ code: "too_similar", severity: "error", message: `Output is ${Math.round(sim * 100)}% similar to existing content.` });
  }

  return { ok: issues.length === 0, issues };
}
