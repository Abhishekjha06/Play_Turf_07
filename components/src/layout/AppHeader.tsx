import { Bell, MapPin, Search, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";
import { CoolThemeToggle } from "@/ui/CoolThemeToggle";
import { Avatar, AvatarImage } from "@/ui/avatar";
import { AvatarPicker } from "@/ui/AvatarPicker";
import { useState, useEffect, useMemo } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { fadeSlideDown } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getNotifications,
  markAllAsRead,
  addNotification,
  clearNotifications,
  getCategoryForType,
  type AppNotification,
  type NotificationType,
  type NotificationCategory
} from "@/lib/notifications";

export function AppHeader() {
  const { user } = useAuth();
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  return (
    <CollapsingHeader
      user={user}
      isAvatarPickerOpen={isAvatarPickerOpen}
      setIsAvatarPickerOpen={setIsAvatarPickerOpen}
    />
  );
}

/* ─── Collapsing Header ─────────────────────────────────────────────── */

function CollapsingHeader({
  user,
  isAvatarPickerOpen,
  setIsAvatarPickerOpen,
}: {
  user: any;
  isAvatarPickerOpen: boolean;
  setIsAvatarPickerOpen: (v: boolean) => void;
}) {
  const { scrollY } = useScroll();
  const { themeId } = useLuxuryTheme();
  const navigate = useNavigate();
  
  const isPremiumTeal = themeId === "premium-teal";
  const accentColor = isPremiumTeal ? "#14B8B0" : "#00E676";
  const bgGradient = isPremiumTeal
    ? "linear-gradient(135deg, #0F172A 0%, #0E4F5F 30%, #14B8B0 70%, #0F172A 100%)"
    : "linear-gradient(135deg, #000000 0%, #090909 30%, #004D26 70%, #000000 100%)";

  // Interpolate header height from 300px down to 80px over a scroll distance of 220px
  const headerHeight = useTransform(scrollY, [0, 220], [300, 80]);
  
  // Scale logo from 1.0 down to 0.85
  const logoScale = useTransform(scrollY, [0, 220], [1.0, 0.85]);
  
  // Fade out greeting, subtitle, and search bar
  const greetingOpacity = useTransform(scrollY, [0, 100], [1, 0]);
  const searchBarOpacity = useTransform(scrollY, [0, 140], [1, 0]);
  const waveOpacity = useTransform(scrollY, [0, 150], [0.08, 0]);
  const logoSubtitleOpacity = useTransform(scrollY, [0, 80], [1, 0]);

  // Translate elements up as we scroll (search bar scrolls away with content)
  const greetingY = useTransform(scrollY, [0, 220], [0, -100]);
  const searchBarY = useTransform(scrollY, [0, 220], [0, -180]);

  // Notification states
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationCategory | "All">("All");
  const [selectedNotifForDetail, setSelectedNotifForDetail] = useState<AppNotification | null>(null);

  useEffect(() => {
    // Initial load
    setNotifications(getNotifications());

    const handleUpdate = () => {
      setNotifications(getNotifications());
    };

    const handleBlink = () => {
      setIsBlinking(true);
      // Automatically stop blinking after 8s
      setTimeout(() => setIsBlinking(false), 8000);
    };

    const handleOpenNotif = () => {
      setIsNotifOpen(true);
      setIsBlinking(false);
      markAllAsRead();
    };

    window.addEventListener("notifications_updated", handleUpdate);
    window.addEventListener("notification_blink", handleBlink);
    window.addEventListener("open_notifications", handleOpenNotif);
    return () => {
      window.removeEventListener("notifications_updated", handleUpdate);
      window.removeEventListener("notification_blink", handleBlink);
      window.removeEventListener("open_notifications", handleOpenNotif);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "All") return notifications;
    return notifications.filter(n => getCategoryForType(n.type) === activeFilter);
  }, [notifications, activeFilter]);

  const getButtonLabelForDeepLink = (deepLink?: string) => {
    if (!deepLink) return "View Details";
    if (deepLink.startsWith("/turf/")) return "View Turf";
    if (deepLink.startsWith("/turfs")) return "Book Now";
    if (deepLink.startsWith("/tournaments")) return "Register Now";
    if (deepLink.startsWith("/offers")) return "View Offer";
    return "Go to Page";
  };

  return (
    <>
      <motion.header
        variants={fadeSlideDown}
        initial="hidden"
        animate="visible"
        className="fixed top-0 md:top-4 left-1/2 w-full max-w-[480px] md:rounded-t-[2rem] z-40 overflow-hidden"
        style={{
          height: headerHeight,
          x: "-50%",
          background: bgGradient,
        }}
        data-testid="app-header"
      >
        {/* Animated SVG wave background — parallax via CSS */}
        <motion.svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: waveOpacity }}
          viewBox="0 0 480 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path d="M-40 200 Q60 140 160 180 Q260 220 360 160 Q440 110 520 150" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M-40 240 Q80 170 180 210 Q280 250 380 190 Q450 150 540 185" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M-40 260 Q100 200 200 235 Q300 270 400 215 Q460 180 540 210" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" />
          {[0, 1, 2, 3, 4, 5].map((row) =>
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((col) => (
              <circle key={`${row}-${col}`} cx={col * 52 + 12} cy={row * 48 + 10} r="1.5" fill="white" />
            ))
          )}
          <circle cx="400" cy="40" r="70" stroke="white" strokeWidth="1" fill="none" opacity="0.5" />
          <circle cx="400" cy="40" r="45" stroke="white" strokeWidth="0.8" fill="none" opacity="0.4" />
          <line x1="0" y1="100" x2="480" y2="100" stroke="white" strokeWidth="0.6" strokeDasharray="8 6" opacity="0.4" />
          <line x1="240" y1="0" x2="240" y2="280" stroke="white" strokeWidth="0.6" strokeDasharray="8 6" opacity="0.3" />
          <ellipse cx="240" cy="100" rx="60" ry="28" stroke="white" strokeWidth="0.8" fill="none" opacity="0.35" />
        </motion.svg>

        {/* Main container */}
        <div className="relative z-10 h-full flex flex-col justify-between px-5 pt-4 pb-5">
          {/* Top row: logo + actions (remains visible in collapsed header) */}
          <div className="flex items-center justify-between h-[48px] min-h-[48px]">
            <Link
              to="/"
              onClick={() => {
                localStorage.removeItem("play_turf_selected_city");
                localStorage.removeItem("play_turf_selected_area");
              }}
              className="leading-tight origin-left"
              data-testid="header-logo"
            >
              <motion.div
                style={{ scale: logoScale, transformOrigin: "left center" }}
                className="flex flex-col justify-center"
              >
                <h1
                  style={{
                    fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
                    fontWeight: 800,
                    fontSize: "32px",
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    color: "white",
                  }}
                >
                  play
                  <span style={{ color: accentColor }}>_Turf</span>
                </h1>
                <motion.p
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    marginTop: "2px",
                    opacity: logoSubtitleOpacity,
                  }}
                >
                  BookMySports
                </motion.p>
              </motion.div>
            </Link>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center" title="Switch Theme">
                <CoolThemeToggle size="sm" />
              </div>

              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  setIsNotifOpen(true);
                  setIsBlinking(false);
                  markAllAsRead();
                }}
                animate={isBlinking ? {
                  rotate: [0, -15, 15, -15, 15, -10, 10, -5, 5, 0],
                  scale: [1, 1.1, 1.1, 1.1, 1.1, 1]
                } : {}}
                transition={{ duration: 0.8, repeat: isBlinking ? Infinity : 0, repeatDelay: 1 }}
                aria-label="Notifications"
                className="relative h-9 w-9 rounded-full grid place-items-center cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.20)",
                }}
                data-testid="header-notifications"
              >
                <Bell className="h-[18px] w-[18px] text-white" />
                {unreadCount > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1 -right-1 h-4 w-4 rounded-full text-[9px] font-black grid place-items-center text-white border border-[#0f172a]",
                      isBlinking ? "animate-bounce" : ""
                    )}
                    style={{ background: accentColor }}
                  >
                    {unreadCount}
                  </span>
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsAvatarPickerOpen(true)}
                aria-label="Profile"
                className="rounded-full"
                data-testid="header-avatar"
              >
                <Avatar
                  className="h-9 w-9 cursor-pointer"
                  style={{ border: "2px solid rgba(255,255,255,0.35)" }}
                >
                  <AvatarImage src={user?.picture} alt={user?.name || "User"} />
                </Avatar>
              </motion.button>
            </div>
          </div>

          {/* Greeting + Subtitle */}
          <motion.div
            style={{ opacity: greetingOpacity, y: greetingY }}
            className="flex flex-col justify-center my-3 select-none pointer-events-none"
          >
            <p
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: "13px",
                marginBottom: "2px",
              }}
            >
              Good {getGreeting()},{" "}
              {user?.name?.split(" ")[0] || "Player"} 👋
            </p>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" style={{ color: accentColor }} />
              <p style={{ color: "white", fontSize: "16px", fontWeight: 600 }}>
                Find your perfect turf
              </p>
            </div>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            style={{ opacity: searchBarOpacity, y: searchBarY }}
            className="w-full"
          >
            <HeaderSearchBar />
          </motion.div>
        </div>
      </motion.header>
      <div style={{ height: "300px" }} />
      <AvatarPicker
        open={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
      />

      {/* Notifications Drawer */}
      <AnimatePresence>
        {isNotifOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotifOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              style={{ maxWidth: "480px", left: "50%", transform: "translateX(-50%)" }}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-[85%] max-w-[400px] border-l backdrop-blur-xl flex flex-col"
              style={{
                backgroundColor: "var(--card-bg, #1e1e1e)",
                borderColor: "var(--border-primary, #333)",
                boxShadow: "var(--shadow-primary, 0 10px 30px rgba(0,0,0,0.5))"
              }}
            >
              {/* Header */}
              <div className="p-4.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border-primary)" }}>
                <div>
                  <h3 className="font-display font-black text-base text-foreground">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{unreadCount} Unread Alerts</span>
                  )}
                </div>
                <button
                  onClick={() => setIsNotifOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer text-muted-foreground hover:text-foreground transition border-none"
                  style={{ backgroundColor: "transparent" }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Category Filters */}
              <div className="px-4 py-2 overflow-x-auto no-scrollbar flex gap-2 border-b" style={{ borderColor: "var(--border-primary)" }}>
                {(["All", "Bookings", "Refunds", "Offers", "Announcements", "Tournaments", "System Updates"] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(cat)}
                    className={cn(
                      "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full shrink-0 cursor-pointer border transition",
                      activeFilter === cat
                        ? "bg-primary border-transparent text-primary-foreground"
                        : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="px-4.5 py-2.5 bg-white/5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider">
                <button
                  onClick={() => {
                    markAllAsRead();
                    toast.success("All marked as read");
                  }}
                  className="text-primary hover:underline cursor-pointer border-none bg-transparent"
                >
                  Mark all as read
                </button>
                <button
                  onClick={() => {
                    clearNotifications();
                    toast.info("Notifications cleared");
                  }}
                  className="text-red-400 hover:underline cursor-pointer border-none bg-transparent"
                >
                  Clear all
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-4.5 space-y-3">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground flex flex-col items-center gap-3">
                    <Bell className="h-10 w-10 text-muted-foreground/30 animate-pulse" />
                    <p className="text-xs font-semibold">No notifications in this category</p>
                  </div>
                ) : (
                  filteredNotifications.map(notif => {
                    const isPromoOffer = ["promotional_offer", "discount_coupon", "tournament_announcement", "new_turf_launch", "system_announcement", "offer"].includes(notif.type);
                    return (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (isPromoOffer) {
                            setSelectedNotifForDetail(notif);
                          } else if (notif.booking_id) {
                            setIsNotifOpen(false);
                            navigate(`/booking/${notif.booking_id}`);
                          } else if (notif.deepLink) {
                            setIsNotifOpen(false);
                            navigate(notif.deepLink);
                          }
                        }}
                        className={cn(
                          "p-3.5 rounded-2xl border text-left transition relative cursor-pointer",
                          notif.isRead ? "border-white/5 bg-white/5 opacity-80" : "border-primary/20 bg-primary/5 hover:bg-primary/10"
                        )}
                        style={{
                          borderColor: notif.isRead ? "var(--border-primary)" : undefined
                        }}
                      >
                        {!notif.isRead && (
                          <span className="absolute top-3.5 right-3.5 h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-foreground">
                            {notif.type.replace("_", " ")}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 className={cn("mt-2 text-xs text-foreground font-display", notif.isRead ? "font-semibold" : "font-black")}>
                          {notif.title}
                        </h4>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed font-semibold">{notif.body}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Simulation Button */}
              <div className="p-4 border-t" style={{ borderColor: "var(--border-primary)", backgroundColor: "rgba(0,0,0,0.15)" }}>
                <button
                  onClick={() => {
                    const promos = [
                      {
                        type: "promotional_offer" as const,
                        title: "Weekend Football Offer ⚽",
                        body: "Get 20% off on all football bookings this weekend.",
                        deepLink: "/turfs",
                        expiryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                        targetAudience: "All Users"
                      },
                      {
                        type: "tournament_announcement" as const,
                        title: "National Box Cricket Cup 🏆",
                        body: "Registrations are now open for the summer national league! Register your roster today.",
                        deepLink: "/tournaments",
                        targetAudience: "All Users"
                      },
                      {
                        type: "new_turf_launch" as const,
                        title: "Arena Grand Opening! 🎉",
                        body: "Greenfield Arena Indiranagar is now live. Check slots and view early-bird rates.",
                        deepLink: "/turf/turf-01",
                        targetAudience: "All Users"
                      }
                    ];
                    const selected = promos[Math.floor(Math.random() * promos.length)];
                    addNotification(selected);
                    toast.success("Promo notification pushed!");
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-neon text-primary-foreground text-xs font-black uppercase tracking-wider shadow-neon border-none cursor-pointer"
                >
                  Push Mock Promo Offer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Detailed Offer Modal */}
      <AnimatePresence>
        {selectedNotifForDetail && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setSelectedNotifForDetail(null)}
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md"
              style={{ maxWidth: "480px", left: "50%", transform: "translateX(-50%)" }}
            />
            
            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: "-40%", x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, y: "-40%", x: "-50%" }}
              className="fixed left-1/2 top-1/2 z-[70] w-[90%] max-w-[400px] rounded-[2rem] border overflow-hidden p-5 space-y-4 text-left"
              style={{
                backgroundColor: "var(--card-bg, #1a1a1a)",
                borderColor: "var(--border-primary, #333)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded bg-white/10 text-foreground">
                  {selectedNotifForDetail.type.replace("_", " ")}
                </span>
                <button
                  onClick={() => setSelectedNotifForDetail(null)}
                  className="p-1 hover:bg-white/10 rounded-full cursor-pointer text-muted-foreground hover:text-foreground transition border-none"
                  style={{ backgroundColor: "transparent" }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Banner */}
              {selectedNotifForDetail.bannerImage && (
                <div className="w-full h-40 rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                  <img src={selectedNotifForDetail.bannerImage} alt="Banner" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Title & Description */}
              <div className="space-y-1.5 text-left">
                <h3 className="font-display font-black text-lg text-foreground leading-tight">
                  {selectedNotifForDetail.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                  {selectedNotifForDetail.body}
                </p>
              </div>

              {/* Expiry date check */}
              {(() => {
                const isExpired = selectedNotifForDetail.expiryDate && new Date(selectedNotifForDetail.expiryDate).getTime() < Date.now();
                return (
                  <div className="space-y-4 text-left">
                    <div className="border border-white/5 p-3 rounded-xl bg-white/5 space-y-1.5 text-[11px] font-semibold text-muted-foreground">
                      <div className="flex justify-between items-center">
                        <span>Valid Until:</span>
                        <span className={cn("font-bold", isExpired ? "text-red-400" : "text-foreground")}>
                          {selectedNotifForDetail.expiryDate
                            ? new Date(selectedNotifForDetail.expiryDate).toLocaleString()
                            : "N/A"}
                        </span>
                      </div>
                      {isExpired && (
                        <div className="text-[10px] text-red-400 font-extrabold uppercase tracking-wide flex items-center gap-1.5 pt-1 border-t border-white/5 mt-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                          Offer Expired. This promotion is no longer available.
                        </div>
                      )}
                    </div>

                    {/* Terms */}
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-black block">Terms & Conditions</span>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        * Offer valid on booking values above ₹500.<br />
                        * Subject to slot availability and cannot be merged with other codes.<br />
                        * Promotion is valid only inside the PlayTurf app logs.
                      </p>
                    </div>

                    {/* Action button */}
                    <button
                      disabled={isExpired}
                      onClick={() => {
                        setSelectedNotifForDetail(null);
                        setIsNotifOpen(false);
                        if (selectedNotifForDetail.deepLink) {
                          navigate(selectedNotifForDetail.deepLink);
                        }
                      }}
                      className={cn(
                        "w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-neon border-none cursor-pointer text-center block transition",
                        isExpired
                          ? "bg-zinc-800 text-zinc-500 shadow-none cursor-not-allowed"
                          : "bg-gradient-neon text-primary-foreground"
                      )}
                    >
                      {getButtonLabelForDeepLink(selectedNotifForDetail.deepLink)}
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function HeaderSearchBar() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { themeId } = useLuxuryTheme();
  
  const isPremiumTeal = themeId === "premium-teal";
  const focusRingGlow = isPremiumTeal ? "rgba(20,184,176,0.45)" : "rgba(0,230,118,0.45)";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const next = new URLSearchParams(window.location.search);
        if (q.trim()) {
          next.set("q", q.trim());
        } else {
          next.delete("q");
        }
        navigate(`/?${next.toString()}`);
      }}
    >
      <motion.label
        whileFocusWithin={{ scale: 1.015, boxShadow: `0 0 0 2px ${focusRingGlow}` }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-3 px-5 cursor-text"
        style={{
          height: "56px",
          background: "rgba(255,255,255,0.15)",
          borderRadius: "28px",
          border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Search
          className="h-5 w-5 flex-shrink-0"
          style={{ color: "rgba(255,255,255,0.70)" }}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search turfs or locations…"
          className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:truncate"
          style={{ color: "white" }}
          data-testid="search-input"
        />
      </motion.label>
    </form>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
