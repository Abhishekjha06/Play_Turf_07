/**
 * Shared building blocks for the SEO landing pages.
 *
 * Anti-doorway rule used by every page here: if the URL parameter does not
 * resolve to real venue data, the page renders a noindex "nothing here"
 * state with links back into the site — never fake content for bots.
 */
import { Link } from "react-router-dom";
import { MapPin, IndianRupee, Trophy, Clock } from "lucide-react";
import type { Turf } from "@/data/seed";
import { SITE_NAME, turfPath } from "@/lib/seo";

export function Breadcrumbs({ crumbs }: { crumbs: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="px-4 pt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-soft">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.path} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {last ? (
              <span aria-current="page" className="text-foreground font-semibold">{c.name}</span>
            ) : (
              <Link to={c.path} className="hover:text-foreground">{c.name}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/** Answer-first factual summary (AEO): only real aggregates. */
export function QuickFacts({
  count,
  sports,
  priceMin,
  priceMax,
  timing,
}: {
  count: number;
  sports: string[];
  priceMin?: number;
  priceMax?: number;
  timing?: string;
}) {
  const priceLabel =
    priceMin != null && priceMax != null
      ? priceMin === priceMax
        ? `₹${priceMin}/hour`
        : `₹${priceMin}–₹${priceMax}/hour`
      : undefined;

  return (
    <section
      aria-label="Quick facts"
      className="mx-4 mt-4 rounded-2xl border border-[hsl(var(--color-border-default))] bg-panel-2 p-4"
    >
      <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-muted2 mb-2.5">Quick facts</h2>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted2 flex items-center gap-1"><MapPin className="h-3 w-3" /> Venues</dt>
          <dd className="font-bold text-foreground mt-0.5">{count} listed {count === 1 ? "turf" : "turfs"}</dd>
        </div>
        <div>
          <dt className="text-muted2 flex items-center gap-1"><Trophy className="h-3 w-3" /> Sports</dt>
          <dd className="font-bold text-foreground mt-0.5">{sports.slice(0, 4).join(", ") || "—"}</dd>
        </div>
        {priceLabel && (
          <div>
            <dt className="text-muted2 flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Price range</dt>
            <dd className="font-bold text-foreground mt-0.5">{priceLabel}</dd>
          </div>
        )}
        {timing && (
          <div>
            <dt className="text-muted2 flex items-center gap-1"><Clock className="h-3 w-3" /> Typical hours</dt>
            <dd className="font-bold text-foreground mt-0.5">{timing}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export function VenueGrid({ turfs }: { turfs: Turf[] }) {
  return (
    <div className="px-4 mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {turfs.map((t) => (
        <Link
          key={t.id}
          to={turfPath(t)}
          className="pressable flex gap-3 rounded-2xl border border-[hsl(var(--color-border-default))] bg-panel p-3"
        >
          <img
            src={t.image}
            alt={`${t.name} — ${t.sport_types?.[0] || "sports"} turf in ${t.city}`}
            loading="lazy"
            decoding="async"
            className="h-20 w-20 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground line-clamp-1">{t.name}</p>
            <p className="text-[11px] text-soft line-clamp-1 mt-0.5">{t.address || t.city}</p>
            <p className="text-[11px] text-soft mt-1">
              {t.sport_types?.slice(0, 3).join(" · ")}
            </p>
            <p className="text-xs font-extrabold text-primary mt-1">₹{t.price_per_hour}/hour</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function CityLinks({ cities }: { cities: { name: string; path: string; count: number }[] }) {
  return (
    <div className="px-4 mt-4 flex flex-wrap gap-2">
      {cities.map((c) => (
        <Link
          key={c.path}
          to={c.path}
          className="pressable rounded-full border border-[hsl(var(--color-border-default))] bg-panel-2 px-3.5 py-1.5 text-xs font-semibold text-foreground"
        >
          Turfs in {c.name} <span className="text-muted2">({c.count})</span>
        </Link>
      ))}
    </div>
  );
}

/** Noindex "nothing here yet" state — honest, linked, never fake content. */
export function EmptySeoState({
  message,
  backTo,
  backLabel,
}: {
  message: string;
  backTo: string;
  backLabel: string;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <h1 className="font-display font-extrabold text-xl text-foreground">Nothing here yet</h1>
      <p className="mt-2 text-sm text-soft max-w-sm mx-auto">{message}</p>
      <Link
        to={backTo}
        className="mt-6 inline-block rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-5 py-2.5"
      >
        {backLabel}
      </Link>
    </div>
  );
}

export function SeoPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground pb-24">
      <header className="px-4 pt-6">
        <Link to="/" className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted2 hover:text-primary">
          {SITE_NAME}
        </Link>
      </header>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data-derived groupings (real data only)
// ---------------------------------------------------------------------------

export function groupByCity(turfs: Turf[]) {
  const map = new Map<string, Turf[]>();
  turfs.forEach((t) => {
    const city = (t.city || "").trim();
    if (!city) return;
    const list = map.get(city) || [];
    list.push(t);
    map.set(city, list);
  });
  return map;
}

/** Obvious test/junk values in sport_types never become landing pages. */
export function isPublishableSport(sport: string): boolean {
  return /^[a-z][a-z0-9 &-]{1,30}$/i.test(sport) && !/test|demo|sample|debug/i.test(sport);
}

export function uniqueSports(turfs: Turf[]): string[] {
  const set = new Set<string>();
  turfs.forEach((t) => (t.sport_types || []).forEach((s) => s && isPublishableSport(s) && set.add(s)));
  return Array.from(set).sort();
}

export function priceRange(turfs: Turf[]) {
  if (!turfs.length) return {};
  const prices = turfs.map((t) => t.price_per_hour).filter((p) => typeof p === "number" && p > 0);
  if (!prices.length) return {};
  return { priceMin: Math.min(...prices), priceMax: Math.max(...prices) };
}
