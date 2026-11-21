/**
 * Slug service — pure functions, shared by app code, build scripts and
 * api/serve.js (importable from both TS and .mjs; no DOM/env dependencies).
 *
 * Master prompt §7 slug rules: lowercase ASCII, transliterated, pattern
 * {turf-name}-{locality}-{city}; collisions get a short numeric suffix;
 * never cut mid-word; length-capped by config.slugMaxChars.
 */

/** Latin-1 + common Indic-adjacent transliterations kept minimal and explicit. */
const TRANSLIT = {
  á: "a", à: "a", â: "a", ä: "a", ã: "a", å: "a", é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i", ó: "o", ò: "o", ô: "o", ö: "o", õ: "o",
  ú: "u", ù: "u", û: "u", ü: "u", ñ: "n", ç: "c", š: "s", ž: "z", œ: "oe", æ: "ae",
};

/** Fold any string to lowercase ASCII; unknown scripts are dropped (never mojibake). */
export function foldToAscii(str) {
  return (str || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .map((ch) => TRANSLIT[ch.toLowerCase()] ?? ch)
    .join("");
}

/** Base slugify: ASCII fold, keep a-z0-9, collapse to hyphens. */
export function slugifyBase(str) {
  return foldToAscii(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Word-safe truncation: never cut mid-word, drop trailing hyphen. */
function truncateWords(slug, maxChars) {
  if (slug.length <= maxChars) return slug;
  const cut = slug.slice(0, maxChars);
  const lastHyphen = cut.lastIndexOf("-");
  return (lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, "");
}

/**
 * Deterministic SEO slug: {turf-name}-{locality}-{city}.
 * Empty locality/city segments are skipped (flagged upstream, never faked).
 */
export function buildSeoTurfSlug({ name, locality, city }, { maxChars = 80 } = {}) {
  const parts = [name, locality, city].map((p) => slugifyBase(p)).filter(Boolean);
  return truncateWords(parts.join("-"), maxChars);
}

/**
 * Legacy runtime slug ({name}-{id}) — kept byte-identical to the existing
 * lib/seo.ts buildTurfSlug so pre-engine URLs keep working and the 301
 * mapping old→new can be generated without recomputation drift.
 */
export function buildLegacyTurfSlug(id, name, { maxChars = 80 } = {}) {
  return truncateWords(`${slugifyBase(name)}-${slugifyBase(id)}`, maxChars);
}

/**
 * Collision handling: append -2, -3, … (short numeric suffix) until unused.
 * `taken` is a Set (or iterable) of slugs already claimed, lowercased.
 */
export function uniqueSlug(base, taken, { maxChars = 80 } = {}) {
  const clean = truncateWords(base, maxChars);
  if (!taken.has(clean)) return clean;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`;
    const candidate = truncateWords(clean, maxChars - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
  // 999 collisions is a data-integrity emergency, not a slug problem.
  throw new Error(`seo-engine: no unique slug for "${base}" after 998 attempts`);
}
