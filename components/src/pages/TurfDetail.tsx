import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useModalFocus } from "@/hooks/useModalFocus";
import type { Turf } from "@/data/seed";
import type { Review } from "@/data/seed";
import type { OpenGame } from "@/types/openGames";
import { trackEvent } from "@/lib/analytics";
import { useRealtimeOpenGames } from "@/lib/realtime";
import { useSeo } from "@/hooks/use-seo";
import { usePublicSeoMetadata } from "@/lib/seo-engine/usePublicSeoMetadata";
import {
  SITE_NAME, breadcrumbJsonLd, buildTurfSlug, matchTurfParam, slugify,
  turfJsonLd, turfPath,
} from "@/lib/seo";
import {
  Star, MapPin, Clock, Heart, Share2, Users, Calendar, Lock, X, AlertCircle, CreditCard, Smartphone, Wallet, Trophy, ChevronDown, Loader2,
  CircleParking, GlassWater, Toilet, Shirt, Lightbulb, Cctv, Coffee, Snowflake, Wifi, CircleCheck, Camera, Play, IndianRupee, Navigation,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/ui/carousel";
import { MobileGallery } from "@/ui/MobileGallery";
import { SimilarTurfsNearby } from "@/turf/SimilarTurfsNearby";
import { TurfInternalLinks } from "@/turf/TurfInternalLinks";
import { formatDateDMY } from "@/open-games/OpenGameCard";

/** "today" / "tomorrow" / DD-MM-YYYY — from the game's real date. */
const gameDayLabel = (iso: string): string => {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return iso;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gameDay = new Date(y, m - 1, d);
  gameDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((gameDay.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  return formatDateDMY(iso);
};
/** Local-timezone game start from "YYYY-MM-DD" + "HH:MM" (24h); null if unparseable. */
const gameStartsAt = (g: Pick<OpenGame, "date" | "time">): Date | null => {
  const [y, m, d] = (g.date || "").split("-").map(Number);
  const [hh, mm] = (g.time || "").split(":").map(Number);
  if (!y || !m || !d || !Number.isFinite(hh)) return null;
  return new Date(y, m - 1, d, hh, mm || 0);
};

/** Only games that haven't started yet render — past dates and already-begun events are hidden. */
const isUpcomingGame = (g: OpenGame): boolean => {
  const start = gameStartsAt(g);
  return start != null && start.getTime() > Date.now();
};

/** "06:00 AM" / "6:30 pm" → minutes since midnight; null if unparseable. */
const parseClock = (s: string): number | null => {
  const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toLowerCase() === "pm") h += 12;
  return h * 60 + (m[2] ? parseInt(m[2], 10) : 0);
};

/** Minutes since midnight → "11:00 PM". */
const fmtClock = (mins: number): string => {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
};

/** Is the venue open right now? Derived from its "OPEN – CLOSE" timing string. */
const openStateFromTiming = (
  timing: string
): { isOpen: boolean; open: number; close: number } | null => {
  if (!timing) return null;
  const [from, to] = timing.split(/\s*[–—-]\s*/);
  const open = parseClock(from ?? "");
  const close = parseClock(to ?? "");
  if (open == null || close == null) return null;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  // A close earlier than open means the window crosses midnight.
  const isOpen = open <= close ? cur >= open && cur < close : cur >= open || cur < close;
  return { isOpen, open, close };
};

/** 2D monoline icon per amenity (EazyDiner-style facility rows). */
const amenityIcon = (amenity: string): LucideIcon => {
  const a = amenity.toLowerCase();
  if (a.includes("parking")) return CircleParking;
  if (a.includes("water")) return GlassWater;
  if (a.includes("washroom") || a.includes("toilet") || a.includes("bathroom")) return Toilet;
  if (a.includes("changing")) return Shirt;
  if (a.includes("locker") || a.includes("changing room")) return Lock;
  if (a.includes("floodlight") || a.includes("led") || a.includes("light")) return Lightbulb;
  if (a.includes("cctv") || a.includes("camera") || a.includes("surveillance")) return Cctv;
  if (a.includes("cafe") || a.includes("coffee") || a.includes("refreshment")) return Coffee;
  if (a === "ac" || a.includes("air condition") || a.includes("cooling")) return Snowflake;
  if (a.includes("wifi") || a.includes("internet")) return Wifi;
  return CircleCheck;
};

/** Next 8 days, local time — mirrors Booking's dateLabels() so ?date= lines up. */
const nextDates = (): { iso: string; day: string; num: string }[] => {
  const out: { iso: string; day: string; num: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      // Local date, NOT toISOString() — UTC slicing turns IST mornings into
      // "yesterday" on the booking side (same reason Booking uses en-CA).
      iso: d.toLocaleDateString("en-CA"),
      day: d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
      num: String(d.getDate()),
    });
  }
  return out;
};

//pop up import

import {
  GiCricketBat,
  GiSoccerBall,
  GiBasketballBall,
  GiShuttlecock,
  GiTennisRacket,
} from "react-icons/gi";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";

//
const TurfDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const joinGameId = location.state?.joinGameId;
  const { user } = useAuth();

  const [turf, setTurf] = useState<Turf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);

  const [openGames, setOpenGames] = useState<OpenGame[]>([]);
  // Collapsed by default: one featured (soonest) card, "Load more" pulls the rest from the backend.
  const [showAllOpenGames, setShowAllOpenGames] = useState(false);
  const [loadingMoreGames, setLoadingMoreGames] = useState(false);
  const [selectedJoinGame, setSelectedJoinGame] = useState<OpenGame | null>(null);
  const [joiningGame, setJoiningGame] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("UPI");
  const joinGameRef = useRef<HTMLDivElement>(null);

  //sport pop up

  

  const [showSportPopup, setShowSportPopup] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);

 const handleBookNow = () => {
  setSelectedSport(null);
  setShowSportPopup(true);
};

  const getSportIcon = (sport: string) => {
  const s = sport.toLowerCase();

  if (s.includes("cricket")) {
    return <GiCricketBat className="text-2xl text-primary" />;
  }

  if (s.includes("football")) {
    return <GiSoccerBall className="text-2xl text-primary" />;
  }

  if (s.includes("basketball")) {
    return <GiBasketballBall className="text-2xl text-primary" />;
  }

  if (s.includes("badminton")) {
    return <GiShuttlecock className="text-2xl text-primary" />;
  }

  if (s.includes("tennis")) {
    return <GiTennisRacket className="text-2xl text-primary" />;
  }

  // Default icon
  return <span className="text-xl">🏆</span>;
};

  ///

  useModalFocus({
    isOpen: !!selectedJoinGame,
    onClose: () => setSelectedJoinGame(null),
    containerRef: joinGameRef,
  });

  const fetchOpenGames = async () => {
    if (turf) {
      try {
        const allGames = await api.listOpenGames();
        const filtered = allGames
          .filter(g => g.venue.toLowerCase().includes(turf.name.toLowerCase()))
          .filter(isUpcomingGame)
          .sort((a, b) => (gameStartsAt(a)?.getTime() ?? Infinity) - (gameStartsAt(b)?.getTime() ?? Infinity));
        setOpenGames(filtered);
        if (joinGameId) {
          const matched = filtered.find(g => g.id === joinGameId);
          if (matched && matched.status !== "full" && matched.status !== "cancelled") {
            setSelectedJoinGame(matched);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch open games for turf:", e);
      }
    }
  };

  // Listen for database realtime changes on open games
  useRealtimeOpenGames(fetchOpenGames);

  useEffect(() => {
    setShowAllOpenGames(false);
    fetchOpenGames();
  }, [turf]);

  /** "Load more" — re-fetches the venue's open games from the backend, then reveals them all. */
  const handleLoadMoreGames = async () => {
    setLoadingMoreGames(true);
    try {
      await fetchOpenGames();
      setShowAllOpenGames(true);
    } finally {
      setLoadingMoreGames(false);
    }
  };

  const handleJoinOpenGame = async (gameId: string) => {
    if (!user) {
      toast.error("Please sign in to join games.");
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    setJoiningGame(true);
    try {
      const game = openGames.find((g) => g.id === gameId);
      if (game?.is_private) {
        // Private games: send a request, no payment yet.
        await api.requestJoinOpenGame(gameId);
        toast.success("Request sent to host! You'll be notified on approval.");
        setSelectedJoinGame(null);
      } else {
        const { game: updated, booking } = await api.joinOpenGame(gameId, selectedPaymentMethod);
        // Payment capture for public games is handled server-side by the join
        // RPC — the client only confirms the join here.
        toast.success("You're in! Redirecting to your booking...");
        setSelectedJoinGame(null);
        if (booking) {
          navigate(`/booking/${booking.id}`);
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setJoiningGame(false);
    }
  };
  // booknow handler

  //
  const headerImages = useMemo(() => {
    if (!turf) return [];
    return Array.from(new Set([turf.image, ...turf.gallery]));
  }, [turf]);

  useEffect(() => {
    if (!carouselApi) return;
    setSlideCount(carouselApi.scrollSnapList().length);
    setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi || slideCount <= 1) return;
    const interval = setInterval(() => {
      if (carouselApi.canScrollNext()) {
        carouselApi.scrollNext();
      } else {
        carouselApi.scrollTo(0);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [carouselApi, slideCount]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        // 1. Direct id (existing /turf/turf_1 links).
        const direct = await api.getTurf(id).catch(() => null);
        if (!cancelled && direct) {
          setTurf(direct);
          trackEvent("Turf Viewed", { turf_id: direct.id, turf_name: direct.name });
          return;
        }
        // 2. Otherwise treat the param as a slug (/turf/greenfield-arena-turf-1).
        const all = await api.listTurfs();
        const match = matchTurfParam(id, all);
        if (!cancelled && match) {
          setTurf(match);
          trackEvent("Turf Viewed", { turf_id: match.id, turf_name: match.name });
        } else if (!cancelled) {
          setError("Turf not found");
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Recently viewed — real visit tracking for the Home section.
  useEffect(() => {
    if (!turf) return;
    try {
      const key = 'playturf:recently-viewed';
      const list = JSON.parse(localStorage.getItem(key) || '[]') as { id: string; name: string; image: string; slug: string }[];
      const next = [
        { id: turf.id, name: turf.name, image: turf.image, slug: buildTurfSlug(turf) },
        ...list.filter((x) => x.id !== turf.id),
      ].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(next));
    } catch { /* storage unavailable */ }
  }, [turf?.id]);

  // The resolved turf id — slug URLs must query favorites/reviews/games by
  // the REAL id, not by the URL slug.
  const turfId = turf?.id ?? null;

  useEffect(() => {
    if (!turfId) return;
    api.listFavorites().then((favorites) => setFavorite(favorites.includes(turfId)));
    api.listReviews(turfId).then(setReviews);
  }, [turfId]);

  const toggleFavorite = async () => {
    if (!turfId) return;
    const next = await api.toggleFavorite(turfId);
    const active = next.includes(turfId);
    setFavorite(active);
    toast.success(active ? "Added to favorites" : "Removed from favorites");
  };

  const submitReview = async () => {
    if (!turfId) return;
    try {
      await api.addReview(turfId, rating, comment);
      // A new review changes the venue's rating — drop cached recommendations.
      api.clearRecommendationCache(turfId);
      setComment("");
      setRating(5);
      setReviews(await api.listReviews(turfId));
      toast.success("Review added");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleShare = async () => {
    if (!turf) return;
    const text = [
      `Play Turf - ${turf.name}`,
      `📍 ${turf.address}`,
      `⏰ ${turf.timing}`,
      `₹${turf.price_per_hour}/hr`,
      `⭐ ${turf.rating} rating`,
    ].join("\n");
    if (navigator.share) {
      await navigator.share({ title: turf.name, text, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Turf details copied!");
    }
  };

  /** Open/closed right now, derived from the venue's timing string. */
  const hours = useMemo(() => openStateFromTiming(turf?.timing ?? ""), [turf?.timing]);

  // ── Sticky section navigation (Overview / Slots / Facilities / Reviews) ──
  const overviewRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLElement>(null);
  const facilitiesRef = useRef<HTMLElement>(null);
  const reviewsRef = useRef<HTMLElement>(null);
  const galleryRef = useRef<HTMLElement>(null);
  const videosRef = useRef<HTMLElement>(null);
  const aboutRef = useRef<HTMLElement>(null);
  const locationRef = useRef<HTMLElement>(null);
  const nearbyRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState("overview");
  // Sticky can't pin inside the shell's overflow-clipped ancestors — the nav
  // goes `fixed` once its natural spot scrolls past (same trick as the bottom bar).
  const navMarkerRef = useRef<HTMLDivElement>(null);
  const [navPinned, setNavPinned] = useState(false);

  const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!turf) return;
    const targets: [string, React.RefObject<HTMLElement | null>][] = [
      ["overview", overviewRef],
      ["slots", slotsRef],
      ["about", aboutRef],
      ["facilities", facilitiesRef],
      ["reviews", reviewsRef],
      ["location", locationRef],
      ["nearby", nearbyRef],
    ];
    const onScroll = () => {
      let current = "overview";
      for (const [id, ref] of targets) {
        if (ref.current && ref.current.getBoundingClientRect().top <= 120) current = id;
      }
      // Short trailing sections can never cross the threshold — at page
      // bottom, highlight the last target instead.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = targets[targets.length - 1][0];
      }
      setActiveSection(current);
      if (navMarkerRef.current) {
        setNavPinned(navMarkerRef.current.getBoundingClientRect().top <= 0);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [turf]);

  // ── Booking quick-pick date (passed as ?date= to the booking flow) ──
  const bookingDates = useMemo(nextDates, []);
  const [selectedDate, setSelectedDate] = useState(bookingDates[0].iso);

  const openInMaps = () => {
    if (!turf) return;
    const q =
      turf.lat != null && turf.lng != null
        ? `${turf.lat},${turf.lng}`
        : `${turf.name}, ${turf.address}`;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // ── SEO: real venue metadata + SportsActivityLocation schema ──
  // Phase 2 DOM parity: when the engine has published metadata for this slug,
  // the SPA serves the SAME title/description the bot HTML does
  // (usePublicSeoMetadata ← seo_public_metadata view); otherwise the local
  // template keeps the pre-engine behaviour. Hooks run unconditionally.
  const publicMeta = usePublicSeoMetadata(turf ? buildTurfSlug(turf) : null);
  useSeo(
    turf
      ? {
          title: publicMeta?.seo_title || `${turf.name} — ${turf.sport_types?.[0] || "Sports"} Turf in ${turf.city} | ${SITE_NAME}`,
          description: publicMeta?.meta_description || `Book ${turf.name} in ${turf.city} from ₹${turf.price_per_hour}/hour. ${(turf.sport_types || []).join(", ")} courts, ${(turf.amenities || []).slice(0, 4).join(", ")}. Live slot availability and instant booking.`,
          path: turfPath(turf),
          image: /^https?:/i.test(turf.image) ? turf.image : undefined,
          imageAlt: `${turf.name} — sports turf in ${turf.city}`,
          jsonLd: [
            turfJsonLd(turf, reviews),
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Turfs", path: "/turfs" },
              ...(turf.city
                ? [{ name: turf.city, path: `/turfs/${slugify(turf.city)}` }]
                : []),
              { name: turf.name, path: `/turf/${buildTurfSlug(turf)}` },
            ]),
          ],
        }
      : error
        ? { title: "Turf not found", description: "This venue could not be found.", path: "/turfs", noindex: true }
        : null
  );

  if (error) return <MobileShell><div className="p-6 text-center"><p className="text-soft mb-2">Could not load turf.</p><p className="text-xs text-muted2">{error}</p></div></MobileShell>;

  if (!turf) return <MobileShell><div className="p-6 text-soft">Loading…</div></MobileShell>;

  // Map embed + directions target: exact coordinates when present, otherwise name + address.
  const mapQuery =
    turf.lat != null && turf.lng != null
      ? `${turf.lat},${turf.lng}`
      : `${turf.name}, ${turf.address}`;

  return (
    <MobileShell>
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-b-3xl shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
        <Carousel setApi={setCarouselApi} className="w-full h-full [&>div]:h-full" opts={{ loop: true }}>
          <CarouselContent className="h-full ml-0">
            {headerImages.map((src, idx) => (
              <CarouselItem key={idx} className="relative h-full pl-0">
                <img
                  src={src}
                  alt={`${turf.name} ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-background pointer-events-none" />
        <div
          className="absolute top-0 left-0 right-0 h-28 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <BackButton />
          <div className="flex gap-2">
            <button onClick={handleShare} className="h-11 w-11 rounded-full glass grid place-items-center pressable" aria-label="Share">
              <Share2 className="h-5 w-5" />
            </button>
            <button onClick={toggleFavorite} className="h-11 w-11 rounded-full glass grid place-items-center pressable" aria-label="Favourite">
              <Heart className={`h-5 w-5 ${favorite ? "fill-primary text-primary" : ""}`} />
            </button>
          </div>
        </div>

        {slideCount > 1 && (
          <div className="absolute bottom-12 left-0 right-0 z-20 flex items-center justify-center gap-1.5" role="tablist">
            {headerImages.map((_, i) => (
              <button
                key={i}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${currentSlide === i ? "w-7 bg-primary shadow-neon" : "w-1.5 bg-white/25"
                  }`}
              />
            ))}
          </div>
        )}

        <div className="absolute bottom-11 right-3 z-20 flex gap-2">
          {slideCount > 1 && (
            <button
              type="button"
              onClick={() => scrollToSection(galleryRef)}
              className="glass pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              <Camera className="h-3.5 w-3.5" /> {slideCount} Photos
            </button>
          )}
          {(turf.videos?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => scrollToSection(videosRef)}
              className="glass pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              <Play className="h-3.5 w-3.5" /> {turf.videos?.length} Videos
            </button>
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="px-4 -mt-10 relative z-10"
      >
        <div ref={overviewRef} className="card-panel rounded-3xl p-4 scroll-mt-16">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display font-black text-2xl leading-tight">{turf.name}</h1>
              <p className="text-[15px] text-foreground font-medium flex items-center gap-2 mt-2">
                <MapPin className="h-4 w-4 text-primary shrink-0" /> {turf.address}
              </p>
              <p className="text-[15px] text-foreground font-medium flex items-center gap-2 mt-1.5">
                <Trophy className="h-4 w-4 text-primary shrink-0" /> {turf.sport_types.join(", ")}
              </p>
              <p className="text-[15px] text-foreground font-semibold flex items-center gap-2 mt-1.5">
                <IndianRupee className="h-4 w-4 text-primary shrink-0" /> {turf.price_per_hour.toLocaleString("en-IN")} per hour
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-panel-2 border border-white/5 px-3 py-2 text-center min-w-[92px]">
              <div className="flex items-center justify-center gap-1">
                <Star className="h-5 w-5 fill-primary text-primary" />
                <span className="font-bold text-lg leading-none">{turf.rating}</span>
              </div>
              <div className="h-px bg-white/10 my-1.5" />
              <p className="text-xs text-muted2 whitespace-nowrap">
                {reviews.length > 0 ? `${reviews.length} ratings` : "No ratings"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-4">
            <button
              type="button"
              onClick={() => setHoursOpen((v) => !v)}
              aria-expanded={hoursOpen}
              className={`pressable inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold bg-panel-2 border border-white/5 ${hours?.isOpen ? "text-success" : "text-muted2"}`}
            >
              {hours?.isOpen
                ? `Open till ${fmtClock(hours.close)}`
                : hours
                  ? `Opens at ${fmtClock(hours.open)}`
                  : turf.timing}
              <ChevronDown className={`h-4 w-4 transition-transform ${hoursOpen ? "rotate-180" : ""}`} />
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="pressable h-11 w-11 rounded-full bg-panel-2 border border-white/5 grid place-items-center text-foreground"
                aria-label="Share turf"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={openInMaps}
                className="pressable h-11 w-11 rounded-full bg-panel-2 border border-white/5 grid place-items-center text-foreground"
                aria-label="Open in Maps"
              >
                <MapPin className="h-5 w-5" />
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {hoursOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-panel-2 border border-white/5 px-3 py-2.5 text-xs text-soft">
                  <Clock className="h-3.5 w-3.5 text-muted2 shrink-0" />
                  <span>Open daily · {turf.timing}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section navigation — Overview / Slots / Facilities / Reviews.
            Marker holds the natural top; nav switches to fixed when scrolled past. */}
        <div ref={navMarkerRef} aria-hidden="true" />
        {navPinned && <div aria-hidden="true" className="h-[45px]" />}
        <div
          className={`z-30 flex items-center gap-1 overflow-x-auto no-scrollbar border-b ${
            navPinned
              ? "fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-[640px] lg:max-w-[min(94vw,1600px)]"
              : "-mx-4 px-4 mt-4"
          }`}
          style={{
            background: "hsl(var(--background))",
            borderColor: "hsl(var(--color-border-default))",
          }}
        >
          {([
            ["overview", "Overview", overviewRef],
            ["slots", "Slots", slotsRef],
            ["about", "About", aboutRef],
            ["facilities", "Facilities", facilitiesRef],
            ["reviews", "Reviews", reviewsRef],
            ["location", "Location", locationRef],
            ["nearby", "Similar Turfs", nearbyRef],
          ] as const).map(([id, label, ref]) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSection(ref)}
              className={`shrink-0 px-3 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                activeSection === id ? "text-primary border-primary" : "text-foreground border-transparent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Booking — date quick-pick, duration & price; live slots on the flow */}
        <section ref={slotsRef} className="mt-5 scroll-mt-16">
          <h3 className="font-semibold text-sm">Book a Slot</h3>
          <div className="card-panel rounded-2xl p-4 mt-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {bookingDates.map((d) => {
                const isSelected = d.iso === selectedDate;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setSelectedDate(d.iso)}
                    aria-pressed={isSelected}
                    className={`shrink-0 w-14 rounded-xl py-2 text-center border transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-panel-2 text-foreground border-white/5"
                    }`}
                  >
                    <span className="block text-[10px] font-bold opacity-80">{d.day}</span>
                    <span className="block text-sm font-black leading-tight">{d.num}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-foreground font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <IndianRupee className="h-4 w-4 text-primary" /> ₹{turf.price_per_hour.toLocaleString("en-IN")}/hr
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" /> 1-hour slots
              </span>
            </div>
            <p className="text-[11px] text-foreground mt-1.5">Live slot availability and duration on the next step.</p>
            <button
              type="button"
              onClick={handleBookNow}
              className="pressable mt-3 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-neon"
              data-testid="section-book-now"
            >
              Book Now
            </button>
          </div>
        </section>

        <section ref={aboutRef} className="mt-5 scroll-mt-16">
          <h3 className="font-semibold text-sm">About</h3>
          <p className="text-foreground text-sm mt-1">{turf.description}</p>
        </section>

        {/* Facilities & amenities — EazyDiner-style 2D icon rows */}
        <section ref={facilitiesRef} className="mt-5 scroll-mt-16">
          <h3 className="font-semibold text-sm">Facilities & Amenities</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 mt-2">
            {turf.amenities.map((a) => {
              const Icon = amenityIcon(a);
              return (
                <div key={a} className="flex items-center gap-2.5 bg-panel-2 rounded-xl px-3 py-2.5 border border-white/5">
                  <span
                    className="grid place-items-center h-8 w-8 rounded-lg shrink-0"
                    style={{ background: "hsl(var(--color-border-default))" }}
                  >
                    <Icon className="h-4 w-4 text-primary" />
                  </span>
                  <span className="text-xs font-semibold">{a}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-foreground mt-3 font-bold uppercase tracking-wider">Supported sports</p>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {turf.sport_types.map((s) => (
              <span key={s} className="text-xs bg-panel-2 px-3 py-1.5 rounded-full border border-white/5">{s}</span>
            ))}
          </div>
        </section>

        {openGames.length > 0 && (
          <section className="mt-6 text-left">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5 text-foreground">
              <Users className="w-4 h-4 text-primary animate-pulse" /> Open Games at this Venue
            </h3>
            <div className="space-y-4">
              {(showAllOpenGames ? openGames : openGames.slice(0, 1)).map((g) => {
                const progress = (g.slots_filled / g.slots_total) * 100;
                return (
                  <div
                    key={g.id}
                    className="card-panel rounded-3xl p-4 flex flex-col gap-3.5 relative overflow-hidden"
                  >
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Find a game</p>
                      <div className="flex items-center justify-between">
                        <h4 className="font-display font-black text-base text-foreground leading-tight">
                          {g.sport === "Football" ? "5-a-side football" : `${g.sport} Session`}
                        </h4>
                        <div className="flex gap-1.5 items-center">
                          <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            open
                          </span>
                          {g.is_private ? (
                            <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                              🔒 Private
                            </span>
                          ) : (
                            <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400">
                              🌐 Public
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground font-semibold">
                      <p className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {turf.name}, {turf.city}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {gameDayLabel(g.date)}, {g.time}
                        {g.duration_hours ? ` • ${g.duration_hours}h` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 rounded-full bg-zinc-850 overflow-hidden" style={{ backgroundColor: "#27272a" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500 bg-gradient-neon shadow-neon"
                          style={{
                            width: `${progress}%`
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-bold shrink-0">
                        {g.slots_filled}/{g.slots_total} joined
                      </span>
                    </div>

                    <button
                      disabled={g.status === "full" || g.status === "cancelled"}
                      onClick={() => {
                        if (g.status !== "full" && g.status !== "cancelled") {
                          setSelectedJoinGame(g);
                        }
                      }}
                      className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer border-none shadow-neon ${g.status === "full" || g.status === "cancelled"
                          ? "bg-zinc-800 text-zinc-500 shadow-none cursor-not-allowed"
                          : "bg-gradient-neon text-primary-foreground"
                        }`}
                    >
                      {g.status === "full" ? "Game Full" : g.status === "cancelled" ? "Cancelled" : g.is_private ? "Request Invite ↗" : "Join game ↗"}
                    </button>
                  </div>
                );
              })}
            </div>

            {!showAllOpenGames && openGames.length > 1 && (
              <button
                type="button"
                onClick={handleLoadMoreGames}
                disabled={loadingMoreGames}
                className="pressable mt-4 w-full rounded-full bg-panel-2 border border-white/5 py-3 text-xs font-bold text-foreground flex items-center justify-center gap-1.5 disabled:opacity-60"
                data-testid="load-more-open-games"
              >
                {loadingMoreGames ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                  </>
                ) : (
                  <>
                    Load more games ({openGames.length - 1} more)
                    <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </section>
        )}

        {turf.gallery.length > 1 && (
          <section ref={galleryRef} className="mt-5 mb-2 scroll-mt-16">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Photo Gallery</h3>
              <p className="text-xs text-muted2">
                {headerImages.length} photos{(turf.videos?.length ?? 0) > 0 ? ` · ${turf.videos?.length} videos` : ""}
              </p>
            </div>
            <MobileGallery images={turf.gallery} altPrefix={turf.name} />
          </section>
        )}

        {(turf.videos?.length ?? 0) > 0 && (
          <section ref={videosRef} className="mt-5 scroll-mt-16">
            <h3 className="font-semibold text-sm">Videos</h3>
            <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
              {turf.videos?.map((video, i) => (
                <video key={i} src={video} controls className="h-32 w-56 shrink-0 rounded-xl bg-panel-2 object-cover" />
              ))}
            </div>
          </section>
        )}

        <section ref={reviewsRef} className="mt-5 scroll-mt-16">
          <h3 className="font-semibold text-sm">Ratings & Reviews</h3>
          <div className="card-panel mt-2 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-center shrink-0">
              <p className="font-display font-black text-3xl leading-none">{turf.rating}</p>
              <div className="flex gap-0.5 mt-1.5 justify-center">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${i <= Math.round(turf.rating) ? "fill-primary text-primary" : "text-muted2"}`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted2 mt-1">{reviews.length} ratings</p>
            </div>
            <div className="h-10 w-px shrink-0" style={{ background: "hsl(var(--color-border-default))" }} />
            <p className="text-xs text-foreground">
              Played here? Rate the turf and tell other players what to expect.
            </p>
          </div>
          <div className="card-panel mt-2 rounded-2xl p-3">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} onClick={() => setRating(value)} className="pressable h-11 w-11 grid place-items-center rounded-xl">
                  <Star className={`h-5 w-5 ${value <= rating ? "fill-primary text-primary" : "text-muted2"}`} />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="mt-3 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 text-sm outline-none focus:border-primary"
              rows={3}
              placeholder="Write a quick review..."
            />
            <button onClick={submitReview} className="pressable mt-3 w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground shadow-neon">
              Add Review
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {reviews.length === 0 && <p className="text-sm text-foreground">No reviews yet.</p>}
            {reviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-white/10 bg-panel-2 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{review.user_name}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-primary"><Star className="h-3 w-3 fill-primary" /> {review.rating}</span>
                </div>
                <p className="mt-1 text-sm text-soft">{review.comment}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Location — address, embedded map, directions */}
        <section ref={locationRef} className="mt-5 scroll-mt-16">
          <h3 className="font-semibold text-sm">Location</h3>
          <div className="mt-2 overflow-hidden rounded-2xl border border-white/5">
            <iframe
              title={`Map of ${turf.name}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-44 border-0"
            />
          </div>
          <div className="flex items-center justify-between gap-3 mt-3 bg-panel-2 rounded-xl px-3 py-2.5 border border-white/5">
            <p className="text-xs text-foreground inline-flex items-center gap-1.5 min-w-0">
              <MapPin className="h-4 w-4 shrink-0 text-primary" /> {turf.address}
            </p>
            <button
              type="button"
              onClick={openInMaps}
              className="pressable shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              <Navigation className="h-3.5 w-3.5" /> Directions
            </button>
          </div>
        </section>

        {/* Similar Turfs Nearby — Recommendation Engine V1 */}
        <section ref={nearbyRef} className="mt-5 mb-2 scroll-mt-16">
          <TurfInternalLinks turf={turf} />
          <SimilarTurfsNearby currentTurf={turf} selectedSport={selectedSport} />
        </section>
      </motion.div>

      <div className="h-32" />

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px] md:max-w-[640px] lg:max-w-[min(94vw,1600px)] bg-panel rounded-t-2xl px-4 pt-3 flex items-center justify-between"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {joinGameId && openGames.find(g => g.id === joinGameId && g.status !== "full" && g.status !== "cancelled") ? (
          (() => {
            const game = openGames.find(g => g.id === joinGameId && g.status !== "full" && g.status !== "cancelled")!;
            return (
              <>
                <div>
                  <p className="text-xs text-muted2">Price per slot</p>
                  <p className="font-bold text-lg neon-text">₹{game.price_per_slot}<span className="text-muted2 text-xs">/slot</span></p>
                </div>
                <button
                  disabled={game.status === "full" || game.status === "cancelled"}
                  onClick={() => setSelectedJoinGame(game)}
                  className="bg-primary text-primary-foreground font-semibold rounded-full px-6 py-3.5 text-sm shadow-neon pressable min-h-[44px]"
                >
                  {game.status === "full" ? "Game Full" : game.status === "cancelled" ? "Cancelled" : game.is_private ? "Request Invite" : "Join Game"}
                </button>
              </>
            );
          })()
        ) : (
          <>
            <div>
              <p className="text-xs text-foreground">Starting at</p>
              <p className="font-bold text-lg neon-text">₹{turf.price_per_hour}<span className="text-foreground text-xs">/hr</span></p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBookNow();
              }}
              className="bg-primary text-primary-foreground font-semibold rounded-full px-6 py-3.5 text-sm shadow-neon pressable min-h-[44px]"
              data-testid="detail-book-now"
            >
              Book Now
            </button>
          </>
        )}
      </div>
      <Dialog
        open={showSportPopup}
        onOpenChange={setShowSportPopup}
      >
        <DialogContent
          className="
            w-[calc(100%-24px)]
            max-w-[460px]
            bg-[#181818]
            border border-white/10
            rounded-[28px]
            p-0
            overflow-hidden
            shadow-2xl
          "
        >
          <DialogHeader className="px-5 pt-5 pb-2">
            <DialogTitle className="text-xl font-black text-white">
              Choose Sport
            </DialogTitle>
          </DialogHeader>

          {/* SPORTS - PREVIOUS STYLE */}
          <div className="px-5 pb-3">
            <div className="grid grid-cols-2 gap-3">
              {turf?.sport_types?.map((sport) => {
                const sportName = sport.toLowerCase();

                let icon = "🏆";

                if (sportName === "cricket") icon = "🏏";
                else if (sportName === "football") icon = "⚽";
                else if (sportName === "badminton") icon = "🏸";
                else if (sportName === "tennis") icon = "🎾";
                else if (
                  sportName === "table tennis" ||
                  sportName === "table_tennis"
                ) {
                  icon = "🏓";
                } else if (sportName === "basketball") {
                  icon = "🏀";
                } else if (sportName === "volleyball") {
                  icon = "🏐";
                }

                const isSelected = selectedSport === sport;

                return (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => {
                      // ONLY SELECT
                      // DO NOT NAVIGATE
                      setSelectedSport(sport);
                    }}
                    className={`
                      relative
                      flex
                      items-center
                      justify-center
                      gap-2
                      rounded-2xl
                      px-4
                      py-3
                      min-h-[52px]
                      border
                      transition-all
                      duration-200
                      ${
                        isSelected
                          ? "bg-primary/15 border-primary shadow-[0_0_15px_rgba(0,255,170,0.15)]"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }
                    `}
                  >
                    {/* SPORT NAME FIRST */}
                    <span
                      className={`
                        text-sm
                        font-bold
                        capitalize
                        ${
                          isSelected
                            ? "text-primary"
                            : "text-white"
                        }
                      `}
                    >
                      {sport}
                    </span>

                    {/* ICON BESIDE SPORT */}
                    <span className="text-xl leading-none">
                      {icon}
                    </span>

                    {/* CHECK */}
                    {isSelected && (
                      <span
                        className="
                          absolute
                          top-1.5
                          right-2
                          text-primary
                          text-xs
                          font-black
                        "
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONTINUE */}
          <div className="mt-4">
            <button
              type="button"
              disabled={!selectedSport}
              onClick={() => {
                if (!selectedSport || !turf) return;

                setShowSportPopup(false);

                navigate(`/booking/new/${turf.id}?sport=${encodeURIComponent(selectedSport)}&date=${selectedDate}`
              );
              }
            }
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-black disabled:opacity-40"
            >
              Continue with {selectedSport || "Sport"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {selectedJoinGame && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedJoinGame(null)}
              className="fixed inset-0 z-[45] bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              ref={joinGameRef}
              initial={{ y: "100%", x: "-50%" }}
              animate={{ y: 0, x: "-50%" }}
              exit={{ y: "100%", x: "-50%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] md:max-w-[640px] lg:max-w-[min(94vw,1600px)] bg-panel rounded-t-[2.5rem] border-t border-[hsl(var(--color-border-default))] p-6 space-y-5"
              style={{
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))"
              }}
            >
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h3 className="font-display font-black text-lg text-foreground">Confirm your spot</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-semibold">
                    {selectedJoinGame.sport === "Football" ? "5-a-side football" : `${selectedJoinGame.sport} Session`} • {gameDayLabel(selectedJoinGame.date)}, {selectedJoinGame.time}
                    {selectedJoinGame.duration_hours ? ` • ${selectedJoinGame.duration_hours}h` : ""}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJoinGame(null)}
                  aria-label="Close join game panel"
                  className="p-1 hover:bg-white/10 rounded-full cursor-pointer text-muted-foreground hover:text-foreground border-none bg-transparent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div
                className="p-4 rounded-2xl space-y-3.5 text-xs text-muted-foreground font-semibold"
                style={{ backgroundColor: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="flex justify-between items-center">
                  <span>total slot price</span>
                  <span className="font-black text-foreground text-sm">₹{selectedJoinGame.total_amount}</span>
                </div>

                <div className="flex justify-between items-start pt-1.5 border-t border-white/5">
                  <span>split across</span>
                  <div className="text-right">
                    <span className="font-black text-foreground text-sm block leading-none">{selectedJoinGame.slots_total}</span>
                    <span className="text-xs text-muted-foreground leading-none font-bold uppercase tracking-wider block mt-1">players</span>
                  </div>
                </div>

                <div className="h-[1px] border-t border-white/5 my-2" />

                <div className="flex justify-between items-center text-sm font-black text-foreground">
                  <span className="text-base text-white">your share</span>
                  <span className="text-xl text-white font-display">₹{selectedJoinGame.price_per_slot}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-2 text-left">
                <span className="text-xs font-black uppercase text-muted-foreground tracking-widest block">
                  Select Payment Method
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "UPI", label: "Fake UPI", icon: Smartphone },
                    { value: "Card", label: "Card", icon: CreditCard },
                    { value: "Wallet", label: "Wallet", icon: Wallet },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = selectedPaymentMethod === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(m.value)}
                        aria-pressed={isSelected}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer bg-transparent ${isSelected
                            ? "border-primary text-primary bg-primary/5"
                            : "border-white/5 text-muted2 hover:text-foreground"
                          }`}
                      >
                        <Icon className="h-5 w-5 mb-1" />
                        <span className="text-xs font-bold">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground justify-center">
                  <Lock className="h-4.5 w-4.5 text-primary shrink-0" />
                  <span>secure payment via UPI / card</span>
                </div>

                <button
                  disabled={joiningGame}
                  onClick={() => handleJoinOpenGame(selectedJoinGame.id)}
                  className="w-full py-4 rounded-2xl text-sm font-black text-slate-900 flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer border-none"
                  style={{
                    background: "linear-gradient(90deg, #7da6df, #9dc4f8)",
                    boxShadow: "0 4px 15px rgba(125,166,223,0.3)"
                  }}
                >
                  {joiningGame ? (
                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin border-slate-900" />
                  ) : selectedJoinGame.is_private ? (
                    "Send join request ↗"
                  ) : (
                    `Pay ₹${selectedJoinGame.price_per_slot} and join ↗`
                  )}
                </button>

                <p className="text-xs text-muted-foreground text-center font-bold">
                  free cancellation up to 6 hours before
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </MobileShell>
  );
};

export default TurfDetail;
