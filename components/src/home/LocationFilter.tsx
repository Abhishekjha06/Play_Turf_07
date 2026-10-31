import { useMemo, useState } from "react";
import { LocateFixed, MapPin, X } from "lucide-react";
import type { Turf } from "@/data/seed";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/ui/sheet";

/* ─────────────────────────────────────────────────────────────────────
   LocationPill — compact trigger shown inline in the category row.
   Clicking opens the full LocationSheet in the middle of the screen.
   ONE shared UI: all colors come from theme tokens.
 ───────────────────────────────────────────────────────────────────── */
export function LocationPill({
  turfs,
  city,
  area,
  locating,
  onCity,
  onArea,
  onNearMe,
}: {
  turfs: Turf[];
  city: string;
  area: string;
  locating: boolean;
  onCity: (city: string) => void;
  onArea: (area: string) => void;
  onNearMe: () => void;
}) {
  const [open, setOpen] = useState(false);

  const hasFilter = !!(city || area);
  const label = area || city || "Location";

  return (
    <div className="relative shrink-0 flex flex-col items-center" style={{ width: "72px", minWidth: "64px" }}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {/* ── Pill button ── */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Open location filter"
            className="pressable flex flex-col items-center w-full bg-transparent border-none outline-none cursor-pointer"
          >
            <div
              className="h-14 w-14 rounded-full grid place-items-center relative"
              style={{
                background: hasFilter ? "hsl(var(--primary))" : "hsl(var(--card))",
                border: hasFilter ? "1px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
                boxShadow: hasFilter ? "0 4px 14px hsl(var(--primary) / 0.35)" : "var(--shadow-card)",
                transition: "all 0.2s ease",
              }}
            >
              <MapPin
                className="h-6 w-6"
                style={{
                  color: hasFilter ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))",
                }}
              />
              {/* active dot */}
              {hasFilter && (
                <span
                  className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary border-2"
                  style={{ borderColor: "hsl(var(--card))" }}
                />
              )}
            </div>
            <span
              className="mt-1 text-center leading-tight line-clamp-1 w-full"
              style={{
                color: hasFilter ? "hsl(var(--primary))" : "hsl(var(--foreground-soft))",
                fontWeight: hasFilter ? 700 : 500,
                maxWidth: "70px",
              }}
            >
              {label}
            </span>
          </button>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          className="bg-transparent border-t-0 p-0 max-w-[448px] mx-auto shadow-none overflow-hidden [&>button]:hidden"
        >
          <SheetTitle className="sr-only">Filter by Location</SheetTitle>
          <LocationSheet
            turfs={turfs}
            city={city}
            area={area}
            locating={locating}
            onCity={onCity}
            onArea={onArea}
            onNearMe={() => { onNearMe(); setOpen(false); }}
            onClose={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   LocationSheet — the full filter panel that slides up.
   All colors from tokens; "Clear filters" uses the semantic danger role.
 ───────────────────────────────────────────────────────────────────── */
function LocationSheet({
  turfs,
  city,
  area,
  locating,
  onCity,
  onArea,
  onNearMe,
  onClose,
}: {
  turfs: Turf[];
  city: string;
  area: string;
  locating: boolean;
  onCity: (city: string) => void;
  onArea: (area: string) => void;
  onNearMe: () => void;
  onClose: () => void;
}) {
  const cities = useMemo(
    () => Array.from(new Set(turfs.map((t) => t.city))).sort(),
    [turfs]
  );
  const areas = useMemo(
    () =>
      Array.from(
        new Set(
          turfs
            .filter((t) => !city || t.city === city)
            .map((t) => t.address.split(",")[0]?.trim())
            .filter(Boolean)
        )
      ).sort(),
    [turfs, city]
  );

  const sheetStyle = {
    background: "hsl(var(--card))",
    borderRadius: "12px",
    border: "1px solid hsl(var(--border))",
    boxShadow: "var(--shadow-card)",
    padding: "16px",
  };

  const inputStyle = {
    background: "hsl(var(--panel-2))",
    border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))",
    borderRadius: "12px",
    height: "44px",
    paddingLeft: "12px",
    paddingRight: "12px",
    fontWeight: 500,
    outline: "none",
    width: "100%",
  } as const;

  return (
    <div style={sheetStyle}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
          <span style={{ fontWeight: 700, color: "hsl(var(--foreground))" }}>
            Filter by Location
          </span>
        </div>
        <button
          onClick={onClose}
          className="pressable h-7 w-7 rounded-full grid place-items-center cursor-pointer border-none"
          style={{ background: "hsl(var(--panel-2))" }}
          aria-label="Close"
        >
          <X className="h-4 w-4" style={{ color: "hsl(var(--foreground-soft))" }} />
        </button>
      </div>

      {/* City selector */}
      <div className="relative mb-3">
        <MapPin
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
          style={{ color: "hsl(var(--primary))" }}
        />
        <select
          value={city}
          onChange={(e) => onCity(e.target.value)}
          style={{ ...inputStyle, paddingLeft: "36px" }}
        >
          <option value="">All cities</option>
          {cities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {/* Use My Current Location Button */}
      <button
        type="button"
        onClick={onNearMe}
        disabled={locating}
        className="pressable w-full flex items-center justify-center gap-2 rounded-xl mb-3 text-xs font-bold disabled:opacity-60 cursor-pointer border-none"
        style={{
          height: "44px",
          background: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          boxShadow: "var(--shadow-neon)",
        }}
      >
        <LocateFixed className="h-4 w-4" />
        {locating ? "Locating…" : "Use My Current Location"}
      </button>

      {/* Area */}
      <select
        value={area}
        onChange={(e) => onArea(e.target.value)}
        style={inputStyle}
      >
        <option value="">All areas</option>
        {areas.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      {/* Clear filters — semantic danger role */}
      {(city || area) && (
        <button
          className="pressable mt-3 w-full text-center text-xs font-semibold rounded-xl py-2.5 cursor-pointer"
          style={{
            background: "hsl(var(--color-danger-surface))",
            color: "hsl(var(--danger))",
            border: "1px solid hsl(var(--danger) / 0.25)",
          }}
          onClick={() => { onCity(""); onArea(""); }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
