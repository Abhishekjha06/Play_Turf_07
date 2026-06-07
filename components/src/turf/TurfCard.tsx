import { motion } from "framer-motion";
import { Heart, Star, Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { Turf } from "@/data/seed";
import React, { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardTitle, CardDescription, CardFooter } from "@/ui/Card";
import { toast } from "sonner";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";
import { cardLift, cardLiftDark, ease } from "@/lib/motion";

export function TurfCard({
  turf,
  index = 0,
  userLocation,
}: {
  turf: Turf;
  index?: number;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const [fav, setFav] = useState(false);
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";
  const km = userLocation ? api.distanceKm(userLocation, turf) : null;

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    api.listFavorites().then((favorites) => setFav(favorites.includes(turf.id)));
  }, [turf.id]);

  const toggleFav = async (e: React.MouseEvent) => {
    e.preventDefault();
    const next = await api.toggleFavorite(turf.id);
    const active = next.includes(turf.id);
    setFav(active);
    toast.success(active ? "Added to favorites" : "Removed from favorites");
  };

  const enterVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.38,
        delay: Math.min(index, 6) * 0.07,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    },
  };

  if (isPremium) {
    return (
      <motion.div
        variants={prefersReducedMotion ? {} : enterVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        whileHover={prefersReducedMotion ? {} : "hover"}
        whileTap={prefersReducedMotion ? {} : "tap"}
        animate="rest"
        // @ts-expect-error — framer accepts object spread
        {...(!prefersReducedMotion && { variants: { ...enterVariants, ...cardLift } })}
        data-testid={`turf-card-${turf.id}`}
        className="flex h-full"
        style={{ willChange: "transform" }}
      >
        <div
          className="flex flex-col w-full overflow-hidden"
          style={{
            background: "#FFFFFF",
            borderRadius: "20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 8px 30px rgba(15,23,42,0.08)",
          }}
        >
          {/* Image with zoom on card hover */}
          <div className="relative overflow-hidden flex-shrink-0" style={{ height: "140px" }}>
            <motion.img
              src={turf.image}
              alt={turf.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
              transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
            />
            <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/40 to-transparent" />

            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={toggleFav}
              aria-label="Favourite"
              className="absolute top-2.5 right-2.5 h-8 w-8 grid place-items-center rounded-full"
              style={{ background: "rgba(255,255,255,0.92)", border: "1px solid #E2E8F0" }}
              data-testid={`fav-${turf.id}`}
            >
              <motion.div
                animate={fav ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Heart
                  className="h-4 w-4"
                  style={{ color: fav ? "#EF4444" : "#94A3B8", fill: fav ? "#EF4444" : "none" }}
                />
              </motion.div>
            </motion.button>

            <div
              className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.92)", border: "1px solid #E2E8F0" }}
            >
              <Star className="h-3 w-3" style={{ color: "#F59E0B", fill: "#F59E0B" }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#0F172A" }}>
                {turf.rating}
              </span>
            </div>

            {km !== null && Number.isFinite(km) && (
              <div
                className="absolute bottom-2.5 right-2.5 rounded-full px-2 py-0.5"
                style={{ background: "rgba(255,255,255,0.92)", border: "1px solid #E2E8F0" }}
              >
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#64748B" }}>
                  {km.toFixed(1)} km
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col flex-1 p-3 gap-1.5">
            <h3 className="line-clamp-1 font-semibold" style={{ fontSize: "15px", color: "#0F172A" }}>
              {turf.name}
            </h3>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 flex-shrink-0" style={{ color: "#14B8B0" }} />
              <p className="line-clamp-1" style={{ fontSize: "12px", color: "#64748B" }}>
                {turf.address}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
              <span className="line-clamp-1" style={{ fontSize: "11px", color: "#94A3B8" }}>
                {turf.timing}
              </span>
            </div>
            <div className="flex items-center justify-between mt-auto pt-1">
              <p>
                <span style={{ fontWeight: 700, color: "#14B8B0", fontSize: "15px" }}>
                  ₹{turf.price_per_hour}
                </span>
                <span style={{ fontSize: "11px", color: "#94A3B8" }}>/hr</span>
              </p>
            </div>
          </div>

          <div className="px-3 pb-3 pt-0">
            <RippleButton
              to={`/turf/${turf.id}`}
              testid={`book-${turf.id}`}
              style={{
                background: "#14B8B0",
                color: "white",
                boxShadow: "0 4px 14px rgba(20,184,176,0.30)",
              }}
            >
              Book Now
            </RippleButton>
          </div>
        </div>
      </motion.div>
    );
  }

  // Legacy (dark themes)
  return (
    <motion.div
      variants={prefersReducedMotion ? {} : enterVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      whileHover={prefersReducedMotion ? {} : { y: -6, boxShadow: "0 20px 48px rgba(0,0,0,0.50)" }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.975, y: -2 }}
      transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
      data-testid={`turf-card-${turf.id}`}
      className="flex h-full"
      style={{ willChange: "transform" }}
    >
      <Card className="flex flex-col w-full" hoverable bordered compact={false}>
        <div className="relative aspect-[4/3] rounded-t-2xl overflow-hidden shrink-0">
          <motion.img
            src={turf.image}
            alt={turf.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
            transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
          />
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent" />
          <motion.button
            whileTap={{ scale: 0.82 }}
            onClick={toggleFav}
            aria-label="Favourite"
            className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-full glass"
            data-testid={`fav-${turf.id}`}
          >
            <motion.div
              animate={fav ? { scale: [1, 1.4, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Heart className={`h-4 w-4 ${fav ? "fill-primary text-primary" : "text-white"}`} />
            </motion.div>
          </motion.button>
          <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full glass text-[11px]">
            <Star className="h-3 w-3 fill-primary text-primary" /> {turf.rating}
          </div>
          {km !== null && Number.isFinite(km) && (
            <div className="absolute bottom-2 right-2 rounded-full glass px-2 py-0.5 text-[11px] font-semibold">
              {km.toFixed(1)} km
            </div>
          )}
        </div>
        <CardContent padding="sm" removeTopPadding={false} className="flex-1 flex flex-col gap-2">
          <div>
            <CardTitle size="sm" as="h3" className="line-clamp-1">{turf.name}</CardTitle>
            <CardDescription size="xs" className="line-clamp-1 mt-0.5">{turf.address}</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-soft">
            <Clock className="h-3 w-3" />{" "}
            <span className="line-clamp-1">{turf.timing}</span>
          </div>
          <div className="flex items-center justify-between mt-auto pt-1">
            <p className="text-sm">
              <span className="font-bold neon-text">₹{turf.price_per_hour}</span>
              <span className="text-muted2 text-[11px]">/hr</span>
            </p>
          </div>
        </CardContent>
        <CardFooter padding="sm" className="px-4 pb-4 pt-0">
          <Link
            to={`/turf/${turf.id}`}
            className="w-full text-center bg-primary text-primary-foreground font-semibold rounded-full py-2 text-xs shadow-neon pressable"
            data-testid={`book-${turf.id}`}
          >
            Book Now
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

/** Ripple button — shows expanding circle on tap */
function RippleButton({
  to,
  children,
  testid,
  style,
}: {
  to: string;
  children: React.ReactNode;
  testid: string;
  style?: React.CSSProperties;
}) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const ref = useRef<HTMLAnchorElement>(null);

  const handleTap = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples((r) => [...r, { id, x, y }]);
    setTimeout(() => setRipples((r) => r.filter((rr) => rr.id !== id)), 600);
  };

  return (
    <Link
      ref={ref}
      to={to}
      onClick={handleTap}
      className="relative w-full block text-center font-semibold rounded-full py-2 text-xs overflow-hidden"
      style={style}
      data-testid={testid}
    >
      {ripples.map(({ id, x, y }) => (
        <span
          key={id}
          className="absolute rounded-full bg-white/30 pointer-events-none animate-ripple"
          style={{
            width: 32,
            height: 32,
            left: x - 16,
            top: y - 16,
            transformOrigin: "center",
          }}
        />
      ))}
      {children}
    </Link>
  );
}

export default React.memo(TurfCard);
