import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { buildInternalLinks } from "@/lib/seo-engine/internal-links.shared.mjs";
import { buildTurfSlug } from "@/lib/seo";
import type { Turf } from "@/data/seed";

/**
 * Phase 4b — internal linking block on the turf page (master prompt §12):
 * crawlable <a> links to sport/city/locality landing pages and related turfs,
 * validated against real rows, capped by config, indexable targets first.
 */
export function TurfInternalLinks({ turf }: { turf: Turf }) {
  const [links, setLinks] = useState<{ label: string; path: string; kind: string }[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .listTurfs()
      .then((all) => {
        if (!alive) return;
        // Seed taxonomy is static in the app; associations from the worker are
        // reflected via the landing/assessment data when present.
        const categories = ["Cricket", "Football", "Futsal", "Basketball"].map((name, i) => ({
          id: i + 1,
          name,
          slug: name.toLowerCase(),
        }));
        const locations: Array<{ id: number; type: string; name: string; slug: string; parent_id: number | null }> = [];
        let nextId = 10;
        const cityBySlug = new Map<string, { id: number; type: string; name: string; slug: string; parent_id: number | null }>();
        for (const t of all) {
          const city = (t.city || "").trim();
          if (!city) continue;
          const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          if (!cityBySlug.has(slug)) {
            cityBySlug.set(slug, { id: nextId++, type: "city", name: city, slug, parent_id: null });
            locations.push(cityBySlug.get(slug)!);
          }
          const locality = String(t.locality || t.address || "").split(",")[0].trim();
          if (locality.length >= 3 && t.locality) {
            const lslug = locality.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const key = slug + "/" + lslug;
            if (!cityBySlug.has(key)) {
              cityBySlug.set(key, { id: nextId++, type: "locality", name: locality, slug: lslug, parent_id: cityBySlug.get(slug)!.id });
              locations.push(cityBySlug.get(key)!);
            }
          }
        }
        const links = buildInternalLinks(
          { ...turf, slug: buildTurfSlug({ id: turf.id, name: turf.name }) },
          {
            categories,
            locations,
            categoryById: new Map(categories.map((c) => [c.id, c])),
            locationById: new Map(locations.map((l) => [l.id, l])),
            landings: [],
            turfs: all,
            knownRoutes: ["/", "/turfs", "/sports"],
          }
        );
        setLinks(links);
      })
      .catch(() => {
        /* internal links are enhancement-only — never block the page */
      });
    return () => {
      alive = false;
    };
  }, [turf.id]);

  if (!links.length) return null;

  return (
    <section className="mt-5">
      <h3 className="font-semibold text-sm">Explore more</h3>
      <div className="flex flex-wrap gap-2 mt-2">
        {links.map((l) => (
          <Link
            key={l.path}
            to={l.path}
            className="rounded-full border border-[hsl(var(--color-border-default))] bg-panel-2 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default TurfInternalLinks;
