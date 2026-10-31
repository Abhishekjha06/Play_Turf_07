import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { Banner } from "@/data/seed";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Shimmer } from "@/ui/Shimmer";

const AUTOPLAY_MS = 4500;
/** Autoplay skips a tick for this long after any manual navigation, so it never fights the user. */
const MANUAL_GRACE_MS = 8000;

/**
 * Homepage hero carousel — ONE shared UI for every theme.
 *
 * All colors come from global CSS variables injected by LuxuryThemeProvider
 * (--primary, --gradient-overlay, --gradient-neon, ...), so switching between
 * Premium Teal and AMOLED Black changes only colors — the layout, dimensions,
 * animations and behavior are identical everywhere by construction.
 *
 * Uses NATIVE CSS scroll-snap so slides can be swiped on touch and dragged
 * with the mouse, plus prev/next arrows, clickable dots and keyboard arrows.
 * Auto-sliding every 4.5s (wrapping), pausing while the tab is hidden and for
 * a grace period after the user navigated manually.
 */
export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const lastInteractionRef = useRef(0);
  const suppressClickRef = useRef(false);
  const dragState = useRef<{ startX: number; startScrollLeft: number; moved: boolean } | null>(null);

  /* ── Pause autoplay while the tab is hidden ── */
  useEffect(() => {
    const onVisibilityChange = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  /* ── Track which slide is in view (drives dots, arrows, autoplay, Ken Burns) ── */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Slides are full viewport width, so the index is simply scrollLeft / width.
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        setSelected(Math.max(0, Math.min(idx, banners.length - 1)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [banners.length]);

  /* ── Keep the selection valid if the banner list shrinks (e.g. admin deletes a slide) ── */
  useEffect(() => {
    if (selected <= banners.length - 1) return;
    setSelected(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [banners.length, selected]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      lastInteractionRef.current = Date.now();
      const clamped = Math.max(0, Math.min(index, banners.length - 1));
      el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    },
    [banners.length],
  );

  const goPrev = useCallback(
    () => scrollToIndex(selected === 0 ? banners.length - 1 : selected - 1),
    [banners.length, selected, scrollToIndex],
  );
  const goNext = useCallback(
    () => scrollToIndex(selected === banners.length - 1 ? 0 : selected + 1),
    [banners.length, selected, scrollToIndex],
  );

  /* ── Autoplay: 4.5s, wraps, pauses when hidden or right after manual navigation ── */
  useEffect(() => {
    if (banners.length <= 1 || paused) return;
    const t = setInterval(() => {
      if (Date.now() - lastInteractionRef.current < MANUAL_GRACE_MS) return;
      const el = scrollerRef.current;
      if (!el) return;
      const target = selected >= banners.length - 1 ? 0 : selected + 1;
      el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [banners.length, paused, selected]);

  /* ── Mouse drag-to-scroll (touch swiping is native via scroll-snap) ── */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    lastInteractionRef.current = Date.now();
    suppressClickRef.current = false;
    const el = scrollerRef.current;
    if (e.pointerType !== "mouse" || e.button !== 0 || !el) {
      dragState.current = null;
      return;
    }
    dragState.current = { startX: e.clientX, startScrollLeft: el.scrollLeft, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    const el = scrollerRef.current;
    if (!drag || !el) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 6) {
      drag.moved = true;
      // Disable snapping + smooth scroll while dragging so scrollLeft follows the pointer.
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
    }
    if (drag.moved) el.scrollLeft = drag.startScrollLeft - dx;
  };

  const endDrag = () => {
    const drag = dragState.current;
    const el = scrollerRef.current;
    dragState.current = null;
    if (!drag || !el) return;
    // A drag that started on the CTA must not navigate on release.
    suppressClickRef.current = drag.moved;
    if (!drag.moved) return;
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
    scrollToIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    }
  };

  const handleCtaClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (suppressClickRef.current) e.preventDefault();
  };

  /* ── Skeleton while banners load (same dimensions as the real hero) ── */
  if (!banners.length) {
    return (
      <section className="px-4 mt-4">
        <Shimmer className="h-[240px] w-full rounded-[24px]" rounded="rounded-none" />
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {[0, 1, 2].map((idx) => (
            <Shimmer key={idx} className={idx === 0 ? "h-1.5 w-[28px]" : "h-1.5 w-[6px]"} rounded="rounded-full" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <motion.section
      className="px-4 mt-4 outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      data-testid="hero-carousel"
      aria-roledescription="carousel"
      aria-label="Featured banners"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="relative">
        {/* Native scroll-snap viewport — swipe (touch) and drag (mouse) surface */}
        <div
          ref={scrollerRef}
          className="flex h-[240px] w-full snap-x snap-mandatory scroll-smooth overflow-x-auto overflow-y-hidden no-scrollbar select-none cursor-grab active:cursor-grabbing rounded-[24px]"
          style={{ WebkitOverflowScrolling: "touch" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
          onDragStart={(e) => e.preventDefault()}
        >
          {banners.map((banner, idx) => {
            const parts = banner.highlight ? banner.title.split(banner.highlight) : [banner.title];
            return (
              <div key={banner.id} data-testid="hero-slide" className="relative h-full w-full shrink-0 grow-0 basis-full snap-center overflow-hidden">
                {/* Background image with subtle zoom that restarts when the slide becomes active */}
                <motion.img
                  src={banner.image}
                  alt={banner.title}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                  initial={{ scale: 1 }}
                  animate={{ scale: idx === selected ? 1.04 : 1 }}
                  transition={{ duration: 4.5, ease: "linear" }}
                />
                {/* Token-driven scrim — adapts to the active theme */}
                <div className="absolute inset-0 bg-gradient-overlay" />

                {/* Badge */}
                <motion.span
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: idx === selected ? 1 : 0, x: idx === selected ? 0 : -12 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="absolute top-4 left-4 inline-flex items-center px-3 py-1 rounded-full bg-primary/15 border border-primary/45 text-primary text-[10px] font-bold uppercase tracking-wider z-10"
                >
                  {banner.badge}
                </motion.span>

                {/* Content */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: idx === selected ? 1 : 0, y: idx === selected ? 0 : 14 }}
                  transition={{ delay: 0.15, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute bottom-4 left-4 right-4 z-20 flex flex-col"
                >
                  <h2 className="font-display font-extrabold text-xl leading-tight text-white drop-shadow-lg">
                    {parts[0]}
                    <span className="neon-text">{banner.highlight}</span>
                    {parts[1]}
                  </h2>
                  <p className="mt-1 line-clamp-1 drop-shadow-md text-xs text-white/70">
                    {banner.subtitle}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <motion.div whileTap={{ scale: 0.93 }} whileHover={{ scale: 1.03 }}>
                      <Link
                        to={banner.cta_link}
                        onClick={handleCtaClick}
                        draggable={false}
                        className="inline-flex items-center gap-1.5 bg-gradient-neon text-primary-foreground font-bold rounded-full px-5 py-2 text-xs shadow-neon"
                        data-testid="hero-cta"
                      >
                        {banner.cta_text}{" "}
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </Link>
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>

        {banners.length > 1 && <HeroArrows onPrev={goPrev} onNext={goNext} />}
      </div>

      {banners.length > 1 && <HeroDots count={banners.length} selected={selected} onSelect={scrollToIndex} />}
    </motion.section>
  );
}

/* ── Prev/next arrows, overlaid at the vertical center of the track.
   White-over-photo is a semantic constant — identical in both themes. ── */
function HeroArrows({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous slide"
        data-testid="hero-prev"
        className="pressable absolute left-2 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next slide"
        data-testid="hero-next"
        className="pressable absolute right-2 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </>
  );
}

/* ── Pagination dots — token colors only, so they follow the theme. ── */
function HeroDots({
  count,
  selected,
  onSelect,
}: {
  count: number;
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-3" role="tablist">
      {Array.from({ length: count }).map((_, idx) => (
        <motion.button
          key={idx}
          type="button"
          role="tab"
          aria-selected={idx === selected}
          aria-label={`Slide ${idx + 1}`}
          onClick={() => onSelect(idx)}
          animate={{ width: idx === selected ? "28px" : "6px" }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="h-1.5 rounded-full transition-colors duration-300"
          style={{
            background: idx === selected ? "hsl(var(--primary))" : "hsl(var(--foreground-muted))",
            boxShadow: idx === selected ? "0 0 8px hsl(var(--primary) / 0.50)" : "none",
          }}
        />
      ))}
    </div>
  );
}
