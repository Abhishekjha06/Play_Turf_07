import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, MapPin, Calendar, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

import type { Tournament } from "@/data/seed";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/ui/Shimmer";

export type TournamentHeroCarouselProps = {
  tournaments: Tournament[];
  /** Loop back to the first slide after the last (infinite scrolling). Default: true */
  loop?: boolean;
  /** Auto-advance slides. Default: true */
  autoPlay?: boolean;
  /** Auto-advance interval in ms. Default: 5000 */
  autoPlayInterval?: number;
  /** Show prev/next arrow buttons. Default: true */
  showArrows?: boolean;
  /** Show pagination dots. Default: true */
  showDots?: boolean;
  /** Pause auto-play when the carousel is scrolled into view's tab is hidden. Default: true */
  pauseOnHidden?: boolean;
  className?: string;
};

/**
 * Horizontal, swipeable carousel of tournament "hero" cards.
 *
 * - Mouse drag on desktop + touch swipe on mobile (Embla)
 * - Snap-on-scroll positioning (one card per view on mobile, peek on larger screens)
 * - Pagination dots + prev/next arrow buttons
 * - Optional infinite looping (loop) and auto-play (autoPlay)
 * - Fully responsive: full-width card on phones, 80% peek on md+, 60% on lg+
 */
export function TournamentHeroCarousel({
  tournaments,
  loop = true,
  autoPlay = true,
  autoPlayInterval = 5000,
  showArrows = true,
  showDots = true,
  pauseOnHidden = true,
  className,
}: TournamentHeroCarouselProps) {
  // Build Embla with plugins. Autoplay is conditionally included so it isn't
  // active when the consumer disables it via props.
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: loop && tournaments.length > 1,
      align: "center",
      containScroll: "trimSnaps",
      dragFree: false,
    },
    autoPlay && tournaments.length > 1
      ? [Autoplay({ delay: autoPlayInterval, stopOnInteraction: true, stopOnMouseEnter: true })]
      : [],
  );

  const [selected, setSelected] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);

  // Pause autoplay when the document/tab is hidden — avoids burning cycles
  // and re-engaging a slide the user can't see.
  useEffect(() => {
    if (!pauseOnHidden) return;
    const onVisibilityChange = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pauseOnHidden]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  // Drive autoplay pause/resume from visibility state.
  useEffect(() => {
    if (!emblaApi) return;
    const autoplay = emblaApi.plugins()?.autoplay;
    if (!autoplay) return;
    if (paused) autoplay.stop();
    else autoplay.play();
  }, [emblaApi, paused]);

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  /* ── Skeleton while tournaments load ── */
  if (!tournaments.length) {
    return (
      <section className={cn("mt-4", className)} data-testid="tournament-hero-carousel">
        <Shimmer
          className="w-[88%] mx-auto"
          style={{ height: "260px", borderRadius: "24px" } as React.CSSProperties}
          rounded="rounded-none"
        />
      </section>
    );
  }

  return (
    <motion.section
      className={cn("mt-4", className)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      data-testid="tournament-hero-carousel"
      aria-roledescription="carousel"
      aria-label="Featured tournaments"
    >
      <div className="relative">
        {/* Embla viewport */}
        <div className="overflow-hidden" ref={emblaRef}>
          {/* Embla container */}
          <div className="flex">
            {tournaments.map((t, idx) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                index={idx}
                // basis controls how much of the next card "peeks" on wider screens:
                // - mobile: full-width single card
                // - md: 80% (peek of next)
                // - lg: 60% (more visible siblings)
                basis="basis-[85%] sm:basis-[80%] md:basis-[70%] lg:basis-[60%]"
              />
            ))}
          </div>
        </div>

        {/* Arrow buttons — hidden on touch-first devices where swipe is primary */}
        {showArrows && tournaments.length > 1 && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              disabled={!loop && selected === 0}
              aria-label="Previous tournament"
              className="absolute left-1 top-1/2 -translate-y-1/2 z-20 grid place-items-center h-9 w-9 rounded-full bg-surface/85 backdrop-blur border border-white/10 text-white shadow-lg pressable disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              disabled={!loop && selected === tournaments.length - 1}
              aria-label="Next tournament"
              className="absolute right-1 top-1/2 -translate-y-1/2 z-20 grid place-items-center h-9 w-9 rounded-full bg-surface/85 backdrop-blur border border-white/10 text-white shadow-lg pressable disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Pagination dots */}
      {showDots && tournaments.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3" role="tablist">
          {scrollSnaps.map((_, idx) => (
            <motion.button
              key={idx}
              type="button"
              aria-label={`Go to tournament ${idx + 1}`}
              aria-selected={idx === selected}
              role="tab"
              onClick={() => scrollTo(idx)}
              animate={{
                width: idx === selected ? "28px" : "6px",
                background: idx === selected ? "hsl(var(--primary))" : "rgba(255,255,255,0.25)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              style={{
                height: "6px",
                borderRadius: "999px",
                boxShadow: idx === selected ? "0 0 8px hsl(var(--primary) / 0.50)" : "none",
              }}
            />
          ))}
        </div>
      )}
    </motion.section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function TournamentCard({
  tournament: t,
  index,
  basis,
}: {
  tournament: Tournament;
  index: number;
  basis: string;
}) {
  return (
    <div
      className={cn(
        // Embla items are shrink-0 + grow-0; `basis` controls width per breakpoint.
        "min-w-0 shrink-0 grow-0 pl-3 first:pl-4 last:pr-1",
        basis,
      )}
      role="group"
      aria-roledescription="slide"
    >
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.05 }}
        className="card-panel rounded-3xl overflow-hidden"
        data-testid={`tournament-${t.id}`}
      >
        <div className="relative h-44">
          <img
            src={t.image}
            alt={t.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover select-none"
          />
          <div className="absolute inset-0 bg-gradient-overlay" />

          {/* Prize pill */}
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-neon">
            <Trophy className="h-3 w-3" /> {t.prize_pool}
          </span>

          {/* Sport badge */}
          <span className="absolute top-3 right-3 inline-flex items-center px-2.5 py-1 rounded-full bg-black/45 backdrop-blur text-white text-[10px] font-semibold uppercase tracking-wider border border-white/10">
            {t.sport}
          </span>

          {/* Title + description */}
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="font-display font-bold text-lg leading-tight text-white drop-shadow-lg">
              {t.name}
            </h3>
            <p className="text-soft text-xs line-clamp-1 drop-shadow-md">{t.description}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="p-3 grid grid-cols-3 gap-2 text-[11px]">
          <Stat icon={Calendar} label={t.date} />
          <Stat icon={MapPin} label={t.location} />
          <Stat icon={Users} label={`${t.teams} teams`} />
        </div>

        {/* Footer: entry fee + register */}
        <div className="px-3 pb-3 flex items-center justify-between gap-3">
          <p className="text-sm shrink-0">
            Entry <span className="neon-text font-bold">₹{t.entry_fee}</span>
          </p>
          <button
            type="button"
            onClick={() => toast.info(`Registration for "${t.name}" coming soon!`)}
            className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-semibold shadow-neon pressable min-h-[44px]"
          >
            Register
          </button>
        </div>
      </motion.article>
    </div>
  );
}

function Stat({ icon: Icon, label }: { icon: typeof Trophy; label: string }) {
  return (
    <div className="bg-panel-2 rounded-xl px-2 py-2.5 inline-flex items-center gap-1.5 border border-white/5 min-w-0">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-soft text-[11px] truncate leading-tight">{label}</span>
    </div>
  );
}

export default TournamentHeroCarousel;
