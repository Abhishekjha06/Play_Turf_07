import { Link } from "react-router-dom";
import type { Turf } from "@/data/seed";
import { api } from "@/lib/api";
import { Card, CardContent, CardTitle, CardDescription } from "@/ui/card";

export function CompactTurfCard({
  turf,
  userLocation,
}: {
  turf: Turf;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const km = userLocation ? api.distanceKm(userLocation, turf) : null;

  return (
      <Link
        to={`/turf/${turf.id}`}
        className="shrink-0 w-[40vw] max-w-40 pressable"
        data-testid={`compact-turf-${turf.id}`}
      >
        <div
          className="flex flex-col overflow-hidden"
          style={{
            background: "hsl(var(--color-surface-elevated))",
            borderRadius: "var(--radius-2xl)",
            border: "1px solid hsl(var(--color-border-default))",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            className="relative overflow-hidden flex-shrink-0"
            style={{ height: "110px", borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0" }}
          >
            <img
              src={turf.image}
              alt={turf.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="p-2.5 flex flex-col gap-0.5">
            <p
              className="line-clamp-1 font-semibold text-xs"
              style={{ color: "hsl(var(--color-text-primary))" }}
            >
              {turf.name}
            </p>
            <p
              className="line-clamp-1 text-xs"
              style={{ color: "hsl(var(--color-text-secondary))" }}
            >
              {turf.address}
            </p>
            {km !== null && Number.isFinite(km) && (
              <p className="text-xs mt-0.5" style={{ color: "hsl(var(--color-text-tertiary))" }}>
                {km.toFixed(1)} km away
              </p>
            )}
            <p className="text-xs mt-1">
              <span style={{ fontWeight: 700, color: "hsl(var(--color-primary))" }}>₹{turf.price_per_hour}</span>
              <span className="text-xs" style={{ color: "hsl(var(--color-text-tertiary))" }}>/hr</span>
            </p>
          </div>
        </div>
      </Link>
  );
}
