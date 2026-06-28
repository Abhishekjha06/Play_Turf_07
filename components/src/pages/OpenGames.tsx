import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MobileShell } from "@/layout/MobileShell";
import { AppHeader } from "@/layout/AppHeader";
import { BottomNav } from "@/layout/BottomNav";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { OpenGame } from "@/types/openGames";
import type { Turf } from "@/data/seed";
import {
  Users,
  Calendar,
  Lock,
  X,
  AlertCircle,
  PlusCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  CreditCard,
  Smartphone,
  Wallet,
  UserMinus,
  LogOut,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { pageEnter, staggerContainer, fadeSlideUp } from "@/lib/motion";
import { useRealtimeOpenGames } from "@/lib/realtime";
import { addNotification } from "@/lib/notifications";
import { OpenGameCard, OpenGameCardSkeleton } from "@/open-games";

const OpenGames = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [games, setGames] = useState<OpenGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState("All");
  const [selectedDistance, setSelectedDistance] = useState(5); // max 5 km default
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("UPI");
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Drawer & Modal States
  const [activeJoinGame, setActiveJoinGame] = useState<OpenGame | null>(null);
  const [joining, setJoining] = useState(false);
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [manageGame, setManageGame] = useState<OpenGame | null>(null); // host management

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${date}`;
  };

  // Host Form State
  const [hostSport, setHostSport] = useState("Cricket");
  const [hostVenue, setHostVenue] = useState("");
  const [hostDate, setHostDate] = useState(getLocalDateString());
  const [hostTime, setHostTime] = useState("19:00");
  const [hostDuration, setHostDuration] = useState(1);
  const [hostSlots, setHostSlots] = useState(10);
  const [hostAmount, setHostAmount] = useState(1000);
  const [hostIsPrivate, setHostIsPrivate] = useState(false);
  const [hosting, setHosting] = useState(false);

  // Find current active join game player status
  const activePlayerRecord = useMemo(() => {
    if (!user || !activeJoinGame) return null;
    return activeJoinGame.players.find((p) => p.user_id === user.user_id || p.name === user.name);
  }, [user, activeJoinGame]);
  const activePlayerStatus = activePlayerRecord?.payment_status || null;
  const isApprovedForPrivate = activePlayerStatus === "approved";

  // Request user location on mount for distance sorting/filtering
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("Geolocation access denied or failed:", error);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    }
  }, []);

  // Fetch games list (real distance filtering happens in the API).
  const fetchGames = useCallback(async () => {
    try {
      const data = await api.listOpenGames({
        sport: selectedSport,
        maxDistance: selectedDistance,
        date: selectedDate || undefined,
        userLocation: userLocation || undefined,
      });
      setGames(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedSport, selectedDistance, selectedDate, userLocation]);

  useEffect(() => {
    api.listTurfs().then((data) => {
      setTurfs(data);
      if (data.length > 0 && !hostVenue) setHostVenue(data[0].id);
    }).catch(console.error);
  }, []);

  // Live feed: realtime subscription + a 15s polling safety-net so a newly
  // hosted game reliably appears for EVERY viewer (including anonymous users
  // and clients whose realtime connection dropped). We also refetch whenever
  // the tab regains focus, so returning users always see fresh data.
  useRealtimeOpenGames(fetchGames);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Polling safety-net (every 15s). Cheap read; compensates for any missed
  // realtime events, especially for unauthenticated/anon viewers.
  useEffect(() => {
    const interval = setInterval(fetchGames, 15000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  // Refetch when the tab becomes visible again (user returns to the app).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchGames();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchGames]);

  // Match game venue to turf ID and navigate to detail page
  const handleCardClick = (g: OpenGame) => {
    const turfId = g.turf_id || turfs.find((t) => t.id === g.turf_id)?.id || "turf_1";
    navigate(`/turf/${turfId}`, { state: { joinGameId: g.id } });
  };

  // Open the Join drawer instead of navigating away. (Old bug: Join always
  // navigated, so the payment drawer was unreachable from this page.)
  const handleJoinClick = (g: OpenGame) => {
    setActiveJoinGame(g);
  };

  // Handle Join (public game) — pays the share.
  const handleJoin = async (gameId: string) => {
    if (!user) {
      toast.error("Please sign in to join games.");
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    setJoining(true);
    try {
      const { game: updated, booking } = await api.joinOpenGame(gameId, selectedPaymentMethod);
      trackEvent("open_game_joined", { game_id: gameId, private: !!updated.is_private });

      // REAL notification via the notifications module (not the beta-user hack).
      addNotification({
        type: "booking_confirmed",
        title: "You're in! 🎉",
        body: `You joined ${updated.sport} at ${updated.venue}. Game is on!`,
        booking_id: booking?.id,
        deepLink: booking ? `/booking/${booking.id}` : undefined,
      });

      setActiveJoinGame(null);
      if (booking) {
        navigate(`/booking/${booking.id}`);
      } else {
        await fetchGames();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setJoining(false);
    }
  };

  // Handle Request (private game)
  const handleRequestJoin = async (gameId: string) => {
    if (!user) {
      toast.error("Please sign in to request an invite.");
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    setJoining(true);
    try {
      await api.requestJoinOpenGame(gameId);
      trackEvent("open_game_requested", { game_id: gameId });
      addNotification({
        type: "booking_confirmed",
        title: "Request sent ✉️",
        body: "Your request was sent to the host. You'll be notified when it's approved.",
        deepLink: "/open-games",
      });
      setActiveJoinGame(null);
      await fetchGames();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setJoining(false);
    }
  };

  // Handle Pay Share (private game after host approval)
  const handlePayShare = async (gameId: string) => {
    if (!user) {
      toast.error("Please sign in to complete payment.");
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    setJoining(true);
    try {
      const { game: updated, booking } = await api.payPrivateGameShare(gameId, selectedPaymentMethod);
      trackEvent("open_game_private_paid", { game_id: gameId });

      addNotification({
        type: "booking_confirmed",
        title: "Payment successful! 💳",
        body: `You are confirmed for ${updated.sport} at ${updated.venue}.`,
        booking_id: booking?.id,
        deepLink: booking ? `/booking/${booking.id}` : undefined,
      });

      setActiveJoinGame(null);
      if (booking) {
        navigate(`/booking/${booking.id}`);
      } else {
        await fetchGames();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setJoining(false);
    }
  };

  // Leave a game (player self-service)
  const handleLeave = async (gameId: string) => {
    try {
      await api.leaveOpenGame(gameId);
      addNotification({
        type: "booking_cancelled",
        title: "Left game",
        body: "You left the open game. Your share was refunded.",
      });
      setManageGame(null);
      await fetchGames();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Cancel a game (host only)
  const handleCancelGame = async (gameId: string) => {
    try {
      await api.cancelOpenGame(gameId);
      toast.success("Game cancelled. All players will be refunded.");
      addNotification({
        type: "booking_cancelled",
        title: "Game cancelled",
        body: "Your open game was cancelled and all players were refunded.",
      });
      setManageGame(null);
      await fetchGames();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Host: approve / reject a pending request
  const handleApprove = async (gameId: string, playerId: string) => {
    try {
      await api.approveJoinRequest(gameId, playerId);
      toast.success("Player approved.");
      await fetchGames();
      // refresh management modal
      const fresh = await api.getOpenGame(gameId);
      if (fresh) setManageGame(fresh);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const handleReject = async (gameId: string, playerId: string) => {
    try {
      await api.rejectJoinRequest(gameId, playerId);
      toast.success("Request rejected.");
      await fetchGames();
      const fresh = await api.getOpenGame(gameId);
      if (fresh) setManageGame(fresh);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Handle Host Game submit
  const handleHostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to host a game.");
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    setHosting(true);

    const matchedTurf = turfs.find((t) => t.id === hostVenue) || turfs[0];
    const turfId = matchedTurf?.id || "turf_1";
    const turfName = matchedTurf?.name || hostVenue;

    try {
      const { game: hosted, booking } = await api.hostOpenGame({
        sport: hostSport,
        venue: turfName,
        turf_id: turfId,
        turf_image: matchedTurf?.image,
        date: hostDate,
        time: hostTime,
        duration_hours: hostDuration,
        slots_total: hostSlots,
        total_amount: hostAmount,
        cancellation_policy: "Refundable up to 2 hours before game start.",
        is_private: hostIsPrivate,
        lat: matchedTurf?.lat,
        lng: matchedTurf?.lng,
      });
      trackEvent("open_game_hosted", { game_id: hosted?.id ?? "unknown", private: hostIsPrivate });
      addNotification({
        type: "booking_confirmed",
        title: "Game published 🎉",
        body: `Your ${hostSport} game at ${turfName} is live. Players can now join.`,
        booking_id: booking?.id,
        deepLink: booking?.id ? `/booking/${booking.id}` : "/open-games",
      });

      setHostModalOpen(false);
      setHostIsPrivate(false);
      if (booking?.id) {
        toast.success("Game hosted successfully! Redirecting to receipt...");
        navigate(`/booking/${booking.id}`);
      } else {
        // Booking couldn't be read back — keep the user on the page and
        // refresh so they see their newly published game.
        toast.success("Game published! Players can now join.");
        await fetchGames();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHosting(false);
    }
  };

  // Is the current user a participant of a given game?
  const isPlayerOf = (g: OpenGame) =>
    !!user && g.players.some((p) => p.name === user.name || g.host_user_id === user.user_id);

  return (
    <MobileShell>
      <AppHeader />

      {/* Title & Floating Host Trigger */}
      <div className="px-4 mt-6 flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight text-foreground bg-gradient-to-r from-white via-slate-200 to-primary bg-clip-text text-transparent">
            Open Games
          </h1>
          <p className="text-textMuted text-xs mt-1 font-medium">Join open slots & split court costs instantly</p>
        </div>
        <button
          onClick={() => setHostModalOpen(true)}
          className="btn-primary shadow-neon gap-1.5 pressable cursor-pointer border-none text-xs"
        >
          <PlusCircle className="h-4.5 w-4.5" /> Host Game
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <section className="px-4 mt-6" aria-label="Filters">
        <div className="glass rounded-3xl p-4 flex flex-col gap-3.5 shadow-card border-border/40">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {["All", "Cricket", "Football", "Basketball"].map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all border duration-200 ${
                  selectedSport === sport
                    ? "bg-primary border-transparent text-primary-foreground shadow-neon"
                    : "bg-surface/50 border-border/60 text-textMuted hover:text-foreground hover:border-primary/40"
                } cursor-pointer`}
              >
                {sport}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 mt-1">
            {/* Distance Slider */}
            <div className="flex-1">
              <label htmlFor="distance-slider" className="text-[10px] font-black uppercase tracking-widest text-textMuted block mb-1.5">
                Distance: <span className="text-primary font-bold">{selectedDistance} km</span> radius
              </label>
              <input
                id="distance-slider"
                type="range"
                min="1"
                max="10"
                value={selectedDistance}
                onChange={(e) => setSelectedDistance(Number(e.target.value))}
                className="w-full accent-primary h-1.5 rounded-lg bg-surface border border-border/20 outline-none cursor-pointer"
              />
            </div>

            {/* Date Input */}
            <div className="w-1/2">
              <label htmlFor="date-filter" className="text-[10px] font-black uppercase tracking-widest text-textMuted block mb-1.5">
                Filter Date
              </label>
              <input
                id="date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full app-input text-xs border border-border rounded-xl px-2 py-1.5 text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Game Card Feed ── */}
      <div className="px-4 mt-6 flex flex-col gap-3">
        {loading ? (
          <>
            <OpenGameCardSkeleton index={0} />
            <OpenGameCardSkeleton index={1} />
            <OpenGameCardSkeleton index={2} />
          </>
        ) : games.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-3xl p-8 text-center flex flex-col items-center gap-4 mt-2 border-border/40"
          >
            <Users className="h-12 w-12 text-textMuted/30 animate-pulse" />
            <div>
              <h3 className="font-display font-bold text-base text-foreground">No open games nearby</h3>
              <p className="text-xs text-textMuted mt-1 leading-relaxed max-w-[240px] mx-auto">
                Be the first to create one! Host a session and invite other players.
              </p>
            </div>
            <button
              onClick={() => setHostModalOpen(true)}
              className="btn-primary shadow-neon px-6 py-3 pressable cursor-pointer border-none text-xs"
            >
              Host one yourself
            </button>
          </motion.div>
        ) : (
          games.map((g, i) => {
            const progress = (g.slots_filled / g.slots_total) * 100;
            const isFull = g.status === "full";
            const isCancelled = g.status === "cancelled";
            const myPlayerRecord = user
              ? g.players.find((p) => p.user_id === user.user_id || p.name === user.name)
              : null;
            const myStatus = myPlayerRecord?.payment_status || null;
            const youAreHost = !!user && g.host_user_id === user.user_id;
            const youAreIn = youAreHost || myStatus === "paid";
            const youArePending = myStatus === "requested";
            const youAreApproved = myStatus === "approved";
            const pendingRequests = g.players.filter((p) => p.payment_status === "requested");

            // Resolve cover image
            const coverImage =
              turfs.find((t) => t.id === g.turf_id)?.image ??
              turfs.find((t) => g.venue.toLowerCase().includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(g.venue.split(",")[0].toLowerCase()))?.image ??
              "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200";

            const matchedTurf = turfs.find((t) => t.id === g.turf_id);
            const turfSurface = matchedTurf?.sport_types?.some((s) => s.toLowerCase().includes("indoor")) ? "Indoor" : "Outdoor";

            return (
              <OpenGameCard
                key={g.id}
                game={g}
                turfImage={coverImage}
                turfSurface={turfSurface}
                index={i}
                user={user}
                onCardClick={() => setManageGame(g)}
                onJoinClick={(e) => {
                  e.stopPropagation();
                  handleJoinClick(g);
                }}
                onManageClick={(e) => {
                  e.stopPropagation();
                  setManageGame(g);
                }}
              />
            );
          })
        )}
      </div>

      <div className="h-6" />

      {/* ── Join Payment Drawer ── */}
      <AnimatePresence>
        {activeJoinGame && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveJoinGame(null)}
              className="fixed inset-0 z-[45] bg-black/70 backdrop-blur-sm"
              style={{ maxWidth: "480px", left: "50%", transform: "translateX(-50%)" }}
            />
            <motion.div
              initial={{ y: "100%", x: "-50%" }}
              animate={{ y: 0, x: "-50%" }}
              exit={{ y: "100%", x: "-50%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] bg-card rounded-t-[2rem] border-t border-border p-5 space-y-4"
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="font-display font-bold text-foreground text-base">
                    Confirm your spot
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round(activeJoinGame.slots_total / 2)}-a-side {activeJoinGame.sport.toLowerCase()} • {activeJoinGame.date === new Date().toISOString().slice(0, 10) ? "today" : activeJoinGame.date}, {activeJoinGame.time.toLowerCase()}
                  </p>
                </div>
                <button
                  onClick={() => setActiveJoinGame(null)}
                  className="p-1 hover:bg-muted rounded-full cursor-pointer text-muted-foreground hover:text-foreground border-none bg-transparent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Show the math */}
              <div className="bg-panel-2 p-4 rounded-2xl space-y-3.5 text-sm">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>total slot price</span>
                  <span className="font-semibold text-foreground">₹{activeJoinGame.total_amount}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>split across</span>
                  <span className="font-semibold text-foreground">{activeJoinGame.slots_total} players</span>
                </div>
                <div className="h-[1px] bg-border my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-foreground font-semibold">your share</span>
                  <span className="text-xl font-bold text-foreground">₹{activeJoinGame.price_per_slot}</span>
                </div>
              </div>

              {isApprovedForPrivate && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl flex items-start gap-2.5">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Invite Approved!</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed font-semibold">
                      The host approved your request. Pay below to confirm your spot.
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Methods — only for public games or approved private requests */}
              {(!activeJoinGame.is_private || isApprovedForPrivate) && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">
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
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer bg-transparent ${
                            isSelected
                              ? "border-primary text-primary bg-primary/5"
                              : "border-border text-muted2 hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5 mb-1" />
                          <span className="text-[10px] font-bold">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pay / Request button */}
              <div>
                {(!activeJoinGame.is_private || isApprovedForPrivate) && (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs my-3">
                    <Lock className="h-4 w-4 text-muted-foreground/70" />
                    <span>secure payment via UPI / card</span>
                  </div>
                )}

                <button
                  disabled={joining}
                  onClick={() => {
                    if (isApprovedForPrivate) {
                      handlePayShare(activeJoinGame.id);
                    } else if (activeJoinGame.is_private) {
                      handleRequestJoin(activeJoinGame.id);
                    } else {
                      handleJoin(activeJoinGame.id);
                    }
                  }}
                  className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-sm transition border-none cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  {joining ? (
                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin border-primary-foreground" />
                  ) : isApprovedForPrivate ? (
                    `Pay ₹${activeJoinGame.price_per_slot} and join ↗`
                  ) : activeJoinGame.is_private ? (
                    "Send Join Request ↗"
                  ) : (
                    `Pay ₹${activeJoinGame.price_per_slot} and join ↗`
                  )}
                </button>

                <p className="text-muted-foreground text-[11px] text-center mt-3.5">
                  free cancellation up to 6 hours before
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Host / Player Management Modal ── */}
      <AnimatePresence>
        {manageGame && (() => {
          const myPlayerRecord = user
            ? manageGame.players.find((p) => p.user_id === user.user_id || p.name === user.name)
            : null;
          const myStatus = myPlayerRecord?.payment_status || null;
          const youAreHost = !!user && manageGame.host_user_id === user.user_id;
          const youAreIn = youAreHost || myStatus === "paid";
          const youArePending = myStatus === "requested";
          const youAreApproved = myStatus === "approved";
          const pendingRequests = manageGame.players.filter((p) => p.payment_status === "requested");
          const isFull = manageGame.slots_filled >= manageGame.slots_total;
          const isCancelled = manageGame.status === "cancelled";

          return (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setManageGame(null)}
                className="fixed inset-0 z-[49] bg-black/70 backdrop-blur-sm"
                style={{ maxWidth: "480px", left: "50%", transform: "translateX(-50%)" }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: "-40%", x: "-50%" }}
                animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
                exit={{ opacity: 0, scale: 0.9, y: "-40%", x: "-50%" }}
                className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-[400px] bg-card rounded-[2rem] border border-border p-5 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="font-display font-black text-base flex items-center gap-1.5 text-foreground">
                    <Users className="h-5 w-5 text-primary" /> {youAreHost ? "Manage Game" : "Game Details"}
                  </h3>
                  <button
                    onClick={() => setManageGame(null)}
                    className="p-1 hover:bg-muted rounded-full cursor-pointer text-muted-foreground hover:text-foreground border-none bg-transparent"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="bg-panel-2 border border-border p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-foreground">{Math.round(manageGame.slots_total / 2)}-a-side {manageGame.sport.toLowerCase()}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{manageGame.venue}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span>{manageGame.date === new Date().toISOString().slice(0, 10) ? "Today" : manageGame.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span>{manageGame.time} ({manageGame.duration_hours ? manageGame.duration_hours * 60 : 60} mins)</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>Slot price:</span>
                    <span className="font-bold text-foreground text-sm">₹{manageGame.price_per_slot}</span>
                  </div>
                </div>

                {/* Player list */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                    Players ({manageGame.players.filter((p) => p.payment_status !== "requested").length} / {manageGame.slots_total})
                  </span>
                  <div className="flex flex-wrap gap-2.5 max-h-24 overflow-y-auto no-scrollbar">
                    {manageGame.players
                      .filter((p) => p.payment_status !== "requested")
                      .map((p, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-1.5 bg-panel-2 border px-2.5 py-1 rounded-full shrink-0 ${
                            p.payment_status === "approved" ? "border-amber-500/30 bg-amber-500/5" : "border-border"
                          }`}
                        >
                          <img src={p.avatar} alt={p.name} className="w-4 h-4 rounded-full" />
                          <span className="text-[11px] font-bold text-foreground">{p.name.split(" ")[0]}</span>
                          {p.is_host && <span className="text-[8px] text-primary font-black">HOST</span>}
                          {p.payment_status === "approved" && (
                            <>
                              <span className="text-[8px] text-amber-400 font-black">UNPAID</span>
                              {youAreHost && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Cancel invitation and remove player ${p.name}?`)) {
                                      handleReject(manageGame.id, p.id!);
                                    }
                                  }}
                                  className="p-0.5 hover:bg-muted rounded-full cursor-pointer text-red-400 hover:text-red-300 border-none bg-transparent flex items-center justify-center ml-1"
                                  title="Remove approval"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Pending requests — host can approve/reject */}
                {youAreHost && pendingRequests.length > 0 && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                      Pending Requests
                    </span>
                    {pendingRequests.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded-2xl px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <img src={p.avatar} alt={p.name} className="w-6 h-6 rounded-full" />
                          <span className="text-xs font-bold text-foreground">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleApprove(manageGame.id, p.id!)}
                            className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full cursor-pointer"
                            title="Approve"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleReject(manageGame.id, p.id!)}
                            className="p-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full cursor-pointer"
                            title="Reject"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chat placeholder ── only for joined players */}
                {youAreIn && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                      Group Chat & Host
                    </span>
                    <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                          <h5 className="font-bold text-xs text-foreground">In-App Chat Thread</h5>
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">Discuss team colors & match rules</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toast.success("Joined chat! Messaging is simulated in this sandbox.")}
                        className="p-2 bg-primary rounded-full pressable cursor-pointer border-none"
                      >
                        <ChevronRight className="h-4.5 w-4.5 text-primary-foreground" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Action button inside details modal for non-joined players */}
                {!youAreIn && (
                  <div className="border-t border-border pt-3.5">
                    {youAreApproved ? (
                      <button
                        onClick={() => {
                          setManageGame(null);
                          handleJoinClick(manageGame);
                        }}
                        className="w-full py-3 rounded-2xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs uppercase tracking-wider transition border-none cursor-pointer flex items-center justify-center gap-1.5 animate-pulse-glow"
                      >
                        Pay & Join ↗
                      </button>
                    ) : youArePending ? (
                      <button
                        disabled
                        className="w-full py-3 rounded-2xl bg-panel-2 text-muted-foreground font-bold text-xs uppercase tracking-wider border border-border cursor-not-allowed flex items-center justify-center"
                      >
                        Pending Host Approval
                      </button>
                    ) : (
                      <button
                        disabled={isFull || isCancelled}
                        onClick={() => {
                          setManageGame(null);
                          handleJoinClick(manageGame);
                        }}
                        className={`w-full py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition border-none cursor-pointer flex items-center justify-center gap-1 ${
                          isFull || isCancelled
                            ? "bg-panel-2 text-muted-foreground cursor-not-allowed"
                            : "bg-primary hover:bg-primary/95 text-primary-foreground"
                        }`}
                      >
                        {isFull ? "Game Full" : isCancelled ? "Cancelled" : manageGame.is_private ? "Request Invite ↗" : "Join Game ↗"}
                      </button>
                    )}
                  </div>
                )}

                {/* Player: leave */}
                {!youAreHost && youAreIn && (
                  <div className="border-t border-border pt-3.5">
                    <button
                      onClick={() => {
                        if (confirm("Leave this game? Your share will be refunded.")) {
                          handleLeave(manageGame.id);
                        }
                      }}
                      className="w-full py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs uppercase tracking-wider pressable cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="h-4 w-4" /> Leave Game
                    </button>
                  </div>
                )}

                {/* Host: cancel game */}
                {youAreHost && (
                  <div className="border-t border-border pt-3.5">
                    <button
                      onClick={() => {
                        if (confirm("Cancel this game? All players will be refunded.")) {
                          handleCancelGame(manageGame.id);
                        }
                      }}
                      className="w-full py-2.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-xs uppercase tracking-wider pressable cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <UserMinus className="h-4 w-4" /> Cancel Hosted Game
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* ── Host Game Dialog (3-tap Flow) ── */}
      <AnimatePresence>
        {hostModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setHostModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              style={{ maxWidth: "480px", left: "50%", transform: "translateX(-50%)" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: "-40%", x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, y: "-40%", x: "-50%" }}
              className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-[420px] bg-card rounded-[2rem] border border-border p-5 shadow-2xl overflow-y-auto max-h-[90dvh]"
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="font-display font-black text-base flex items-center gap-1.5 text-foreground">
                  <PlusCircle className="h-5 w-5 text-primary" /> Host Open Game
                </h3>
                <button
                  onClick={() => setHostModalOpen(false)}
                  className="p-1 hover:bg-muted rounded-full cursor-pointer text-muted-foreground hover:text-foreground border-none bg-transparent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleHostSubmit} className="space-y-4 mt-3">
                {/* Step 1: Sport and Venue */}
                <div className="space-y-3 text-left">
                  <span className="text-[10px] font-black uppercase text-primary tracking-widest">
                    Step 1: Game Details
                  </span>

                  <div>
                    <label htmlFor="host-sport-select" className="text-xs font-semibold text-soft block mb-1">Select Sport</label>
                    <select
                      id="host-sport-select"
                      value={hostSport}
                      onChange={(e) => setHostSport(e.target.value)}
                      className="w-full bg-panel-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    >
                      <option value="Cricket">Cricket</option>
                      <option value="Football">Football</option>
                      <option value="Basketball">Basketball</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="host-venue-select" className="text-xs font-semibold text-soft block mb-1">Select Venue</label>
                    <select
                      id="host-venue-select"
                      value={hostVenue}
                      onChange={(e) => setHostVenue(e.target.value)}
                      className="w-full bg-panel-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    >
                      {turfs.length > 0 ? (
                        turfs.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.city})
                          </option>
                        ))
                      ) : (
                        <option value="">Loading venues…</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Step 2: Schedule */}
                <div className="space-y-3 text-left border-t border-border pt-3">
                  <span className="text-[10px] font-black uppercase text-primary tracking-widest">
                    Step 2: Schedule
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="host-date-input" className="text-xs font-semibold text-soft block mb-1">Date</label>
                      <input
                        id="host-date-input"
                        type="date"
                        value={hostDate}
                        onChange={(e) => setHostDate(e.target.value)}
                        className="w-full bg-panel-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="host-time-input" className="text-xs font-semibold text-soft block mb-1">Time (24h)</label>
                      <input
                        id="host-time-input"
                        type="time"
                        value={hostTime}
                        onChange={(e) => setHostTime(e.target.value)}
                        className="w-full bg-panel-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="host-duration-input" className="text-xs font-semibold text-soft block mb-1">Duration (hours)</label>
                    <input
                      id="host-duration-input"
                      type="number"
                      min="1"
                      max="4"
                      value={hostDuration}
                      onChange={(e) => setHostDuration(Number(e.target.value))}
                      className="w-full bg-panel-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Step 3: Cost Splits & Max Slots */}
                <div className="space-y-3 text-left border-t border-border pt-3">
                  <span className="text-[10px] font-black uppercase text-primary tracking-widest">
                    Step 3: Cost Division
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="host-slots-input" className="text-xs font-semibold text-soft block mb-1">Max Players (Slots)</label>
                      <input
                        id="host-slots-input"
                        type="number"
                        min="2"
                        max="24"
                        value={hostSlots}
                        onChange={(e) => setHostSlots(Number(e.target.value))}
                        className="w-full bg-panel-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="host-amount-input" className="text-xs font-semibold text-soft block mb-1">Total Court Fee (₹)</label>
                      <input
                        id="host-amount-input"
                        type="number"
                        min="100"
                        value={hostAmount}
                        onChange={(e) => setHostAmount(Number(e.target.value))}
                        className="w-full bg-panel-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Split Math Preview */}
                  <div className="bg-primary/5 border border-primary/20 p-3 rounded-2xl flex items-center justify-between text-xs font-semibold mt-2">
                    <span className="text-muted-foreground">Individual Slot Split:</span>
                    <span className="text-sm font-black text-primary">
                      ₹{Math.round(hostAmount / Math.max(1, hostSlots))} / slot
                    </span>
                  </div>

                  {/* Game Type: Public or Private */}
                  <div className="mt-3">
                    <label htmlFor="host-privacy-select" className="text-xs font-semibold text-soft block mb-1">Game Type (Privacy)</label>
                    <select
                      id="host-privacy-select"
                      value={hostIsPrivate ? "private" : "public"}
                      onChange={(e) => setHostIsPrivate(e.target.value === "private")}
                      className="w-full bg-panel-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    >
                      <option value="public">Public (Instant Join)</option>
                      <option value="private">Private (Requires Host Approval)</option>
                    </select>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  disabled={hosting}
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-neon text-primary-foreground font-black text-xs uppercase tracking-widest shadow-neon pressable cursor-pointer border-none flex items-center justify-center min-h-[44px]"
                >
                  {hosting ? (
                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin border-primary-foreground" />
                  ) : (
                    "Publish Hosted Game"
                  )}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </MobileShell>
  );
};

export default OpenGames;
