import { Link } from "react-router-dom";
import type { Turf } from "@/data/seed";
import { api } from "@/lib/api";
import { Card, CardContent, CardTitle, CardDescription } from "@/ui/Card";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";

export function CompactTurfCard({
  turf,
  userLocation,
}: {
  turf: Turf;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const km = userLocation ? api.distanceKm(userLocation, turf) : null;
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";

  if (isPremium) {
    return (
      <Link
        to={`/turf/${turf.id}`}
        className="shrink-0 w-[40vw] max-w-40 pressable"
        data-testid={`compact-turf-${turf.id}`}
      >
        <div
          className="flex flex-col overflow-hidden"
          style={{
            background: "#FFFFFF",
            borderRadius: "20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 8px 30px rgba(15,23,42,0.08)",
          }}
        >
          <div
            className="relative overflow-hidden flex-shrink-0"
            style={{ height: "110px", borderRadius: "20px 20px 0 0" }}
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
              className="line-clamp-1 font-semibold"
              style={{ fontSize: "12px", color: "#0F172A" }}
            >
              {turf.name}
            </p>
            <p
              className="line-clamp-1"
              style={{ fontSize: "11px", color: "#64748B" }}
            >
              {turf.address}
            </p>
            {km !== null && Number.isFinite(km) && (
              <p style={{ fontSize: "10px", color: "#94A3B8", marginTop: "2px" }}>
                {km.toFixed(1)} km away
              </p>
            )}
            <p style={{ fontSize: "12px", marginTop: "4px" }}>
              <span style={{ fontWeight: 700, color: "#14B8B0" }}>₹{turf.price_per_hour}</span>
              <span style={{ color: "#94A3B8", fontSize: "10px" }}>/hr</span>
            </p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/turf/${turf.id}`}
      className="shrink-0 w-[40vw] max-w-40 pressable"
      data-testid={`compact-turf-${turf.id}`}
    >
      <Card compact hoverable bordered className="h-full flex flex-col p-0">
        <div className="relative aspect-[4/3] rounded-t-2xl overflow-hidden shrink-0">
          <img
            src={turf.image}
            alt={turf.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <CardContent padding="none" className="p-2.5 flex-1 flex flex-col">
          <CardTitle size="sm" as="h4" className="text-xs line-clamp-1">
            {turf.name}
          </CardTitle>
          <CardDescription size="xs" className="text-[11px] line-clamp-1">
            {turf.address}
          </CardDescription>
          {km !== null && Number.isFinite(km) && (
            <p className="mt-1 text-[11px] text-soft">{km.toFixed(1)} km away</p>
          )}
          <p className="text-[12px] mt-auto pt-1">
            <span className="neon-text font-bold">₹{turf.price_per_hour}</span>
            <span className="text-muted2">/hr</span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
