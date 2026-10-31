import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useSeo } from "@/hooks/use-seo";
import type { Turf } from "@/data/seed";
import {
  Breadcrumbs, EmptySeoState, QuickFacts, SeoPageShell, VenueGrid,
  groupByCity, uniqueSports, priceRange,
} from "./shared";
import { SITE_NAME, breadcrumbJsonLd, slugMatches, slugify } from "@/lib/seo";

/** /turfs/:city/ — venues in a real city only (noindex when the city has none). */
export function TurfsCity() {
  const { city: cityParam = "" } = useParams();
  const [turfs, setTurfs] = useState<Turf[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .listTurfs()
      .then(setTurfs)
      .catch(() => setFailed(true));
  }, []);

  const cityMap = turfs ? groupByCity(turfs) : new Map<string, Turf[]>();
  const realCity = Array.from(cityMap.keys()).find((c) => slugMatches(c, cityParam));
  const cityTurfs = realCity ? cityMap.get(realCity)! : [];
  const sports = cityTurfs.length ? uniqueSports(cityTurfs) : [];
  const range = cityTurfs.length ? priceRange(cityTurfs) : {};
  const known = turfs !== null && !failed;
  const cityExists = known && cityTurfs.length > 0;

  useSeo(
    !known
      ? null
      : cityExists
        ? {
            title: `Sports Turfs in ${realCity} — Book by the Hour | ${SITE_NAME}`,
            description: `${cityTurfs.length} sports ${cityTurfs.length === 1 ? "turf" : "turfs"} in ${realCity} offering ${sports.slice(0, 3).join(", ")}. See hourly rates from ₹${range.priceMin ?? "—"}, check live slot availability and book instantly.`,
            path: `/turfs/${slugify(realCity!)}`,
            jsonLd: [
              breadcrumbJsonLd([
                { name: "Home", path: "/" },
                { name: "Turfs", path: "/turfs" },
                { name: realCity!, path: `/turfs/${slugify(realCity!)}` },
              ]),
            ],
          }
        : { title: `Turfs in ${cityParam} | ${SITE_NAME}`, description: "No venues listed here yet.", path: `/turfs/${cityParam}`, noindex: true }
  );

  if (!known) {
    return (
      <SeoPageShell>
        <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Turfs", path: "/turfs" }]} />
        <p className="px-4 py-10 text-sm text-soft">Loading venues…</p>
      </SeoPageShell>
    );
  }

  if (!cityExists) {
    return (
      <SeoPageShell>
        <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Turfs", path: "/turfs" }]} />
        <EmptySeoState
          message={`No sports turfs are listed in "${cityParam}" on ${SITE_NAME} yet. Browse the cities we currently cover instead.`}
          backTo="/turfs"
          backLabel="Browse all turfs"
        />
      </SeoPageShell>
    );
  }

  return (
    <SeoPageShell>
      <Breadcrumbs
        crumbs={[
          { name: "Home", path: "/" },
          { name: "Turfs", path: "/turfs" },
          { name: realCity!, path: `/turfs/${slugify(realCity!)}` },
        ]}
      />
      <h1 className="px-4 mt-3 font-display font-extrabold text-2xl text-foreground">
        Sports Turfs in {realCity}
      </h1>
      <p className="px-4 mt-2 text-sm text-soft max-w-xl">
        {cityTurfs.length} {cityTurfs.length === 1 ? "venue" : "venues"} in {realCity} offering{" "}
        {sports.join(", ") || "sports"} bookings. Pick a venue to see live slots, courts and hourly rates.
      </p>

      <QuickFacts count={cityTurfs.length} sports={sports} {...range} />

      <h2 className="px-4 mt-7 font-display font-bold text-base text-foreground">
        All {realCity} venues
      </h2>
      <VenueGrid turfs={cityTurfs} />

      <p className="px-4 mt-8 text-xs text-soft">
        Looking for a game instead of a full court?{" "}
        <Link to="/open-games" className="text-primary underline underline-offset-2">
          Join an open game in your city
        </Link>{" "}
        and split the court cost with other players.
      </p>
    </SeoPageShell>
  );
}
