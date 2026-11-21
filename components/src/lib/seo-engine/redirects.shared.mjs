/**
 * Redirect resolution — chain collapsing and loop detection (master prompt §5
 * seo_redirects rules). Pure functions over a
 * {from_path → {to_path, status_code}} map; api/serve.js calls resolveRedirect
 * per request with rows loaded from Supabase (service-role); tests use
 * fixtures. Chains are stored pre-collapsed; the resolver defends against
 * hand-edited chains, loops and noindex targets at request time anyway.
 */
import { SEO_ENGINE_CONFIG } from "../../config/seo-engine.config.mjs";

/**
 * @param {Map<string, {to_path: string, status_code: number}>} redirects
 * @param {string} path lowercase, no trailing slash
 * @param {Set<string>} [noindexTargets] paths known to be noindex/unpublished —
 *        redirects to them are rejected by policy
 * @returns {{ status: 301|410, location?: string,
 *            reason: 'none'|'gone'|'resolved'|'loop'|'chain_too_long'|'target_noindex' }}
 *          `reason:'none'` means "no redirect row — caller serves normally".
 */
export function resolveRedirect(redirects, path, noindexTargets = new Set()) {
  const entry = redirects.get(path);
  if (!entry) return { status: 301, reason: "none" };
  if (entry.status_code === 410) return { status: 410, reason: "gone" };

  const maxDepth = SEO_ENGINE_CONFIG.redirectMaxChainDepth;
  const seen = new Set([path]);
  let current = entry.to_path;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (noindexTargets.has(current)) return { status: 301, reason: "target_noindex" };
    const next = redirects.get(current);
    if (!next) return { status: 301, location: current, reason: "resolved" };
    if (seen.has(current)) return { status: 301, reason: "loop" };
    seen.add(current);
    if (next.status_code === 410) return { status: 301, reason: "chain_too_long" }; // chain into 410 — surface in dashboard, never serve
    current = next.to_path;
  }
  return { status: 301, reason: "chain_too_long" };
}

/**
 * Collapse a raw map (chains possibly present in data) into the canonical
 * storage form: every path points straight at its final destination.
 * 410 rows are kept as-is. Problem rows are returned for the dashboard
 * instead of being silently broken.
 */
export function collapseRedirectChains(rawMap, noindexTargets = new Set()) {
  const collapsed = new Map();
  const conflicts = [];
  for (const [from, entry] of rawMap) {
    if (entry.status_code === 410) {
      collapsed.set(from, { to_path: "", status_code: 410 });
      continue;
    }
    const result = resolveRedirect(rawMap, from, noindexTargets);
    if (result.reason === "resolved") {
      collapsed.set(from, { to_path: result.location, status_code: 301 });
    } else {
      conflicts.push({ from, reason: result.reason });
    }
  }
  return { collapsed, conflicts };
}
