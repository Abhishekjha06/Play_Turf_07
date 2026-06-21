import { useEffect, useState, useMemo } from "react";
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
  MapPin,
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

  // Drawer & Modal States
  const [activeJoinGame, setActiveJoinGame] = useState<OpenGame | null>(null);
  const [joining, setJoining] = useState(false);
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [manageGame, setManageGame] = useState<OpenGame | null>(null); // host management

  // Host Form State
  const [hostSport, setHostSport] = useState("Cricket");
  const [hostVenue, setHostVenue] = useState("");
  const [hostDate, setHostDate] = useState(new Date().toISOString().slice(0, 10));
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

  // Fetch games list (real distance filtering happens in the API).
  const fetchGames = async () => {
    try {
      const data = await api.listOpenGames({
        sport: selectedSport,
        maxDistance: selectedDistance,
        date: selectedDate || undefined,
      });
      setGames(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSport, selectedDistance, selectedDate]);

  // Polling safety-net (every 15s). Cheap read; compensates for any missed
  // realtime events, especially for unauthenticated/anon viewers.
  useEffect(() => {
    const interval = setInterval(fetchGames, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSport, selectedDistance, selectedDate]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="px-4 mt-4 flex items-center justify-between">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Open Games</h1>
          <p className="text-muted2 text-xs">Join open slots & split court costs</p>
        </div>
        <button
          onClick={() => setHostModalOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-black uppercase tracking-wider rounded-full px-4 py-2.5 shadow-neon flex items-center gap-1.5 pressable cursor-pointer border-none"
        >
          <PlusCircle className="h-4.5 w-4.5" /> Host Game
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <section className="px-4 mt-4" aria-label="Filters">
        <div className="card-panel rounded-3xl p-3 flex flex-col gap-2.5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {["All", "Cricket", "Football"].map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                  selectedSport === sport
                    ? "bg-primary border-transparent text-primary-foreground"
                    : "bg-panel-2 border-white/5 text-muted2 hover:text-foreground"
                } cursor-pointer`}
              >
                {sport}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* Distance Slider */}
            <div className="flex-1">
              <label htmlFor="distance-slider" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                Distance: {selectedDistance} km radius
              </label>
              <input
                id="distance-slider"
                type="range"
                min="1"
                max="10"
                value={selectedDistance}
                onChange={(e) => setSelectedDistance(Number(e.target.value))}
                className="w-full accent-primary h-1 rounded-lg bg-panel-3 outline-none cursor-pointer"
              />
            </div>

            {/* Date Input */}
            <div className="w-1/2">
              <label htmlFor="date-filter" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                Filter Date
              </label>
              <input
                id="date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-panel-2 text-xs border border-white/5 rounded-xl px-2 py-1.5 text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Game Card Feed ── */}
      <div className="px-4 mt-5 flex flex-col gap-3.5">
        {loading ? (
          <div className="text-center py-20 text-soft">Loading matches...</div>
        ) : games.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card-panel rounded-3xl p-8 text-center flex flex-col items-center gap-4 mt-2"
          >
            <Users className="h-12 w-12 text-muted-foreground/30 animate-pulse" />
            <div>
              <h3 className="font-display font-bold text-base">No open games nearby</h3>
              <p className="text-xs text-muted2 mt-1 leading-relaxed">
                Be the first to create one! Host a session and invite other players.
              </p>
            </div>
            <button
              onClick={() => setHostModalOpen(true)}
              className="bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider rounded-full px-6 py-3.5 shadow-neon pressable cursor-pointer border-none"
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

            return (
              <motion.article
                key={g.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-panel rounded-3xl p-4 flex flex-col gap-3 relative overflow-hidden"
              >
                {!isFull && !isCancelled && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                )}

                {/* Top Row */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-black text-base text-foreground leading-tight">
                      {g.sport} Match
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-semibold inline-flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {g.venue}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {isCancelled ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase bg-red-500/10 border border-red-500/30 text-red-400 px-2.5 py-0.5 rounded-full">
                        <AlertCircle className="w-2.5 h-2.5" /> Cancelled
                      </span>
                    ) : isFull ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase bg-zinc-800 border border-zinc-700 text-zinc-400 px-2.5 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" /> Full
                      </span>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded-full">
                          <CheckCircle className="w-2.5 h-2.5" /> Open
                        </span>
                        {g.is_private ? (
                          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2.5 py-0.5 rounded-full mt-0.5">
                            🔒 Private (Invite)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase bg-sky-500/10 border border-sky-500/30 text-sky-400 px-2.5 py-0.5 rounded-full mt-0.5">
                            🌐 Public
                          </span>
                        )}
                      </div>
                    )}

                    {g.distance > 0 && (
                      <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {g.distance} km away
                      </span>
                    )}
                  </div>
                </div>

                {/* Date & Time */}
                <div className="flex items-center gap-3 text-xs text-soft">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {g.date}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {g.time}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted2 uppercase tracking-wide">
                    <span>Slots Filled</span>
                    <span className="text-foreground font-black">
                      {g.slots_filled} / {g.slots_total} Joined
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-panel-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFull ? "bg-zinc-600" : "bg-gradient-neon shadow-neon"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Host Card Section */}
                <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                  <div className="flex items-center gap-2">
                    <img
                      src={g.host_avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop"}
                      alt="Host"
                      className="w-7 h-7 rounded-full border border-white/10"
                    />
                    <div>
                      <p className="text-[10px] text-muted-foreground leading-none">Hosted by</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">{g.host_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[9px] text-muted-foreground uppercase leading-none">Price per slot</p>
                      <p className="text-base font-black text-foreground mt-0.5">₹{g.price_per_slot}</p>
                    </div>

                    {/* Primary action depends on the user's relationship to the game */}
                    {youAreIn ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setManageGame(g);
                        }}
                        className="px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition shadow-neon cursor-pointer border-none bg-panel-2 text-foreground"
                      >
                        {youAreHost ? "Manage" : "Joined"}
                      </button>
                    ) : youAreApproved ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinClick(g);
                        }}
                        className="px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition shadow-neon cursor-pointer border-none bg-gradient-neon text-primary-foreground font-black animate-pulse"
                      >
                        Pay & Join
                      </button>
                    ) : youArePending ? (
                      <button
                        disabled
                        className="px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition border-none bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      >
                        Pending Host
                      </button>
                    ) : (
                      <button
                        disabled={isFull || isCancelled}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinClick(g);
                        }}
                        className={`px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition shadow-neon cursor-pointer border-none ${
                          isFull || isCancelled
                            ? "bg-zinc-800 text-zinc-500 shadow-none cursor-not-allowed"
                            : "bg-gradient-neon text-primary-foreground"
                        }`}
                      >
                        {isFull ? "Full" : isCancelled ? "Cancelled" : g.is_private ? "Request Invite" : "Join Game"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Pending requests banner for host */}
                {youAreHost && pendingRequests.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setManageGame(g);
                    }}
                    className="text-left w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl px-3 py-2 flex items-center gap-2"
                  >
                    <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-[11px] font-bold text-amber-300">
                      {pendingRequests.length} join request{pendingRequests.length > 1 ? "s" : ""} awaiting your approval
                    </span>
                    <ChevronRight className="h-4 w-4 text-amber-400 ml-auto" />
                  </button>
                )}
              </motion.article>
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
              className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] bg-panel rounded-t-[2rem] border-t border-white/10 p-5 space-y-4"
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div>
                  <h3 className="font-display font-black text-base">
                    {activeJoinGame.is_private ? "Request Invite" : "Split Payment & Join"}
                  </h3>
                  <p className="text-xs text-muted-foreground">{activeJoinGame.sport} Match • {activeJoinGame.venue}</p>
                </div>
                <button
                  onClick={() => setActiveJoinGame(null)}
                  className="p-1 hover:bg-white/10 rounded-full cursor-pointer text-muted-foreground hover:text-foreground border-none bg-transparent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Show the math */}
              <div className="bg-panel-2 border border-white/5 p-4 rounded-2xl space-y-2 text-sm font-semibold">
                <div className="flex justify-between items-center text-xs text-muted-foreground uppercase tracking-wide">
                  <span>Court Booking Total:</span>
                  <span className="font-black text-foreground">₹{activeJoinGame.total_amount}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground uppercase tracking-wide">
                  <span>Split Count (Total Slots):</span>
                  <span className="font-black text-foreground">{activeJoinGame.slots_total} players</span>
                </div>
                <div className="h-[1px] border-t border-white/5 my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Your Individual Share:</span>
                  <span className="text-lg font-black text-primary font-display">₹{activeJoinGame.price_per_slot}</span>
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

              {/* Cancellation Policy */}
              <div className="flex gap-2 bg-yellow-500/5 border border-yellow-500/20 p-3 rounded-2xl">
                <AlertCircle className="h-4.5 w-4.5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black uppercase text-yellow-500 tracking-wider">Cancellation Policy</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed font-semibold">
                    {activeJoinGame.cancellation_policy}
                  </p>
                </div>
              </div>

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
                              : "border-white/5 text-muted2 hover:text-foreground"
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
              <div className="space-y-3">
                {(!activeJoinGame.is_private || isApprovedForPrivate) && (
                  <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
                    <Lock className="h-3 w-3 text-primary animate-pulse" /> Secure 256-bit Encrypted Checkout
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
                  className="w-full py-3.5 rounded-full bg-gradient-neon text-primary-foreground font-black text-xs uppercase tracking-widest shadow-neon pressable cursor-pointer border-none flex items-center justify-center min-h-[44px]"
                >
                  {joining ? (
                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin border-primary-foreground" />
                  ) : isApprovedForPrivate ? (
                    `Pay ₹${activeJoinGame.price_per_slot} & Confirm Join`
                  ) : activeJoinGame.is_private ? (
                    "Send Join Request"
                  ) : (
                    `Pay ₹${activeJoinGame.price_per_slot} & Confirm Join`
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Host / Player Management Modal ── */}
      <AnimatePresence>
        {manageGame && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setManageGame(null)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              style={{ maxWidth: "480px", left: "50%", transform: "translateX(-50%)" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: "-40%", x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, y: "-40%", x: "-50%" }}
              className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-[400px] bg-panel rounded-[2rem] border border-white/10 p-5 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="font-display font-black text-base flex items-center gap-1.5">
                  <Users className="h-5 w-5 text-primary" /> Game Management
                </h3>
                <button
                  onClick={() => setManageGame(null)}
                  className="p-1 hover:bg-white/10 rounded-full cursor-pointer text-muted-foreground hover:text-foreground border-none bg-transparent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="bg-panel-2 border border-white/5 p-3 rounded-2xl flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">{manageGame.sport} Match</h4>
                  <p className="text-xs text-muted2 mt-0.5 truncate max-w-[240px]">{manageGame.venue}</p>
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
                          p.payment_status === "approved" ? "border-amber-500/30 bg-amber-500/5" : "border-white/5"
                        }`}
                      >
                        <img src={p.avatar} alt={p.name} className="w-4 h-4 rounded-full" />
                        <span className="text-[11px] font-bold text-foreground">{p.name.split(" ")[0]}</span>
                        {p.is_host && <span className="text-[8px] text-primary font-black">HOST</span>}
                        {p.payment_status === "approved" && (
                          <>
                            <span className="text-[8px] text-amber-400 font-black">UNPAID</span>
                            {manageGame.host_user_id === user?.user_id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Cancel invitation and remove player ${p.name}?`)) {
                                    handleReject(manageGame.id, p.id!);
                                  }
                                }}
                                className="p-0.5 hover:bg-white/10 rounded-full cursor-pointer text-red-400 hover:text-red-300 border-none bg-transparent flex items-center justify-center ml-1"
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
              {manageGame.host_user_id === user?.user_id &&
                manageGame.players.filter((p) => p.payment_status === "requested").length > 0 && (
                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                      Pending Requests
                    </span>
                    {manageGame.players
                      .filter((p) => p.payment_status === "requested")
                      .map((p) => (
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

              {/* Chat placeholder */}
              <div className="border-t border-white/5 pt-3 space-y-2">
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

              {/* Player: leave */}
              {manageGame.host_user_id !== user?.user_id && isPlayerOf(manageGame) && (
                <div className="border-t border-white/5 pt-3.5">
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
              {manageGame.host_user_id === user?.user_id && (
                <div className="border-t border-white/5 pt-3.5">
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
        )}
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
              className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-[420px] bg-panel rounded-[2rem] border border-white/10 p-5 shadow-2xl overflow-y-auto max-h-[90dvh]"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="font-display font-black text-base flex items-center gap-1.5">
                  <PlusCircle className="h-5 w-5 text-primary" /> Host Open Game
                </h3>
                <button
                  onClick={() => setHostModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full cursor-pointer text-muted-foreground hover:text-foreground border-none bg-transparent"
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
                      className="w-full bg-panel-2 border border-white/5 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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
                      className="w-full bg-panel-2 border border-white/5 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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
                <div className="space-y-3 text-left border-t border-white/5 pt-3">
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
                        className="w-full bg-panel-2 border border-white/5 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="host-time-input" className="text-xs font-semibold text-soft block mb-1">Time (24h)</label>
                      <input
                        id="host-time-input"
                        type="time"
                        value={hostTime}
                        onChange={(e) => setHostTime(e.target.value)}
                        className="w-full bg-panel-2 border border-white/5 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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
                      className="w-full bg-panel-2 border border-white/5 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Step 3: Cost Splits & Max Slots */}
                <div className="space-y-3 text-left border-t border-white/5 pt-3">
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
                        className="w-full bg-panel-2 border border-white/5 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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
                        className="w-full bg-panel-2 border border-white/5 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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
                      className="w-full bg-panel-2 border border-white/5 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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
