import { Bell, MapPin, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";
import { CoolThemeToggle } from "@/ui/CoolThemeToggle";
import { Avatar, AvatarImage } from "@/ui/Avatar";
import { AvatarPicker } from "@/ui/AvatarPicker";
import { useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { fadeSlideDown } from "@/lib/motion";

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
            <Link to="/" className="leading-tight origin-left" data-testid="header-logo">
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
                aria-label="Notifications"
                className="relative h-9 w-9 rounded-full grid place-items-center"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.20)",
                }}
                data-testid="header-notifications"
              >
                <Bell className="h-[18px] w-[18px] text-white" />
                <span
                  className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full animate-glow-pulse"
                  style={{ background: accentColor }}
                />
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
        if (q.trim()) navigate(`/?q=${encodeURIComponent(q.trim())}`);
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
