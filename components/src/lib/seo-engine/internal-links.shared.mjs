/**
 * Phase 4b — internal linking engine (master prompt §12).
 *
 * Every turf page links, with crawlable <a href> and descriptive anchors, to:
 *   - its sport category landing pages
 *   - its city page and locality page
 *   - related turfs nearby (same locality, then same city, same sport first)
 *   - relevant sport/city landing pages
 *
 * Rules: capped at internalLinksMaxPerTurfPage; every target is VALIDATED
 * against known routes/indexable records (a link to a non-existent page can
 * never be emitted); indexable targets are preferred over noindex ones;
 * self-links are excluded.
 */

const SELF_EXCLUDED = new Set();

/**
 * @param {object} turf full row (id, name, slug, city, locality, sport_types)
 * @param {object} ctx
 *   categories: [{id, name, slug}]
 *   locations:  [{id, type, name, slug, parent_id}]       (flat; parents resolved)
 *   landings:   [{page_type, category_id, location_id, slug, is_indexable}]
 *   turfs:      all published rows (for related-turf targets)
 *   knownRoutes: string[]  artifact/SPA routes that exist (validation floor)
 *   cityOf:     (locationId) => location row (parent resolution helper)
 * @returns {Array<{label: string, path: string, kind: string}>}
 */
export function buildInternalLinks(turf, ctx) {
  const max = ctx.maxLinks ?? 15;
  const known = new Set((ctx.knownRoutes || []).map((p) => String(p).replace(/\/+$/, "") || "/"));
  const indexableLanding = new Set(
    (ctx.landings || []).filter((l) => l.is_indexable).map((l) => `/landing/${l.slug}`)
  );

  // Structural routes derived from REAL taxonomy/location rows are valid
  // targets even when they are noindex (city/locality/category pages exist as
  // soon as their rows exist — the SPA renders them, thresholds decide
  // indexability separately).
  const structural = new Set();
  for (const cat of ctx.categories || []) structural.add(`/sports/${cat.slug}`);
  for (const l of ctx.locations || []) {
    if (l.type === "city") structural.add(`/turfs/${l.slug}`);
    if (l.type === "locality") {
      const parent = (ctx.locations || []).find((p) => p.id === l.parent_id);
      if (parent) structural.add(`/turfs/${parent.slug}/${l.slug}`);
    }
  }

  const links = [];
  const push = (label, path, kind, preferred) => {
    if (!label || !path) return;
    const clean = String(path).replace(/\/+$/, "") || "/";
    // Validation floor (master prompt §12): the target must be a published
    // turf, a known route, an indexable landing, or a structural page derived
    // from real rows — a link to a non-existent page can never occur.
    const isTurf = clean.startsWith("/turf/") && (ctx.turfs || []).some((t) => `/turf/${t.slug}` === clean);
    const isKnown = known.has(clean);
    const isIndexableLanding = [...indexableLanding].some((p) => clean.startsWith(p.replace("/landing", "")));
    const isStructural = structural.has(clean) || [...structural].some((s) => clean.startsWith(s + "/"));
    if (!isTurf && !isKnown && !isIndexableLanding && !isStructural) return;
    if (clean === `/turf/${turf.slug}` || SELF_EXCLUDED.has(clean)) return; // no self-link
    if (links.some((l) => l.path === clean)) return; // dedupe
    links.push({ label, path: clean, kind, preferred: Boolean(preferred && isIndexableLanding) });
  };

  // 1. Category (sport) landing pages for this turf's sports.
  for (const sport of turf.sport_types || []) {
    const cat = (ctx.categories || []).find((c) => c.name.toLowerCase() === String(sport).toLowerCase());
    if (!cat) continue; // unmapped sports: no invented links
    push(`${cat.name} Turfs`, `/sports/${cat.slug}/`, "category", true);
  }

  // 2. City page + locality page.
  const cityLoc = (ctx.locations || []).find(
    (l) => l.type === "city" && l.name.toLowerCase() === String(turf.city || "").toLowerCase()
  );
  if (cityLoc) push(`Turfs in ${cityLoc.name}`, `/turfs/${cityLoc.slug}/`, "city", true);

  const cityId = cityLoc?.id ?? null;
  const locLoc = (ctx.locations || []).find(
    (l) =>
      l.type === "locality" &&
      l.parent_id === cityId &&
      (String(turf.locality || "").toLowerCase() === l.name.toLowerCase() ||
        String(turf.address || "").toLowerCase().includes(l.name.toLowerCase()))
  );
  if (locLoc) push(`Turfs in ${locLoc.name}`, `/turfs/${cityLoc.slug}/${locLoc.slug}/`, "locality", false);

  // 3. Category × location landing pages that include this turf — emitted as
  //    the app's real /sports/{sport}/{city} routes.
  for (const l of ctx.landings || []) {
    if (!l.is_indexable || l.page_type !== "category_location") continue;
    const cat = ctx.categoryById?.get(l.category_id);
    const loc = ctx.locationById?.get(l.location_id);
    if (!cat || !loc) continue;
    const parentCity = (ctx.locations || []).find((p) => p.id === loc.parent_id);
    if (!parentCity) continue;
    push(`${cat.name} Turfs in ${loc.name}`, `/sports/${cat.slug}/${parentCity.slug}/`, "category_location", true);
  }

  // 4. Related turfs: same locality first, then same city, same sport first.
  const sameSport = (t) => (t.sport_types || []).some((s) => (turf.sport_types || []).includes(s));
  const related = (ctx.turfs || [])
    .filter((t) => t.id !== turf.id && t.slug !== turf.slug)
    .sort((a, b) => {
      const score = (t) =>
        (t.city === turf.city ? 2 : 0) + (sameSport(t) ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, 8);
  for (const t of related) {
    push(`${t.name} — ${t.city}`, `/turf/${t.slug}`, "turf", false);
  }

  // Cap: indexable/preferred targets first, then the rest, in insertion order.
  const preferred = links.filter((l) => l.preferred);
  const rest = links.filter((l) => !l.preferred);
  return [...preferred, ...rest].slice(0, max);
}
