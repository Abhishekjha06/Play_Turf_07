import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { Turf } from "@/data/seed";
import type { Review } from "@/data/seed";
import type { OpenGame } from "@/types/openGames";
import { trackEvent } from "@/lib/analytics";
import { Star, MapPin, Clock, Heart, Share2, Users, Calendar, Lock, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/ui/carousel";
import { MobileGallery } from "@/ui/MobileGallery";

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
  const [selectedJoinGame, setSelectedJoinGame] = useState<OpenGame | null>(null);
  const [joiningGame, setJoiningGame] = useState(false);

  const fetchOpenGames = async () => {
    if (turf) {
      try {
        const allGames = await api.listOpenGames();
        const filtered = allGames.filter(g => 
          g.venue.toLowerCase().includes(turf.name.toLowerCase())
        );
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

  useEffect(() => {
    fetchOpenGames();
  }, [turf]);

  const handleJoinOpenGame = async (gameId: string) => {
    if (!user) {
      toast.error("Please sign in to join games.");
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    setJoiningGame(true);
    try {
      const updated = await api.joinOpenGame(gameId);
      if (updated.is_private) {
        toast.success("Request sent to host! Awaiting host approval.");
      } else {
        toast.success("Successfully joined the game!");
      }
      setSelectedJoinGame(null);
      await fetchOpenGames();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setJoiningGame(false);
    }
  };

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
    if (id) {
      api.getTurf(id).then((data) => {
        setTurf(data);
        trackEvent("Turf Viewed", { turf_id: data.id, turf_name: data.name });
      }).catch((e) => setError((e as Error).message));
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.listFavorites().then((favorites) => setFavorite(favorites.includes(id)));
    api.listReviews(id).then(setReviews);
  }, [id]);

  const toggleFavorite = async () => {
    if (!id) return;
    const next = await api.toggleFavorite(id);
    const active = next.includes(id);
    setFavorite(active);
    toast.success(active ? "Added to favorites" : "Removed from favorites");
  };

  const submitReview = async () => {
    if (!id) return;
    try {
      await api.addReview(id, rating, comment);
      setComment("");
      setRating(5);
      setReviews(await api.listReviews(id));
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

  if (error) return <MobileShell><div className="p-6 text-center"><p className="text-soft mb-2">Could not load turf.</p><p className="text-xs text-muted2">{error}</p></div></MobileShell>;

  if (!turf) return <MobileShell><div className="p-6 text-soft">Loading…</div></MobileShell>;

  return (
    <MobileShell>
      <div className="relative h-56 w-full overflow-hidden rounded-b-3xl shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
        <Carousel setApi={setCarouselApi} className="w-full h-full" opts={{ loop: true }}>
          <CarouselContent className="h-56 ml-0">
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
      </div>

      {slideCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3" role="tablist">
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

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="px-4 mt-4 relative z-10"
      >
        <div className="card-panel rounded-3xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display font-bold text-xl leading-tight">{turf.name}</h1>
              <p className="text-sm text-muted2 inline-flex items-center gap-1 mt-1">
                <MapPin className="h-3.5 w-3.5" /> {turf.address}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 bg-primary/15 text-primary border border-primary/40 px-2 py-1 rounded-full text-xs font-semibold">
              <Star className="h-3 w-3 fill-primary" /> {turf.rating}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-sm text-soft">
            <Clock className="h-4 w-4" /> {turf.timing}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {turf.sport_types.map((s) => (
              <span key={s} className="text-[11px] bg-panel-2 px-2 py-1 rounded-full border border-white/5">{s}</span>
            ))}
          </div>
        </div>

        <section className="mt-5">
          <h3 className="font-semibold text-sm">About</h3>
          <p className="text-soft text-sm mt-1">{turf.description}</p>
        </section>

        <section className="mt-5">
          <h3 className="font-semibold text-sm">Amenities</h3>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {turf.amenities.map((a) => (
              <div key={a} className="text-xs bg-panel-2 rounded-xl px-3 py-2 border border-white/5">
                {a}
              </div>
            ))}
          </div>
        </section>

        {openGames.length > 0 && (
          <section className="mt-6 text-left">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5 text-foreground">
              <Users className="w-4 h-4 text-primary animate-pulse" /> Open Games at this Venue
            </h3>
            <div className="space-y-4">
              {openGames.map((g) => {
                const progress = (g.slots_filled / g.slots_total) * 100;
                return (
                  <div
                    key={g.id}
                    className="card-panel rounded-3xl p-4 flex flex-col gap-3.5 relative overflow-hidden"
                    style={{ backgroundColor: "#1e1e1e", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Find a game</p>
                      <div className="flex items-center justify-between">
                        <h4 className="font-display font-black text-base text-foreground leading-tight">
                          {g.sport === "Football" ? "5-a-side football" : `${g.sport} Session`}
                        </h4>
                        <div className="flex gap-1.5 items-center">
                          <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            open
                          </span>
                          {g.is_private ? (
                            <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                              🔒 Private
                            </span>
                          ) : (
                            <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400">
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
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> today, {g.time} • 90 min
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
                      className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer border-none shadow-neon ${
                        g.status === "full" || g.status === "cancelled"
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
          </section>
        )}

        {turf.gallery.length > 1 && (
          <section className="mt-5 mb-2">
            <h3 className="font-semibold text-sm mb-3">Gallery</h3>
            <MobileGallery images={turf.gallery} altPrefix={turf.name} />
          </section>
        )}

        {(turf.videos?.length ?? 0) > 0 && (
          <section className="mt-5">
            <h3 className="font-semibold text-sm">Videos</h3>
            <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
              {turf.videos?.map((video, i) => (
                <video key={i} src={video} controls className="h-32 w-56 shrink-0 rounded-xl bg-panel-2 object-cover" />
              ))}
            </div>
          </section>
        )}

        <section className="mt-5">
          <h3 className="font-semibold text-sm">Ratings & Reviews</h3>
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
            {reviews.length === 0 && <p className="text-sm text-muted2">No reviews yet.</p>}
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
      </motion.div>

      <div className="h-32" />

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px] glass-strong rounded-t-2xl px-4 pt-3 flex items-center justify-between"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {joinGameId && openGames.find(g => g.id === joinGameId && g.status !== "full" && g.status !== "cancelled") ? (
          (() => {
            const game = openGames.find(g => g.id === joinGameId && g.status !== "full" && g.status !== "cancelled")!;
            return (
              <>
                <div>
                  <p className="text-[11px] text-muted2">Price per slot</p>
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
              <p className="text-[11px] text-muted2">Starting at</p>
              <p className="font-bold text-lg neon-text">₹{turf.price_per_hour}<span className="text-muted2 text-xs">/hr</span></p>
            </div>
            <button
              onClick={() => navigate(`/booking/new/${turf.id}`)}
              className="bg-primary text-primary-foreground font-semibold rounded-full px-6 py-3.5 text-sm shadow-neon pressable min-h-[44px]"
              data-testid="detail-book-now"
            >
              Book Now
            </button>
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedJoinGame && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedJoinGame(null)}
              className="fixed inset-0 z-[45] bg-black/70 backdrop-blur-sm"
              style={{ maxWidth: "480px", left: "50%", transform: "translateX(-50%)" }}
            />
            <motion.div
              initial={{ y: "100%", x: "-50%" }}
              animate={{ y: 0, x: "-50%" }}
              exit={{ y: "100%", x: "-50%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] bg-panel rounded-t-[2.5rem] border-t border-white/10 p-6 space-y-5"
              style={{
                backgroundColor: "#1e1e1e",
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))"
              }}
            >
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h3 className="font-display font-black text-lg text-foreground">Confirm your spot</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-semibold">
                    {selectedJoinGame.sport === "Football" ? "5-a-side football" : `${selectedJoinGame.sport} Session`} • today, {selectedJoinGame.time}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJoinGame(null)}
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
                    <span className="text-[10px] text-muted-foreground leading-none font-bold uppercase tracking-wider block mt-1">players</span>
                  </div>
                </div>

                <div className="h-[1px] border-t border-white/5 my-2" />

                <div className="flex justify-between items-center text-sm font-black text-foreground">
                  <span className="text-base text-white">your share</span>
                  <span className="text-xl text-white font-display">₹{selectedJoinGame.price_per_slot}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
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
                  ) : (
                    `Pay ₹${selectedJoinGame.price_per_slot} and join ↗`
                  )}
                </button>

                <p className="text-[11px] text-muted-foreground text-center font-bold">
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
