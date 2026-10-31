import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useSeo } from "@/hooks/use-seo";
import type { Turf } from "@/data/seed";
import {
  Breadcrumbs, SeoPageShell, groupByCity, uniqueSports, priceRange,
} from "./shared";
import { SITE_NAME, breadcrumbJsonLd, slugify } from "@/lib/seo";

/** /sports/ — sports actually offered by listed venues. */
export function SportsIndex() {
  const [turfs, setTurfs] = useState<Turf[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .listTurfs()
      .then(setTurfs)
      .catch(() => setFailed(true));
  }, []);

  useSeo(
    !turfs && !failed
      ? null
      : {
          title: `Book Sports by Type — Football, Cricket, Futsal & More | ${SITE_NAME}`,
          description: `Find ${turfs ? uniqueSports(turfs).slice(0, 5).join(", ") : "sports"} turfs bookable by the hour. Pick a sport to see venues, city coverage and hourly rates.`,
          path: "/sports",
          noindex: failed,
          jsonLd: [
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Sports", path: "/sports" },
            ]),
          ],
        }
  );

  const sports = turfs ? uniqueSports(turfs) : [];
  const cityMap = turfs ? groupByCity(turfs) : new Map<string, Turf[]>();

  // For each sport: which cities have venues offering it (real coverage).
  const sportRows = sports.map((sport) => {
    const venues = Array.from(cityMap.values())
      .flat()
      .filter((t) => (t.sport_types || []).includes(sport));
    const range = priceRange(venues);
    return {
      sport,
      count: venues.length,
      cities: Array.from(new Set(venues.map((t) => t.city))).filter(Boolean),
      priceMin: range.priceMin,
    };
  });

  return (
    <SeoPageShell>
      <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Sports", path: "/sports" }]} />
      <h1 className="px-4 mt-3 font-display font-extrabold text-2xl text-foreground">
        Book by Sport
      </h1>
      <p className="px-4 mt-2 text-sm text-soft max-w-xl">
        {sports.length
          ? `${sports.length} sports across ${cityMap.size} ${cityMap.size === 1 ? "city" : "cities"} — every venue below is bookable by the hour with live slot availability.`
          : "Loading sports…"}
      </p>

      <div className="px-4 mt-5 space-y-3">
        {sportRows.map(({ sport, count, cities, priceMin }) => (
          <div
            key={sport}
            className="rounded-2xl border border-[hsl(var(--color-border-default))] bg-panel p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-bold text-sm text-foreground">{sport}</h2>
              <span className="text-[11px] text-muted2 shrink-0">
                {count} {count === 1 ? "venue" : "venues"}
                {priceMin != null && <> · from ₹{priceMin}/hour</>}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {cities.map((c) => (
                <Link
                  key={`${sport}-${c}`}
                  to={`/sports/${slugify(sport)}/${slugify(c)}`}
                  className="pressable rounded-full border border-[hsl(var(--color-border-default))] bg-panel-2 px-3 py-1 text-[11px] font-semibold text-foreground"
                >
                  {sport} in {c}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SeoPageShell>
  );
}
