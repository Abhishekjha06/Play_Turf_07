import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { Banner } from "@/data/seed";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { MeteorImpactBorder } from "@/app/component2/proui/meteor-impact-border";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";
import { Shimmer } from "@/ui/Shimmer";

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";

  useEffect(() => {
    const onVisibilityChange = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!banners.length || paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length, paused]);

  /* ── Skeleton while banners load ── */
  if (!banners.length) {
    return (
      <section className="px-4 mt-4">
        <Shimmer className="w-full" style={{ height: isPremium ? "240px" : "224px", borderRadius: "24px" } as React.CSSProperties} rounded="rounded-none" />
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {[0, 1, 2].map((idx) => (
            <Shimmer key={idx} className="h-1.5" style={{ width: idx === 0 ? "28px" : "6px", borderRadius: "999px" } as React.CSSProperties} rounded="rounded-full" />
          ))}
        </div>
      </section>
    );
  }

  const b = banners[i];
  const headingParts = b.title.split(b.highlight);

  if (isPremium) {
    return (
      <motion.section
        className="px-4 mt-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        data-testid="hero-carousel"
      >
        <div
          className="relative overflow-hidden"
          style={{ height: "240px", borderRadius: "24px" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={b.id}
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.65, ease: [0.25, 1, 0.5, 1] }}
              className="absolute inset-0"
            >
              {/* Background image with continuous subtle zoom */}
              <motion.img
                src={b.image}
                alt={b.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ scale: 1 }}
                animate={{ scale: 1.04 }}
                transition={{ duration: 4.5, ease: "linear" }}
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.58) 100%)" }}
              />

              {/* Badge */}
              <motion.span
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="absolute top-4 left-4 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider z-10"
                style={{ background: "rgba(20,184,176,0.85)", color: "white", backdropFilter: "blur(4px)" }}
              >
                {b.badge}
              </motion.span>

              {/* Content */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-4 left-4 right-4 z-20 flex flex-col"
              >
                <h2 className="font-extrabold leading-tight drop-shadow-lg" style={{ fontSize: "22px", color: "white" }}>
                  {headingParts[0]}
                  <span style={{ color: "#14B8B0" }}>{b.highlight}</span>
                  {headingParts[1]}
                </h2>
                <p className="mt-1 line-clamp-1 drop-shadow-md" style={{ color: "rgba(255,255,255,0.78)", fontSize: "12px" }}>
                  {b.subtitle}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <motion.div whileTap={{ scale: 0.93 }} whileHover={{ scale: 1.03 }}>
                    <Link
                      to={b.cta_link}
                      className="inline-flex items-center gap-1.5 font-bold rounded-full px-5 py-2 text-xs"
                      style={{ background: "#14B8B0", color: "white", boxShadow: "0 4px 14px rgba(20,184,176,0.40)" }}
                      data-testid="hero-cta"
                    >
                      {b.cta_text}{" "}
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </Link>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Slide dots */}
        <div className="flex items-center justify-center gap-1.5 mt-3" role="tablist">
          {banners.map((_, idx) => (
            <motion.button
              key={idx}
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setI(idx)}
              animate={{
                width: idx === i ? "28px" : "6px",
                background: idx === i ? "#14B8B0" : "#CBD5E1",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              style={{
                height: "6px",
                borderRadius: "999px",
                boxShadow: idx === i ? "0 0 8px rgba(20,184,176,0.50)" : "none",
              }}
            />
          ))}
        </div>
      </motion.section>
    );
  }

  // Legacy
  return (
    <motion.section
      className="px-4 mt-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      data-testid="hero-carousel"
    >
      <MeteorImpactBorder className="rounded-[26px] overflow-hidden">
        <div className="relative h-56 md:h-64 w-full rounded-3xl overflow-hidden card-panel">
          <AnimatePresence mode="wait">
            <motion.div
              key={b.id}
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.65, ease: [0.25, 1, 0.5, 1] }}
              className="absolute inset-0"
            >
              <motion.img
                src={b.image}
                alt={b.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ scale: 1 }}
                animate={{ scale: 1.04 }}
                transition={{ duration: 4.5, ease: "linear" }}
              />
              <div className="absolute inset-0 bg-gradient-overlay" />
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.35 }}
                className="absolute top-4 left-4 inline-flex items-center px-3 py-1 rounded-full bg-primary/15 border border-primary/45 text-primary text-[10px] font-bold uppercase tracking-wider z-10"
              >
                {b.badge}
              </motion.span>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-4 left-4 right-4 z-20 flex flex-col"
              >
                <h2 className="font-display font-extrabold text-[20px] leading-tight text-white drop-shadow-lg">
                  {headingParts[0]}
                  <span className="neon-text">{b.highlight}</span>
                  {headingParts[1]}
                </h2>
                <p className="text-white/70 text-xs mt-1 line-clamp-1 drop-shadow-md">{b.subtitle}</p>
                <div className="mt-2.5 flex items-center justify-between">
                  <motion.div whileTap={{ scale: 0.93 }} whileHover={{ scale: 1.03 }}>
                    <Link
                      to={b.cta_link}
                      className="inline-flex items-center gap-1.5 bg-gradient-neon text-primary-foreground font-bold rounded-full px-4 py-1.5 text-xs shadow-neon"
                      data-testid="hero-cta"
                    >
                      {b.cta_text}{" "}
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </Link>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </MeteorImpactBorder>

      <div className="flex items-center justify-center gap-1.5 mt-3" role="tablist">
        {banners.map((_, idx) => (
          <motion.button
            key={idx}
            aria-label={`Slide ${idx + 1}`}
            onClick={() => setI(idx)}
            animate={{
              width: idx === i ? "28px" : "6px",
              background: idx === i ? "hsl(var(--primary))" : "rgba(255,255,255,0.25)",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            style={{ height: "6px", borderRadius: "999px" }}
          />
        ))}
      </div>
    </motion.section>
  );
}
