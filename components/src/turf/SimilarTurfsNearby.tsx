import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, MapPin, AlertCircle, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { turfPath } from "@/lib/seo";
import type { Turf } from "@/data/seed";
import type { RecommendationResponse, SimilarTurfRecommendation } from "@/lib/recommendation";

type SectionState =
  | { status: "loading" }
  | { status: "ready"; data: RecommendationResponse }
  | { status: "empty" }
  | { status: "error" };

/**
 * "Similar Turfs Nearby" — Recommendation Engine V1 (Phase 15).
 * Cards show only grounded data: the engine's explanations arrive pre-filtered,
 * ratings render only when real reviews exist, and distance is always labelled
 * as approximate (haversine, not driving distance).
 */
export function SimilarTurfsNearby({
  currentTurf,
  selectedSport,
}: {
  currentTurf: Turf;
  selectedSport?: string | null;
}) {
  const [state, setState] = useState<SectionState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api
      .getSimilarTurfs(currentTurf.id, { selectedSport })
      .then((data) => {
        if (cancelled) return;
        setState(
          data.recommendations.length > 0
            ? { status: "ready", data }
            : { status: "empty" }
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [currentTurf.id, selectedSport, reloadKey]);

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">Similar Turfs Nearby</h3>
          <p className="text-xs text-foreground mt-0.5">
            Explore other turfs that match your sports and budget.
          </p>
        </div>
        {state.status === "ready" && (
          <span className="shrink-0 text-[11px] text-muted2">
            {state.data.metadata.expanded_from_km
              ? `within ${state.data.metadata.radius_km_used} km`
              : `within ${state.data.metadata.radius_km_used} km`}
          </span>
        )}
      </div>

      {state.status === "loading" && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar mt-3 pb-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-56 shrink-0 rounded-2xl bg-panel-2 border border-white/5 overflow-hidden animate-pulse">
              <div className="h-28 bg-panel-2" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/5" />
                <div className="h-3 w-2/3 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-3 rounded-2xl bg-panel-2 border border-white/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-muted2 shrink-0" />
          <p className="text-xs text-soft flex-1">Couldn&apos;t load recommendations right now.</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="pressable shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "empty" && (
        <p className="mt-3 text-xs text-muted2">
          No similar turfs found nearby yet. Check back soon — new venues are added regularly.
        </p>
      )}

      {state.status === "ready" && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar mt-3 pb-1">
          {state.data.recommendations.map((rec) => (
            <RecommendationCard key={rec.turf_id} rec={rec} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecommendationCard({ rec }: { rec: SimilarTurfRecommendation }) {
  const shownSports = rec.sport_types.slice(0, 2);
  const extraSports = rec.sport_types.length - shownSports.length;

  return (
    <Link
      to={turfPath({ id: rec.turf_id, name: rec.name, city: rec.city } as Turf)}
      className="w-56 shrink-0 card-panel rounded-2xl overflow-hidden pressable"
      data-testid={`similar-turf-${rec.turf_id}`}
    >
      <div className="relative">
        <img
          src={rec.image}
          alt={rec.name}
          loading="lazy"
          decoding="async"
          className="h-28 w-full object-cover"
        />
      </div>

      <div className="p-3">
        <p className="font-semibold text-sm truncate">{rec.name}</p>

        <p className="text-xs text-soft mt-1 inline-flex items-center gap-1">
          <MapPin className="h-3 w-3 text-primary shrink-0" />
          <span>approx. {rec.distance_km} km · {rec.city}</span>
        </p>

        <p className="text-xs text-soft mt-1 truncate">
          {shownSports.join(", ")}
          {extraSports > 0 ? ` +${extraSports}` : ""}
        </p>

        <div className="flex items-center justify-between gap-2 mt-2">
          {rec.rating != null && rec.review_count > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-foreground">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              {rec.rating.toFixed(1)}
              <span className="text-muted2">({rec.review_count})</span>
            </span>
          ) : (
            <span className="text-xs text-muted2">New venue</span>
          )}
          {rec.price_per_hour != null && (
            <span className="text-xs font-bold text-foreground">
              ₹{rec.price_per_hour.toLocaleString("en-IN")}
              <span className="text-muted2 font-medium">/hr</span>
            </span>
          )}
        </div>

        <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-primary">
          View Details <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
