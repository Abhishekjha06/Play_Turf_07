import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useSeo } from "@/hooks/use-seo";
import type { Turf } from "@/data/seed";
import {
  Breadcrumbs, EmptySeoState, QuickFacts, SeoPageShell, VenueGrid,
  groupByCity, uniqueSports, priceRange,
} from "./shared";
import { SITE_NAME, breadcrumbJsonLd, slugify } from "@/lib/seo";

/**
 * /turfs/:city/:locality/ — venues in a locality of a real city.
 * Locality matching uses the venue's own address/landmark text (ilike),
 * and the page is noindexed unless at least one venue matches.
 */
export function TurfsLocality() {
  const { city: cityParam = "", locality: localityParam = "" } = useParams();
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

  // Locality: match against the venue's own address / landmark words.
  const needle = localityParam.replace(/-/g, " ").toLowerCase();
  const localityTurfs = cityTurfs.filter((t) => {
    const haystack = `${t.land_mark || ""} ${t.address || ""}`.toLowerCase();
    return needle.length >= 3 && haystack.includes(needle);
  });

  const known = turfs !== null && !failed;
  const exists = localityTurfs.length > 0;
  const sports = localityTurfs.length ? uniqueSports(localityTurfs) : [];
  const range = localityTurfs.length ? priceRange(localityTurfs) : {};
  const localityName = needle
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const path = `/turfs/${slugify(realCity || cityParam)}/${slugify(localityParam)}`;

  useSeo(
    !known
      ? null
      : exists
        ? {
            title: `Sports Turfs in ${localityName}, ${realCity} | ${SITE_NAME}`,
            description: `${localityTurfs.length} sports ${localityTurfs.length === 1 ? "turf" : "turfs"} in ${localityName}, ${realCity}. Hourly rates from ₹${range.priceMin ?? "—"}, ${sports.slice(0, 3).join(", ")} — check live availability and book.`,
            path,
            jsonLd: [
              breadcrumbJsonLd([
                { name: "Home", path: "/" },
                { name: "Turfs", path: "/turfs" },
                { name: realCity!, path: `/turfs/${slugify(realCity!)}` },
                { name: localityName, path },
              ]),
            ],
          }
        : {
            title: `Turfs in ${localityName} | ${SITE_NAME}`,
            description: "No venues listed in this locality yet.",
            path,
            noindex: true,
          }
  );

  if (!known) {
    return (
      <SeoPageShell>
        <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Turfs", path: "/turfs" }]} />
        <p className="px-4 py-10 text-sm text-soft">Loading venues…</p>
      </SeoPageShell>
    );
  }

  if (!exists) {
    return (
      <SeoPageShell>
        <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Turfs", path: "/turfs" }]} />
        <EmptySeoState
          message={`No venues are listed in ${localityName}${realCity ? `, ${realCity}` : ""} yet.`}
          backTo={realCity ? `/turfs/${slugify(realCity)}` : "/turfs"}
          backLabel={realCity ? `All ${realCity} turfs` : "Browse all turfs"}
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
          { name: localityName, path },
        ]}
      />
      <h1 className="px-4 mt-3 font-display font-extrabold text-2xl text-foreground">
        Sports Turfs in {localityName}, {realCity}
      </h1>
      <p className="px-4 mt-2 text-sm text-soft max-w-xl">
        {localityTurfs.length} {localityTurfs.length === 1 ? "venue" : "venues"} in {localityName}.
        Hourly rates, amenities and live slot availability for each.
      </p>

      <QuickFacts count={localityTurfs.length} sports={sports} {...range} />

      <h2 className="px-4 mt-7 font-display font-bold text-base text-foreground">
        Venues in {localityName}
      </h2>
      <VenueGrid turfs={localityTurfs} />

      <p className="px-4 mt-8 text-xs text-soft">
        <Link to={`/turfs/${slugify(realCity!)}`} className="text-primary underline underline-offset-2">
          See all turfs in {realCity}
        </Link>
      </p>
    </SeoPageShell>
  );
}
