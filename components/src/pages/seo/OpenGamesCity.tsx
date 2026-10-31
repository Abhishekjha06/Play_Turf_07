import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useSeo } from "@/hooks/use-seo";
import type { OpenGame } from "@/types/openGames";
import type { Turf } from "@/data/seed";
import { Breadcrumbs, EmptySeoState, SeoPageShell } from "./shared";
import { SITE_NAME, breadcrumbJsonLd, slugify } from "@/lib/seo";

/** Crawlable, self-contained game summary (the interactive join flow lives on /open-games). */
function GameSummaryCard({ game }: { game: OpenGame }) {
  return (
    <Link
      to="/open-games"
      className="pressable block rounded-2xl border border-[hsl(var(--color-border-default))] bg-panel p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-bold text-sm text-foreground">
          {game.sport} · {game.venue}
        </h3>
        <span className="text-[11px] text-muted2 shrink-0">
          {game.slots_filled}/{game.slots_total} joined
        </span>
      </div>
      <p className="text-xs text-soft mt-1.5">
        {game.date} · {game.time}
        {game.duration_hours ? ` · ${game.duration_hours}h` : ""}
      </p>
      <p className="text-xs text-soft mt-1">
        Hosted by {game.host_name} · {game.price_per_slot > 0 ? `₹${game.price_per_slot} per player` : "Free to join"}
      </p>
      <p className="text-[11px] font-semibold text-primary mt-2 uppercase tracking-wider">
        View on Open Games
      </p>
    </Link>
  );
}

/**
 * /open-games/:city/ and /open-games/:city/:sport/
 * Real open games only — a city page exists only when games (or venues) do.
 * Games are matched to a city through the venue's turf record.
 */
export function OpenGamesCity() {
  const { city: cityParam = "", sport: sportParam } = useParams();
  const [games, setGames] = useState<OpenGame[] | null>(null);
  const [turfs, setTurfs] = useState<Turf[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([api.listOpenGames(), api.listTurfs()])
      .then(([g, t]) => {
        setGames(g);
        setTurfs(t);
      })
      .catch(() => setFailed(true));
  }, []);

  const turfCityById = new Map<string, string>();
  (turfs || []).forEach((t) => t.city && turfCityById.set(t.id, t.city));
  const turfCityByName = new Map<string, string>();
  (turfs || []).forEach((t) => t.city && turfCityByName.set(t.name.toLowerCase(), t.city));

  const cityOf = (g: OpenGame): string | undefined => {
    if (g.turf_id && turfCityById.has(g.turf_id)) return turfCityById.get(g.turf_id);
    if (g.venue && turfCityByName.has(g.venue.toLowerCase())) return turfCityByName.get(g.venue.toLowerCase());
    return undefined;
  };

  const cityGames = (games || []).filter((g) => {
    const c = cityOf(g);
    return c && slugify(c) === slugify(cityParam);
  });
  const filtered = sportParam
    ? cityGames.filter((g) => slugify(g.sport) === slugify(sportParam))
    : cityGames;

  const known = games !== null && turfs !== null && !failed;
  const exists = known && cityGames.length > 0 && (!sportParam || filtered.length > 0);

  // A sport page for a city with venues but no open games is still useful if
  // the city exists — but we only INDEX pages that show actual games.
  const cityHasVenues = (turfs || []).some(
    (t) => t.city && slugify(t.city) === slugify(cityParam)
  );
  const label = sportParam
    ? `${sportParam.charAt(0).toUpperCase() + sportParam.slice(1)} open games`
    : "Open games";
  const path = sportParam
    ? `/open-games/${slugify(cityParam)}/${slugify(sportParam)}`
    : `/open-games/${slugify(cityParam)}`;

  useSeo(
    !known
      ? null
      : exists
        ? {
            title: `${label} in ${cityParam} — Join & Split Court Costs | ${SITE_NAME}`,
            description: `${filtered.length} open ${sportParam ? `${sportParam.toLowerCase()} ` : ""}game${filtered.length === 1 ? "" : "s"} in ${cityParam}. Join a slot, meet players and pay your share of the court instead of the full fee.`,
            path,
            jsonLd: [
              breadcrumbJsonLd([
                { name: "Home", path: "/" },
                { name: "Open Games", path: "/open-games" },
                ...(sportParam
                  ? [
                      { name: cityParam, path: `/open-games/${slugify(cityParam)}` },
                      { name: sportParam, path },
                    ]
                  : [{ name: cityParam, path }]),
              ]),
            ],
          }
        : {
            title: `${label} in ${cityParam} | ${SITE_NAME}`,
            description: "No open games here right now.",
            path,
            noindex: true,
          }
  );

  if (!known) {
    return (
      <SeoPageShell>
        <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Open Games", path: "/open-games" }]} />
        <p className="px-4 py-10 text-sm text-soft">Loading games…</p>
      </SeoPageShell>
    );
  }

  if (!exists) {
    return (
      <SeoPageShell>
        <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Open Games", path: "/open-games" }]} />
        <EmptySeoState
          message={
            cityHasVenues
              ? `No open games are running in ${cityParam}${sportParam ? ` for ${sportParam}` : ""} right now — check back soon or browse all games.`
              : `No open games or venues are listed in ${cityParam} yet.`
          }
          backTo="/open-games"
          backLabel="All open games"
        />
      </SeoPageShell>
    );
  }

  return (
    <SeoPageShell>
      <Breadcrumbs
        crumbs={[
          { name: "Home", path: "/" },
          { name: "Open Games", path: "/open-games" },
          ...(sportParam
            ? [
                { name: cityParam, path: `/open-games/${slugify(cityParam)}` },
                { name: sportParam, path },
              ]
            : [{ name: cityParam, path }]),
        ]}
      />
      <h1 className="px-4 mt-3 font-display font-extrabold text-2xl text-foreground">
        {label} in {cityParam}
      </h1>
      <p className="px-4 mt-2 text-sm text-soft max-w-xl">
        {filtered.length} open {filtered.length === 1 ? "game" : "games"} — hosts open a slot, players join,
        and everyone pays their share of the court fee instead of the full booking.
      </p>

      <div className="px-4 mt-5 space-y-4">
        {filtered.map((game) => (
          <GameSummaryCard key={game.id} game={game} />
        ))}
      </div>

      <p className="px-4 mt-8 text-xs text-soft">
        <Link to="/open-games" className="text-primary underline underline-offset-2">
          Browse all open games
        </Link>
        {" · "}
        <Link to="/turfs" className="text-primary underline underline-offset-2">
          Browse turfs by city
        </Link>
      </p>
    </SeoPageShell>
  );
}
