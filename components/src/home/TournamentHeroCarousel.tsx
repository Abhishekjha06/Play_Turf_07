import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, MapPin, Calendar, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import type { Tournament } from "@/data/seed";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/ui/Shimmer";

export type TournamentHeroCarouselProps = {
  tournaments: Tournament[];
  /** Loop back to the first slide after the last (infinite scrolling). Default: false */
  loop?: boolean;
  /** Auto-advance slides. Default: false */
  autoPlay?: boolean;
  /** Auto-advance interval in ms. Default: 5000 */
  autoPlayInterval?: number;
  /** Show prev/next arrow buttons. Default: true */
  showArrows?: boolean;
  /** Show pagination dots. Default: true */
  showDots?: boolean;
  /** Pause auto-play when the document is hidden. Default: true */
  pauseOnHidden?: boolean;
  className?: string;
};

/**
 * Horizontal, swipeable carousel of tournament "hero" cards.
 *
 * Uses NATIVE CSS scroll-snap (not a JS drag polyfill) so it feels exactly
 * like swiping on a phone — native momentum, native touch handling, native
 * scrollbar behavior, on every device.
 *
 * - Touch swipe + mouse drag work out of the box (browser-native)
 * - `scroll-snap-type: x mandatory` snaps one card at a time
 * - `-webkit-overflow-scrolling: touch` for iOS momentum
 * - Pagination dots + prev/next arrow buttons (with smooth scroll)
 * - Optional infinite looping (loop) and auto-play (autoPlay)
 * - Responsive: full card on phones, peek of next card on wider screens
 */
export function TournamentHeroCarousel({
  tournaments,
  loop = false,
  autoPlay = false,
  autoPlayInterval = 5000,
  showArrows = true,
  showDots = true,
  pauseOnHidden = true,
  className,
}: TournamentHeroCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);

  // Pause autoplay when the document/tab is hidden.
  useEffect(() => {
    if (!pauseOnHidden) return;
    const onVisibilityChange = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pauseOnHidden]);

  /* ── Track which card is currently in view (drives dots + arrows) ── */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Index = nearest card based on scrollLeft / card width.
        const cardWidth = el.clientWidth * CARD_WIDTH_RATIO;
        const idx = Math.round(el.scrollLeft / cardWidth);
        setSelected(Math.max(0, Math.min(idx, tournaments.length - 1)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [tournaments.length]);

  /* ── Autoplay ── */
  useEffect(() => {
    if (!autoPlay || paused || tournaments.length <= 1) return;
    const id = setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const cardWidth = el.clientWidth * CARD_WIDTH_RATIO;
      const atEnd = selected >= tournaments.length - 1;
      if (atEnd) {
        if (loop) {
          el.scrollTo({ left: 0, behavior: "smooth" });
        }
        // If not looping, stop at the end.
      } else {
        el.scrollTo({ left: (selected + 1) * cardWidth, behavior: "smooth" });
      }
    }, autoPlayInterval);
    return () => clearInterval(id);
  }, [autoPlay, autoPlayInterval, loop, paused, selected, tournaments.length]);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.clientWidth * CARD_WIDTH_RATIO;
    el.scrollTo({ left: index * cardWidth, behavior: "smooth" });
  }, []);

  const scrollPrev = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (loop && selected === 0) {
      // Wrap to the end for true loop on arrow press.
      el.scrollTo({ left: (tournaments.length - 1) * el.clientWidth * CARD_WIDTH_RATIO, behavior: "smooth" });
      return;
    }
    scrollToIndex(Math.max(0, selected - 1));
  }, [loop, selected, tournaments.length, scrollToIndex]);

  const scrollNext = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (loop && selected === tournaments.length - 1) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    scrollToIndex(Math.min(tournaments.length - 1, selected + 1));
  }, [loop, selected, tournaments.length, scrollToIndex]);

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
        {/* Native scroll-snap viewport — this is the "phone swipe" surface */}
        <div
          ref={scrollerRef}
          className="
            tournament-hero-scroller
            flex
            overflow-x-auto
            overflow-y-hidden
            snap-x snap-mandatory
            scroll-smooth
            gap-0
            px-4
            pb-1
            no-scrollbar
            touch-pan-x
          "
          style={{
            // iOS momentum scrolling — the key to the "phone" feel.
            WebkitOverflowScrolling: "touch",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
          }}
        >
          {tournaments.map((t, idx) => (
            <TournamentCard key={t.id} tournament={t} index={idx} />
          ))}
          {/* Trailing spacer so the last card can fully scroll into view */}
          <div className="snap-none shrink-0 w-4" aria-hidden />
        </div>

        {/* Arrow buttons */}
        {showArrows && tournaments.length > 1 && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous tournament"
              className={cn(
                "absolute left-1 top-1/2 -translate-y-1/2 z-20 grid place-items-center h-9 w-9 rounded-full bg-surface/85 backdrop-blur border border-white/10 text-white shadow-lg pressable transition-opacity",
                !loop && selected === 0 ? "opacity-30 pointer-events-none" : "opacity-100",
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              aria-label="Next tournament"
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 z-20 grid place-items-center h-9 w-9 rounded-full bg-surface/85 backdrop-blur border border-white/10 text-white shadow-lg pressable transition-opacity",
                !loop && selected === tournaments.length - 1 ? "opacity-30 pointer-events-none" : "opacity-100",
              )}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Pagination dots */}
      {showDots && tournaments.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3" role="tablist">
          {tournaments.map((_, idx) => (
            <motion.button
              key={idx}
              type="button"
              aria-label={`Go to tournament ${idx + 1}`}
              aria-selected={idx === selected}
              role="tab"
              onClick={() => scrollToIndex(idx)}
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

/* Card occupies 85% of viewport width on phones → next card "peeks" to hint scrollability.
 * On wider screens we shrink the basis so 1.5–2 cards are visible. The ratio is reused
 * above to compute scroll offsets, so the math stays consistent across breakpoints. */
const CARD_WIDTH_RATIO = 0.85;

function TournamentCard({
  tournament: t,
  index,
}: {
  tournament: Tournament;
  index: number;
}) {
  return (
    <div
      className={cn(
        "min-w-0 shrink-0 grow-0",
        // Responsive widths: 85% phones → 70% md → 55% lg
        "basis-[85%] md:basis-[70%] lg:basis-[55%]",
        // First card aligns to the left edge; snap-align center keeps it crisp.
        "snap-center",
        "pr-3",
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
            className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
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
