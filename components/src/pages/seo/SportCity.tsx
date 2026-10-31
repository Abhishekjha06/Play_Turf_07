import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useSeo } from "@/hooks/use-seo";
import type { Turf } from "@/data/seed";
import {
  Breadcrumbs, EmptySeoState, QuickFacts, SeoPageShell, VenueGrid,
  groupByCity, isPublishableSport, priceRange,
} from "./shared";
import { SITE_NAME, breadcrumbJsonLd, slugify } from "@/lib/seo";

/** /sports/:sport/:city/ — venues offering that sport in that city. */
export function SportCity() {
  const { sport: sportParam = "", city: cityParam = "" } = useParams();
  const [turfs, setTurfs] = useState<Turf[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .listTurfs()
      .then(setTurfs)
      .catch(() => setFailed(true));
  }, []);

  const cityMap = turfs ? groupByCity(turfs) : new Map<string, Turf[]>();
  const realCity = Array.from(cityMap.keys()).find(
    (c) => slugify(c) === slugify(cityParam)
  );
  const cityTurfs = realCity ? cityMap.get(realCity)! : [];

  // Match the sport against venues' own sport_types (case-insensitive).
  // Test/junk sport values in the DB never become landing pages.
  const sportTurfs = cityTurfs.filter((t) =>
    (t.sport_types || []).some(
      (s) => isPublishableSport(s) && slugify(s) === slugify(sportParam)
    )
  );
  const realSport = sportTurfs[0]?.sport_types?.find(
    (s) => slugify(s) === slugify(sportParam)
  );

  const known = turfs !== null && !failed;
  const exists = sportTurfs.length > 0;
  const range = sportTurfs.length ? priceRange(sportTurfs) : {};
  const path = `/sports/${slugify(sportParam)}/${slugify(realCity || cityParam)}`;

  useSeo(
    !known
      ? null
      : exists
        ? {
            title: `${realSport} Turfs in ${realCity} — Book by the Hour | ${SITE_NAME}`,
            description: `${sportTurfs.length} ${realSport?.toLowerCase()} ${sportTurfs.length === 1 ? "turf" : "turfs"} in ${realCity} with hourly rates from ₹${range.priceMin ?? "—"}. Live slot availability, courts and instant booking.`,
            path,
            jsonLd: [
              breadcrumbJsonLd([
                { name: "Home", path: "/" },
                { name: "Sports", path: "/sports" },
                { name: realSport!, path: `/sports/${slugify(realSport!)}` },
                { name: realCity!, path },
              ]),
            ],
          }
        : {
            title: `${sportParam} turfs in ${cityParam} | ${SITE_NAME}`,
            description: "No venues for this sport here yet.",
            path,
            noindex: true,
          }
  );

  if (!known) {
    return (
      <SeoPageShell>
        <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Sports", path: "/sports" }]} />
        <p className="px-4 py-10 text-sm text-soft">Loading venues…</p>
      </SeoPageShell>
    );
  }

  if (!exists) {
    return (
      <SeoPageShell>
        <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Sports", path: "/sports" }]} />
        <EmptySeoState
          message={`No ${sportParam} venues are listed in ${realCity || cityParam} yet. Try another sport or city.`}
          backTo="/sports"
          backLabel="Browse by sport"
        />
      </SeoPageShell>
    );
  }

  return (
    <SeoPageShell>
      <Breadcrumbs
        crumbs={[
          { name: "Home", path: "/" },
          { name: "Sports", path: "/sports" },
          { name: realSport!, path: `/sports/${slugify(realSport!)}` },
          { name: realCity!, path },
        ]}
      />
      <h1 className="px-4 mt-3 font-display font-extrabold text-2xl text-foreground">
        {realSport} Turfs in {realCity}
      </h1>
      <p className="px-4 mt-2 text-sm text-soft max-w-xl">
        {sportTurfs.length} {sportTurfs.length === 1 ? "venue" : "venues"} in {realCity} offer{" "}
        {realSport?.toLowerCase()}. Compare rates, check courts and book a slot that's free.
      </p>

      <QuickFacts count={sportTurfs.length} sports={[realSport!]} {...range} />

      <h2 className="px-4 mt-7 font-display font-bold text-base text-foreground">
        {realSport} venues in {realCity}
      </h2>
      <VenueGrid turfs={sportTurfs} />

      <p className="px-4 mt-8 text-xs text-soft">
        Other sports in {realCity}:{` `}
        {Array.from(new Set(cityTurfs.flatMap((t) => t.sport_types || [])))
          .filter((s) => slugify(s) !== slugify(sportParam))
          .slice(0, 5)
          .map((s, i, arr) => (
            <span key={s}>
              <Link to={`/sports/${slugify(s)}/${slugify(realCity!)}`} className="text-primary underline underline-offset-2">
                {s}
              </Link>
              {i < arr.length - 1 ? ", " : ""}
            </span>
          ))}
      </p>
    </SeoPageShell>
  );
}
