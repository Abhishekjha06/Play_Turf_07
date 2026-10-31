import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSeo } from "@/hooks/use-seo";
import type { Turf } from "@/data/seed";
import {
  Breadcrumbs, CityLinks, SeoPageShell, QuickFacts, VenueGrid,
  groupByCity, uniqueSports, priceRange,
} from "./shared";
import {
  SITE_NAME, breadcrumbJsonLd, slugify,
} from "@/lib/seo";

/** /turfs/ — browse every listed venue, grouped by real cities. */
export function TurfsIndex() {
  const [turfs, setTurfs] = useState<Turf[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .listTurfs()
      .then(setTurfs)
      .catch(() => setFailed(true));
  }, []);

  const cityMap = turfs ? groupByCity(turfs) : new Map<string, Turf[]>();
  const cities = Array.from(cityMap.keys())
    .sort()
    .map((c) => ({ name: c, path: `/turfs/${slugify(c)}`, count: cityMap.get(c)!.length }));
  const sports = turfs ? uniqueSports(turfs) : [];
  const range = turfs ? priceRange(turfs) : {};

  useSeo(
    !turfs && !failed
      ? null
      : {
          title: `Browse Sports Turfs by City — ${SITE_NAME}`,
          description: `Every sports turf listed on ${SITE_NAME}, grouped by city: football grounds, cricket pitches, futsal and box-cricket courts with hourly rates and live slot availability.`,
          path: "/turfs",
          jsonLd: [
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Turfs", path: "/turfs" },
            ]),
          ],
          noindex: failed, // never index a broken listing
        }
  );

  if (failed) {
    return (
      <SeoPageShell>
        <EmptySeoStateLazy />
      </SeoPageShell>
    );
  }

  return (
    <SeoPageShell>
      <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Turfs", path: "/turfs" }]} />
      <h1 className="px-4 mt-3 font-display font-extrabold text-2xl text-foreground">
        Browse Sports Turfs
      </h1>
      <p className="px-4 mt-2 text-sm text-soft max-w-xl">
        {turfs
          ? `${turfs.length} ${turfs.length === 1 ? "venue" : "venues"} across ${cities.length} ${cities.length === 1 ? "city" : "cities"} — football, cricket, futsal and more, bookable by the hour with live availability.`
          : "Loading venues…"}
      </p>

      {turfs && (
        <>
          <QuickFacts count={turfs.length} sports={sports} {...range} />
          <h2 className="px-4 mt-6 font-display font-bold text-base text-foreground">Turfs by city</h2>
          {cities.length > 0 ? (
            <CityLinks cities={cities} />
          ) : (
            <p className="px-4 mt-3 text-sm text-soft">No venues listed yet.</p>
          )}
          <h2 className="px-4 mt-7 font-display font-bold text-base text-foreground">All venues</h2>
          <VenueGrid turfs={turfs} />
        </>
      )}
    </SeoPageShell>
  );
}

function EmptySeoStateLazy() {
  return (
    <div className="px-6 py-16 text-center">
      <h1 className="font-display font-extrabold text-xl text-foreground">Couldn't load venues</h1>
      <p className="mt-2 text-sm text-soft">Please try again in a moment.</p>
    </div>
  );
}
