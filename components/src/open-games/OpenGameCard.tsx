import { useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Calendar,
  Clock,
  ChevronRight,
  Lock,
  CheckCircle,
  AlertCircle,
  Timer,
  Flame,
  Star,
  Users,
} from "lucide-react";
import type { OpenGame } from "@/types/openGames";
import type { User } from "@/data/seed";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";
import playTurfLogo from "../assets/play-turf-logo.png";

/* ────────────────────────────────────────────────────────────── */

interface OpenGameCardProps {
  game: OpenGame;
  turfImage: string;
  turfSurface?: string;
  turfAddress?: string;
  index?: number;
  user: User | null;
  onCardClick: (game: OpenGame) => void;
  onJoinClick: (e: React.MouseEvent, game: OpenGame) => void;
  onManageClick: (e: React.MouseEvent, game: OpenGame) => void;
}

/* ── Helpers ─────────────────────────────────────────────────── */

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const getTimeUntil = (dateStr: string, timeStr: string): string => {
  const now = new Date();
  const [hours, minutes] = timeStr.split(":").map(Number);
  const gameDate = new Date(dateStr);
  gameDate.setHours(hours, minutes, 0, 0);
  const diffMs = gameDate.getTime() - now.getTime();
  if (diffMs <= 0) return "Started";
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffH > 24) return `${Math.floor(diffH / 24)}d ${diffH % 24}h`;
  if (diffH > 0) return `${diffH}h ${diffM}m`;
  return `${diffM}m`;
};

/* DIM sport colors - muted, soft, shadow-focused */
const sportConfig = (sport: string) => {
  const s = sport.toLowerCase();
  if (s.includes("basketball")) {
    return {
      color: "#b45309",           // muted amber
      soft: "#92400e",          // darker amber
      bg: "rgba(180, 83, 9, 0.08)",
      border: "rgba(180, 83, 9, 0.15)",
      shadow: "0 4px 20px rgba(180, 83, 9, 0.15)",
      hoverShadow: "0 8px 32px rgba(180, 83, 9, 0.25)",
    };
  }
  if (s.includes("cricket")) {
    return {
      color: "#15803d",         // muted green
      soft: "#166534",          // darker green
      bg: "rgba(21, 128, 61, 0.08)",
      border: "rgba(21, 128, 61, 0.15)",
      shadow: "0 4px 20px rgba(21, 128, 61, 0.15)",
      hoverShadow: "0 8px 32px rgba(21, 128, 61, 0.25)",
    };
  }
  return {
    color: "#1d4ed8",           // muted blue
    soft: "#1e40af",            // darker blue
    bg: "rgba(29, 78, 216, 0.08)",
    border: "rgba(29, 78, 216, 0.15)",
    shadow: "0 4px 20px rgba(29, 78, 216, 0.15)",
    hoverShadow: "0 8px 32px rgba(29, 78, 216, 0.25)",
  };
};

/* Basketball hoop icon */
const BasketballHoopIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="2" width="12" height="8" rx="1" />
    <path d="M10 10v3" /><path d="M14 10v3" />
    <path d="M10 13l-1.5 5" /><path d="M14 13l1.5 5" />
    <path d="M10 13h4" /><path d="M8.5 18h7" />
  </svg>
);

/* Cricket bat icon */
const CricketIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 2.5a2.121 2.121 0 0 1 3 3L8.5 17.5l-3 1.5 1.5-3z" />
    <path d="M16 4l2.5 2.5" />
    <circle cx="17" cy="17" r="2.5" fill="currentColor" />
  </svg>
);

/* Football icon */
const FootballIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 22a10 10 0 0 0 10-10H12V2a10 10 0 0 0-10 10h10v10z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const getSportIcon = (sport: string, className?: string) => {
  const s = sport.toLowerCase();
  if (s.includes("basketball")) return <BasketballHoopIcon className={className || "w-6 h-6"} />;
  if (s.includes("cricket")) return <CricketIcon className={className || "w-6 h-6"} />;
  return <FootballIcon className={className || "w-6 h-6"} />;
};

/* Play Turf Logo */
const PlayTurfLogo = ({ className = "w-7 h-7" }: { className?: string }) => (
  <img src={playTurfLogo} alt="Play Turf" className={className} style={{ objectFit: "contain" }} />
);

/* ── Skeleton Shimmer Card ───────────────────────────────────── */

export function OpenGameCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 120, damping: 14 }}
      className="rounded-xl overflow-hidden flex flex-col relative border border-border/40 bg-card"
    >
      <div className="relative h-32 bg-black overflow-hidden">
        <div className="absolute inset-0 shimmer-bg" />
      </div>
      <div className="px-3 pb-3 pt-3 flex flex-col gap-2.5 bg-card">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full shimmer-bg" />
          <div className="h-4 w-32 rounded shimmer-bg" />
          <div className="w-7 h-7 rounded-full shimmer-bg ml-auto" />
        </div>
        <div className="h-3 w-48 rounded shimmer-bg" />
        <div className="rounded-xl p-3 space-y-2 bg-panel">
          <div className="h-3 w-full rounded shimmer-bg" />
          <div className="h-2 w-full rounded shimmer-bg" />
          <div className="flex justify-between">
            <div className="h-3 w-16 rounded shimmer-bg" />
            <div className="h-3 w-12 rounded shimmer-bg" />
          </div>
        </div>
        <div className="rounded-xl p-2.5 flex items-center gap-2 bg-panel">
          <div className="w-9 h-9 rounded-full shimmer-bg" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 rounded shimmer-bg" />
            <div className="h-3 w-24 rounded shimmer-bg" />
          </div>
          <div className="h-3 w-12 rounded shimmer-bg" />
        </div>
        <div className="h-10 rounded-xl shimmer-bg" />
      </div>
    </motion.div>
  );
}

/* ── Component ───────────────────────────────────────────────── */

export function OpenGameCard({
  game,
  turfImage,
  turfSurface = "Outdoor",
  turfAddress,
  index = 0,
  user,
  onCardClick,
  onJoinClick,
  onManageClick,
}: OpenGameCardProps) {
  const [pressed, setPressed] = useState(false);
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";

  const sConfig = sportConfig(game.sport);
  const progress = (game.slots_filled / game.slots_total) * 100;
  const isFull = game.status === "full";
  const isCancelled = game.status === "cancelled";
  const isHot = progress >= 70 && !isFull && !isCancelled;

  const myPlayerRecord = user
    ? game.players.find((p) => p.user_id === user.user_id || p.name === user.name)
    : null;
  const myStatus = myPlayerRecord?.payment_status || null;

  const youAreHost = !!user && game.host_user_id === user.user_id;
  const youAreIn = youAreHost || myStatus === "paid";
  const youArePending = myStatus === "requested";
  const youAreApproved = myStatus === "approved";
  const pendingRequests = game.players.filter((p) => p.payment_status === "requested");

  const joinedPlayers = game.players.filter((p) => p.payment_status !== "requested");
  const visiblePlayers = joinedPlayers.slice(0, 3);
  const remainingCount = joinedPlayers.length - 3;

  const timeUntil = getTimeUntil(game.date, game.time);
  const isUrgent = !isFull && !isCancelled && !youAreIn && progress < 50;

  const hostAvatar = game.host_avatar ? (
    <img src={game.host_avatar} alt={game.host_name} className="w-9 h-9 rounded-full object-cover shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
  ) : null;

  const skillLevel = game.id.charCodeAt(0) % 3;
  const skillLabels = ["Beginner", "Intermediate", "Competitive"];

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 120, damping: 14 }}
      onClick={() => onCardClick(game)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className="rounded-xl overflow-hidden flex flex-col relative cursor-pointer transition-all duration-300 bg-card"
      style={{
        border: pressed
          ? `1.5px solid ${sConfig.color}`
          : "1.5px solid var(--border)",
        boxShadow: pressed ? sConfig.hoverShadow : sConfig.shadow,
        transform: pressed ? "scale(0.98)" : "scale(1)",
      }}
    >
      {/* ═══════════════════════
          TOP: IMAGE
         ═══════════════════════ */}
      <div className="relative h-32 bg-black overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={turfImage}
            alt={game.venue}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (!img.dataset.fallback) {
                img.dataset.fallback = "1";
                img.src = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1200";
              }
            }}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: isPremium ? 1.0 : 0.85 }}
          />
        </div>

        {/* Theme-aware overlay - lighter on light theme, deep on amoled */}
        <div className="absolute inset-0" style={{ background: isPremium ? "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.45) 100%)" : "var(--gradient-overlay)" }} />

        {/* Status badge top-left - dim style */}
        <span
          className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 z-20 ${
            isCancelled
              ? "bg-red-950/60 text-red-400/80 border border-red-500/20"
              : isFull
                ? "bg-white/5 text-zinc-500 border border-white/8"
                : "bg-white/8 text-white/70 border border-white/10"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full bg-current ${isCancelled || isFull ? "" : "animate-pulse"}`} />
          {isCancelled ? "Closed" : isFull ? "Full" : "Open"}
        </span>

        {/* Hot badge - dim orange */}
        {isHot && (
          <span className="absolute top-2.5 left-16 z-20 text-[9px] text-orange-400/80 font-bold bg-orange-950/40 border border-orange-500/20 px-2 py-1 rounded-full flex items-center gap-1">
            <Flame className="h-2.5 w-2.5 text-orange-500/70" /> Filling Fast
          </span>
        )}

        {/* Private badge - dim */}
        {game.is_private && (
          <span className="absolute top-2.5 right-2.5 z-20 text-[9px] text-amber-400/70 font-bold bg-black/40 border border-amber-500/20 px-2 py-1 rounded-full backdrop-blur-sm flex items-center gap-1">
            <Lock className="h-2.5 w-2.5 text-amber-500/60" /> Private
          </span>
        )}

        {/* Player avatars on image bottom-right - subtle */}
        {joinedPlayers.length > 0 && (
          <div className="absolute bottom-3 right-3 z-20 flex items-center bg-black/40 backdrop-blur-sm rounded-full pl-1 pr-1.5 py-1 border border-white/8">
            <div className="flex items-center -space-x-2">
              {visiblePlayers.map((p, idx) => (
                <div key={idx} className="w-6 h-6 rounded-full border border-white/10 overflow-hidden" style={{ zIndex: visiblePlayers.length - idx }}>
                  <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(p.name); }} />
                </div>
              ))}
            </div>
            {remainingCount > 0 && <div className="ml-1 text-[10px] font-bold text-white/70">+{remainingCount}</div>}
          </div>
        )}
      </div>

      {/* ═══════════════════════
          BOTTOM: DETAILS
         ═══════════════════════ */}
      <div className="px-3 pb-3 pt-3 flex flex-col gap-2.5 bg-card border-t border-border/40">

        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: sConfig.bg, border: `1px solid ${sConfig.border}` }}>
              <span style={{ color: sConfig.color, opacity: 0.8 }}>{getSportIcon(game.sport, "w-4 h-4")}</span>
            </div>
            <h3 className="font-display font-bold text-[15px] text-foreground leading-tight truncate">
              {game.venue}
            </h3>
          </div>
          <div className="shrink-0 opacity-60">
            <PlayTurfLogo className="w-7 h-7" />
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium flex items-center gap-1" style={{ backgroundColor: sConfig.bg, color: sConfig.color, border: `1px solid ${sConfig.border}` }}>
            <Star className="h-2.5 w-2.5" /> {skillLabels[skillLevel]}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium text-foreground-soft bg-foreground/5 border border-border/40">
            {turfSurface}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium text-foreground-soft bg-foreground/5 border border-border/40">
            {Math.round(game.slots_total / 2)}-a-side {game.sport}
          </span>
        </div>

        {/* Venue + metadata */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-foreground-soft/75 text-[11px] font-medium">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.5} />
            {turfAddress || game.venue}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" strokeWidth={1.5} />
            {game.date === getLocalDateString() ? "Today" : game.date}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" strokeWidth={1.5} />
            {game.time}
          </span>
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3 shrink-0" strokeWidth={1.5} />
            {game.duration_hours ? game.duration_hours * 60 : 60}m
          </span>
          {!isCancelled && !isFull && (
            <span className="flex items-center gap-1 font-medium text-foreground-soft/80">
              <Clock className="h-3 w-3 shrink-0" strokeWidth={1.5} />
              Starts in {timeUntil}
            </span>
          )}
        </div>

        {/* Progress section */}
        <div className="rounded-xl p-3 space-y-2 bg-panel border border-border/40">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-foreground-soft">Court split progress</span>
            <span className="font-bold text-foreground">{game.slots_filled}/{game.slots_total}</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-background border border-border/20">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: sConfig.color, opacity: 0.7 }} />
          </div>
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-foreground-soft">{game.slots_filled} joined</span>
            <span className="text-foreground-muted">{game.slots_total - game.slots_filled} spots left</span>
          </div>
        </div>

        {/* Host + price */}
        <div className="flex items-center justify-between rounded-xl p-2.5 bg-panel border border-border/40">
          <div className="flex items-center gap-2 min-w-0">
            {hostAvatar || (
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-primary-foreground" style={{ backgroundColor: sConfig.color }}>
                {game.host_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[9px] text-foreground-muted uppercase leading-none tracking-wider font-bold">Host</p>
              <p className="text-xs font-bold text-foreground mt-0.5 truncate">{game.host_name}</p>
              <p className="text-[10px] text-foreground-soft font-medium mt-0.5 flex items-center gap-0.5">
                <CheckCircle className="h-3 w-3 text-emerald-500/80" /> Verified
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] text-foreground-muted uppercase leading-none tracking-wider font-bold">Share</p>
            <p className="text-lg font-black mt-0.5 text-primary">₹{game.price_per_slot}</p>
          </div>
        </div>

        {/* CTA Button */}
        <div>
          {youAreIn ? (
            <button
              onClick={(e) => { e.stopPropagation(); onManageClick(e, game); }}
              className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition duration-200 border bg-panel hover:bg-panel-2 border-border/40 text-foreground-soft cursor-pointer flex items-center justify-center gap-1"
            >
              Manage Match <ChevronRight className="h-4 w-4" />
            </button>
          ) : youAreApproved ? (
            <button
              onClick={(e) => { e.stopPropagation(); onJoinClick(e, game); }}
              className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition duration-200 border-none cursor-pointer flex items-center justify-center gap-1.5 bg-gradient-neon text-primary-foreground shadow-neon"
            >
              Pay & Join Match <ChevronRight className="h-4 w-4" />
            </button>
          ) : youArePending ? (
            <button
              disabled
              className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider border border-border/20 bg-panel text-foreground-muted cursor-not-allowed flex items-center justify-center"
            >
              Pending Approval
            </button>
          ) : (
            <button
              disabled={isFull || isCancelled}
              onClick={(e) => { e.stopPropagation(); onJoinClick(e, game); }}
              className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition duration-200 border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                isFull || isCancelled
                  ? "bg-panel text-foreground-muted cursor-not-allowed"
                  : "bg-gradient-neon text-primary-foreground shadow-neon"
              }`}
            >
              {isFull ? "Game Full" : isCancelled ? "Cancelled" : game.is_private ? "Request Invite" : "Join Match"}
              {!isFull && !isCancelled && <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Pending requests - dim */}
        {youAreHost && pendingRequests.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onManageClick(e, game); }}
            className="text-left w-full rounded-xl px-3 py-2 flex items-center gap-2 transition"
            style={{ backgroundColor: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.15)" }}
          >
            <AlertCircle className="h-4 w-4 text-amber-500/60 shrink-0" />
            <span className="text-xs font-medium text-amber-400/70">
              {pendingRequests.length} request{pendingRequests.length > 1 ? "s" : ""} awaiting approval
            </span>
            <ChevronRight className="h-4 w-4 text-amber-500/50 ml-auto" />
          </button>
        )}
      </div>
    </motion.article>
  );
}
