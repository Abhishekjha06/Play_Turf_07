import { useMemo, useState, useEffect, useRef } from "react";
import { LocateFixed, MapPin, ChevronDown, X } from "lucide-react";
import type { Turf } from "@/data/seed";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";
import { AnimatePresence, motion } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────────
   LocationPill — compact trigger shown inline in the category row.
   Clicking opens the full LocationSheet in the middle of the screen.
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
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";
  const sheetRef = useRef<HTMLDivElement>(null);

  const hasFilter = !!(city || area);
  const label = area || city || "Location";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative shrink-0 flex flex-col items-center" style={{ width: "72px", minWidth: "64px" }}>
      {/* ── Pill button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open location filter"
        className="pressable flex flex-col items-center w-full bg-transparent border-none outline-none cursor-pointer"
      >
        <div
          className="h-14 w-14 rounded-full grid place-items-center relative"
          style={
            isPremium
              ? {
                background: hasFilter ? "#14B8B0" : "#FFFFFF",
                border: hasFilter ? "2px solid #0D9488" : "1px solid #E2E8F0",
                boxShadow: hasFilter
                  ? "0 4px 14px rgba(20,184,176,0.35)"
                  : "0 4px 14px rgba(15,23,42,0.08)",
                transition: "all 0.2s ease",
              }
              : {
                background: hasFilter
                  ? "hsl(var(--primary))"
                  : "hsl(var(--panel-2))",
                border: "1px solid hsl(var(--primary) / 0.40)",
                boxShadow: "0 0 18px rgba(198,248,6,0.18)",
                transition: "all 0.2s ease",
              }
          }
        >
          <MapPin
            className="h-6 w-6"
            style={{
              color: isPremium
                ? hasFilter ? "white" : "#14B8B0"
                : hasFilter ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))",
            }}
          />
          {/* active dot */}
          {hasFilter && !isPremium && (
            <span
              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary border-2"
              style={{ borderColor: "hsl(var(--panel-2))" }}
            />
          )}
        </div>
        <span
          className="mt-1 text-center leading-tight line-clamp-1 w-full"
          style={{
            fontSize: "11px",
            color: isPremium
              ? hasFilter ? "#14B8B0" : "#64748B"
              : hasFilter ? "hsl(var(--primary))" : "hsl(var(--foreground-soft))",
            fontWeight: hasFilter ? 700 : 500,
            maxWidth: "70px",
          }}
        >
          {label}
        </span>
      </button>

      {/* ── Drop-down sheet centered in viewport ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40"
              style={{
                background: "rgba(0, 0, 0, 0.45)",
                maxWidth: "480px",
                left: "50%",
                transform: "translateX(-50%)"
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />

            {/* Sheet - Centered layout */}
            <motion.div
              ref={sheetRef}
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[448px]"
              style={{ x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              <LocationSheet
                turfs={turfs}
                city={city}
                area={area}
                locating={locating}
                onCity={onCity}
                onArea={onArea}
                onNearMe={() => { onNearMe(); setOpen(false); }}
                onClose={() => setOpen(false)}
                isPremium={isPremium}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   LocationSheet — the full filter panel that slides up
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
  isPremium,
}: {
  turfs: Turf[];
  city: string;
  area: string;
  locating: boolean;
  onCity: (city: string) => void;
  onArea: (area: string) => void;
  onNearMe: () => void;
  onClose: () => void;
  isPremium: boolean;
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

  const sheetStyle = isPremium
    ? {
      background: "#FFFFFF",
      borderRadius: "12px",
      border: "1px solid #E2E8F0",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      padding: "16px",
    }
    : {
      background: "var(--card-bg, hsl(var(--panel)))",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
      padding: "16px",
    };

  const inputStyle = isPremium
    ? {
      background: "#F8FAFC",
      border: "1px solid #E2E8F0",
      color: "#0F172A",
      borderRadius: "12px",
      height: "44px",
      paddingLeft: "12px",
      paddingRight: "12px",
      fontSize: "14px",
      fontWeight: 500,
      outline: "none",
      width: "100%",
    }
    : {
      background: "hsl(var(--panel-2))",
      border: "1px solid hsl(var(--border))",
      color: "hsl(var(--foreground))",
      borderRadius: "12px",
      height: "44px",
      paddingLeft: "12px",
      paddingRight: "12px",
      fontSize: "14px",
      fontWeight: 500,
      outline: "none",
      width: "100%",
    };

  return (
    <div style={sheetStyle}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin
            className="h-4 w-4"
            style={{ color: isPremium ? "#14B8B0" : "hsl(var(--primary))" }}
          />
          <span
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: isPremium ? "#0F172A" : "hsl(var(--foreground))",
            }}
          >
            Filter by Location
          </span>
        </div>
        <button
          onClick={onClose}
          className="pressable h-7 w-7 rounded-full grid place-items-center cursor-pointer border-none"
          style={{
            background: isPremium ? "#F1F5F9" : "hsl(var(--panel-2))",
          }}
          aria-label="Close"
        >
          <X
            className="h-4 w-4"
            style={{ color: isPremium ? "#64748B" : "hsl(var(--foreground-soft))" }}
          />
        </button>
      </div>

      {/* City selector */}
      <div className="relative mb-3">
        <MapPin
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
          style={{ color: isPremium ? "#14B8B0" : "hsl(var(--primary))" }}
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
          background: isPremium ? "#14B8B0" : "hsl(var(--primary))",
          color: isPremium ? "white" : "hsl(var(--primary-foreground))",
          boxShadow: isPremium
            ? "0 4px 14px rgba(20,184,176,0.30)"
            : "var(--shadow-neon)",
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

      {/* Clear filters */}
      {(city || area) && (
        <button
          className="pressable mt-3 w-full text-center text-xs font-semibold rounded-xl py-2.5 cursor-pointer"
          style={{
            background: isPremium ? "#FEF2F2" : "hsl(var(--destructive) / 0.10)",
            color: isPremium ? "#EF4444" : "hsl(var(--destructive))",
            border: isPremium ? "1px solid #FECACA" : "1px solid hsl(var(--destructive) / 0.25)",
          }}
          onClick={() => { onCity(""); onArea(""); }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Legacy LocationFilter — kept for backward compat if needed elsewhere
 ───────────────────────────────────────────────────────────────────── */
export function LocationFilter({
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
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";

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

  if (isPremium) {
    return (
      <section className="mt-3 px-4">
        <div
          className="grid gap-2 rounded-2xl p-3"
          style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 16px rgba(15,23,42,0.05)" }}
        >
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label
              className="flex h-11 items-center gap-2 rounded-xl px-3"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
            >
              <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: "#14B8B0" }} />
              <select
                value={city}
                onChange={(e) => onCity(e.target.value)}
                className="min-w-0 flex-1 rounded-lg px-2 py-1 text-sm font-semibold outline-none"
                style={{ background: "transparent", color: "#0F172A" }}
              >
                <option value="">All cities</option>
                {cities.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onNearMe}
              disabled={locating}
              className="pressable inline-flex h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold disabled:opacity-60 cursor-pointer border-none"
              style={{ background: "#14B8B0", color: "white", boxShadow: "0 4px 14px rgba(20,184,176,0.30)" }}
            >
              <LocateFixed className="h-4 w-4" />
              {locating ? "Locating..." : "Near Me"}
            </button>
          </div>
          <select
            value={area}
            onChange={(e) => onArea(e.target.value)}
            className="h-11 rounded-xl px-3 text-sm font-semibold outline-none"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F172A" }}
          >
            <option value="">All areas</option>
            {areas.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-3 px-4">
      <div className="glass-strong grid gap-2 rounded-2xl p-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-panel px-3">
            <MapPin className="h-4 w-4 text-primary" />
            <select
              value={city}
              onChange={(event) => onCity(event.target.value)}
              className="min-w-0 flex-1 rounded-lg bg-panel-2 px-2 py-1 text-sm font-semibold text-foreground outline-none"
            >
              <option className="bg-card text-foreground" value="">All cities</option>
              {cities.map((item) => (
                <option className="bg-card text-foreground" key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onNearMe}
            disabled={locating}
            className="pressable inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-neon disabled:opacity-60 cursor-pointer border-none"
          >
            <LocateFixed className="h-4 w-4" />
            {locating ? "Locating..." : "Near Me"}
          </button>
        </div>
        <select
          value={area}
          onChange={(event) => onArea(event.target.value)}
          className="h-11 rounded-xl border border-border bg-panel-2 px-3 text-sm font-semibold text-foreground outline-none"
        >
          <option className="bg-card text-foreground" value="">All areas</option>
          {areas.map((item) => (
            <option className="bg-card text-foreground" key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
    </section>
  );
}
