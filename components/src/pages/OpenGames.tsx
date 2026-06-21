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
  MessageSquare,
  AlertCircle,
  PlusCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  User,
  Info,
  CreditCard,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { pageEnter, staggerContainer, fadeSlideUp } from "@/lib/motion";
import { useRealtimeOpenGames } from "@/lib/realtime";

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
  const [successGame, setSuccessGame] = useState<OpenGame | null>(null);
  const [hostModalOpen, setHostModalOpen] = useState(false);

  // Host Form State
  const [hostSport, setHostSport] = useState("Cricket");
  const [hostVenue, setHostVenue] = useState("BoxCric Cage, Indiranagar");
  const [hostDate, setHostDate] = useState(new Date().toISOString().slice(0, 10));
  const [hostTime, setHostTime] = useState("07:00 PM");
  const [hostSlots, setHostSlots] = useState(10);
  const [hostAmount, setHostAmount] = useState(1000);
  const [hostIsPrivate, setHostIsPrivate] = useState(false);
  const [hosting, setHosting] = useState(false);

  // Fetch games list
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
    api.listTurfs().then(setTurfs).catch(console.error);
  }, []);

  // Listen for database realtime changes on open games
  useRealtimeOpenGames(fetchGames);

  useEffect(() => {
    fetchGames();
    // Simulate periodic polling update for real-time slots (refetch every 10 seconds)
    const interval = setInterval(fetchGames, 10000);
    return () => clearInterval(interval);
  }, [selectedSport, selectedDistance, selectedDate]);

  // Match game venue to turf ID and navigate to detail page
  const handleCardClick = (g: OpenGame) => {
    const match = turfs.find(t => 
      g.venue.toLowerCase().includes(t.name.toLowerCase()) || 
      t.name.toLowerCase().includes(g.venue.toLowerCase())
    );
    const turfId = match ? match.id : "turf_1";
    navigate(`/turf/${turfId}`, { state: { joinGameId: g.id } });
  };

  // Handle Join game
  const handleJoin = async (gameId: string) => {
    if (!user) {
      toast.error("Please sign in to join games.");
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    setJoining(true);
    try {
      const { game: updated, booking } = await api.joinOpenGame(gameId, selectedPaymentMethod);
      if (updated.is_private) {
        toast.success("Request sent to host! Redirecting to details...");
      } else {
        toast.success("Payment successful! Redirecting to receipt...");
      }
      // Trigger notification
      await api.admin.inviteBetaUser(user.email, updated.is_private ? `Your request to join ${updated.sport} at ${updated.venue} has been sent.` : `You joined ${updated.sport} at ${updated.venue}. Game is on!`);
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

  // Handle Cancel game (host only)
  const handleCancelGame = async (gameId: string) => {
    try {
      await api.cancelOpenGame(gameId);
      toast.success("Game cancelled. All players will be refunded.");
      await fetchGames();
      setSuccessGame(null);
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
    try {
      await api.hostOpenGame({
        sport: hostSport,
        venue: hostVenue,
        date: hostDate,
        time: hostTime,
        slots_total: hostSlots,
        total_amount: hostAmount,
        cancellation_policy: "Refundable up to 2 hours before game start.",
        is_private: hostIsPrivate,
      });
      toast.success("Game hosted successfully! You are joined as Host.");
      setHostModalOpen(false);
      setHostIsPrivate(false);
      await fetchGames();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHosting(false);
    }
  };

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
                Be the first to create one! Host a session at BoxCric Cage or Skyline Rooftop and invite other players.
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

            return (
              <motion.article
                key={g.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleCardClick(g)}
                className="card-panel rounded-3xl p-4 flex flex-col gap-3 relative overflow-hidden cursor-pointer hover:border-primary/40 transition-all duration-300"
              >
                {/* Visual Glow behind Open Games */}
                {!isFull && !isCancelled && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                )}

                {/* Top Row: Sport, Status, Distance */}
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
                    {/* Status Badge - Accessible color + text/icon */}
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

                    <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {g.distance} km away
                    </span>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="flex items-center gap-3 text-xs text-soft">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {g.date}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {g.time}
                  </span>
                </div>

                {/* Progress Bar for slots filled */}
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
                <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1" onClick={(e) => e.stopPropagation()}>
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

                    <button
                      disabled={isFull || isCancelled}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(g);
                      }}
                      className={`px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition shadow-neon cursor-pointer border-none ${
                        isFull || isCancelled
                          ? "bg-zinc-800 text-zinc-500 shadow-none cursor-not-allowed"
                          : "bg-gradient-neon text-primary-foreground"
                      }`}
                    >
                      {isFull ? "Full" : isCancelled ? "Cancelled" : g.is_private ? "Request Invite" : "Join Game"}
                    </button>
                  </div>
                </div>
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveJoinGame(null)}
              className="fixed inset-0 z-[45] bg-black/70 backdrop-blur-sm"
              style={{ maxWidth: "480px", left: "50%", transform: "translateX(-50%)" }}
            />
            {/* Drawer */}
            <motion.div
              initial={{ y: "100%", x: "-50%" }}
              animate={{ y: 0, x: "-50%" }}
              exit={{ y: "100%", x: "-50%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] bg-panel rounded-t-[2rem] border-t border-white/10 p-5 space-y-4"
              style={{
                paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))"
              }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div>
                  <h3 className="font-display font-black text-base">Split Payment & Join</h3>
                  <p className="text-xs text-muted-foreground">{activeJoinGame.sport} Match • {activeJoinGame.venue}</p>
                </div>
                <button
                  onClick={() => setActiveJoinGame(null)}
                  className="p-1 hover:bg-white/10 rounded-full cursor-pointer text-muted-foreground hover:text-foreground border-none bg-transparent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Secure calculation / Show the math */}
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

              {/* Cancellation Policy */}
              <div className="flex gap-2 bg-yellow-500/5 border border-yellow-500/20 p-3 rounded-2xl">
                <Info className="h-4.5 w-4.5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black uppercase text-yellow-500 tracking-wider">Cancellation Policy</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed font-semibold">
                    {activeJoinGame.cancellation_policy}
                  </p>
                </div>
              </div>

              {/* Payment Methods */}
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

              {/* Lock microcopy & pay button */}
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
                  <Lock className="h-3 w-3 text-primary animate-pulse" /> Secure 256-bit Encrypted Checkout
                </div>

                <button
                  disabled={joining}
                  onClick={() => handleJoin(activeJoinGame.id)}
                  className="w-full py-3.5 rounded-full bg-gradient-neon text-primary-foreground font-black text-xs uppercase tracking-widest shadow-neon pressable cursor-pointer border-none flex items-center justify-center min-h-[44px]"
                >
                  {joining ? (
                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin border-primary-foreground" />
                  ) : (
                    `Pay ₹${activeJoinGame.price_per_slot} & Confirm Join`
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Post-Join Success View / Modal ── */}
      <AnimatePresence>
        {successGame && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSuccessGame(null)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              style={{ maxWidth: "480px", left: "50%", transform: "translateX(-50%)" }}
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: "-40%", x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, y: "-40%", x: "-50%" }}
              className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-[400px] bg-panel rounded-[2rem] border border-white/10 p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="font-display font-black text-base text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="h-5 w-5 text-emerald-400" /> You're in!
                </h3>
                <button
                  onClick={() => setSuccessGame(null)}
                  className="p-1 hover:bg-white/10 rounded-full cursor-pointer text-muted-foreground hover:text-foreground border-none bg-transparent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Game Info */}
              <div className="bg-panel-2 border border-white/5 p-3 rounded-2xl flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">{successGame.sport} Match</h4>
                  <p className="text-xs text-muted2 mt-0.5 truncate max-w-[240px]">{successGame.venue}</p>
                </div>
              </div>

              {/* Player list (First name + Avatars, no phone numbers) */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                  Players Joined ({successGame.players.length} / {successGame.slots_total})
                </span>
                <div className="flex flex-wrap gap-2.5 max-h-24 overflow-y-auto no-scrollbar">
                  {successGame.players.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-panel-2 border border-white/5 px-2.5 py-1 rounded-full shrink-0">
                      <img src={p.avatar} alt={p.name} className="w-4 h-4 rounded-full" />
                      <span className="text-[11px] font-bold text-foreground">{p.name.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Surface Chat Contact */}
              <div className="border-t border-white/5 pt-3 space-y-2">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                  Group Chat & Host
                </span>
                <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <div>
                      <h5 className="font-bold text-xs text-foreground">In-App Chat Thread</h5>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">Discuss team colors & match rules</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      toast.success("Joined chat! Direct messaging is simulated inside mock sandbox.");
                      setSuccessGame(null);
                    }}
                    className="p-2 bg-primary rounded-full pressable cursor-pointer border-none"
                  >
                    <ChevronRight className="h-4.5 w-4.5 text-primary-foreground" />
                  </button>
                </div>
              </div>

              {/* Host management view option */}
              {user && (successGame.host_user_id === user.user_id || user.is_admin) && (
                <div className="border-t border-white/5 pt-3.5">
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to cancel hosting this game? This action will refund all players.")) {
                        handleCancelGame(successGame.id);
                      }
                    }}
                    className="w-full py-2.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-xs uppercase tracking-wider pressable cursor-pointer"
                  >
                    Cancel Hosted Game (Host Action)
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setHostModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              style={{ maxWidth: "480px", left: "50%", transform: "translateX(-50%)" }}
            />
            {/* Modal Container */}
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
                      <option value="BoxCric Cage, Indiranagar">BoxCric Cage, Indiranagar</option>
                      <option value="Greenfield Arena, Indiranagar">Greenfield Arena, Indiranagar</option>
                      <option value="Skyline Rooftop Turf, Indiranagar">Skyline Rooftop Turf, Indiranagar</option>
                    </select>
                  </div>
                </div>

                {/* Step 2: Date and Time */}
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
                      <label htmlFor="host-time-input" className="text-xs font-semibold text-soft block mb-1">Time</label>
                      <input
                        id="host-time-input"
                        type="text"
                        placeholder="e.g. 07:00 PM"
                        value={hostTime}
                        onChange={(e) => setHostTime(e.target.value)}
                        className="w-full bg-panel-2 border border-white/5 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>
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
