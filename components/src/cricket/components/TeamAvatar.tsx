import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Team } from "../types";

// Supported Mascots: Lion, Tiger, Panther, Eagle, Falcon, Wolf, Dragon, Cobra, Rhino, Bull, Shark, Phoenix, Spartan, Knight, Viking
const MASCOTS = [
  "Lion", "Tiger", "Panther", "Eagle", "Falcon", 
  "Wolf", "Dragon", "Cobra", "Rhino", "Bull", 
  "Shark", "Phoenix", "Spartan", "Knight", "Viking"
];

export function getMascotForTeam(name: string): string {
  if (!name) return "Lion";
  const lower = name.toLowerCase();
  if (lower.includes("lion")) return "Lion";
  if (lower.includes("tiger") || lower.includes("striker")) return "Tiger";
  if (lower.includes("panther") || lower.includes("predator")) return "Panther";
  if (lower.includes("eagle")) return "Eagle";
  if (lower.includes("falcon")) return "Falcon";
  if (lower.includes("wolf")) return "Wolf";
  if (lower.includes("dragon")) return "Dragon";
  if (lower.includes("cobra") || lower.includes("viper")) return "Cobra";
  if (lower.includes("rhino")) return "Rhino";
  if (lower.includes("bull")) return "Bull";
  if (lower.includes("shark")) return "Shark";
  if (lower.includes("phoenix") || lower.includes("flame") || lower.includes("fire")) return "Phoenix";
  if (lower.includes("spartan") || lower.includes("titan")) return "Spartan";
  if (lower.includes("knight") || lower.includes("warrior") || lower.includes("rider") || lower.includes("blazer") || lower.includes("commander")) return "Knight";
  if (lower.includes("viking") || lower.includes("legend")) return "Viking";
  
  // Deterministic fallback
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % MASCOTS.length;
  return MASCOTS[idx];
}

// Map team names to high-fidelity generated logo assets for all 16 default teams
function getTeamLogoImage(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes("thunder striker")) return "/assets/thunder_strikers.png";
  if (lower.includes("royal blazer")) return "/assets/royal_blazers.png";
  if (lower.includes("power hitter")) return "/assets/power_hitters.png";
  if (lower.includes("shadow warrior")) return "/assets/shadow_warriors.png";
  if (lower.includes("cricket titan")) return "/assets/cricket_titans.png";
  if (lower.includes("pitch predator")) return "/assets/pitch_predators.png";
  if (lower.includes("firestorm")) return "/assets/firestorm_xi.png";
  if (lower.includes("boundary breaker")) return "/assets/boundary_breakers.png";
  if (lower.includes("iron grip")) return "/assets/iron_grip.png";
  if (lower.includes("night rider")) return "/assets/night_riders.png";
  if (lower.includes("elite challenger")) return "/assets/elite_challengers.png";
  if (lower.includes("storm blade")) return "/assets/storm_blades.png";
  if (lower.includes("victory viper")) return "/assets/victory_vipers.png";
  if (lower.includes("blue flame")) return "/assets/blue_flame.png";
  if (lower.includes("rising legend")) return "/assets/rising_legends.png";
  if (lower.includes("cricket commander")) return "/assets/cricket_commanders.png";
  return null;
}

// Generate distinct badge shapes for teams (classic football, cricket, and athletic club crests)
function getBadgeStyle(name: string): "circle" | "shield" | "modern" | "retro" {
  if (!name) return "circle";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const styles: Array<"circle" | "shield" | "modern" | "retro"> = ["circle", "shield", "modern", "retro"];
  return styles[Math.abs(hash) % styles.length];
}

// Highly stylized mascot vector symbols (drawn in high-contrast athletic style as fallback)
function MascotEmblem({ mascot, color }: { mascot: string; color: string }) {
  const strokeProps = {
    stroke: color,
    strokeWidth: "4.5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  const fillProps = {
    fill: color,
    opacity: "0.15",
  };

  switch (mascot) {
    case "Lion":
      return (
        <g>
          <path d="M 50 24 L 35 34 L 38 52 L 44 56 L 50 68 L 56 56 L 62 52 L 65 34 Z" {...fillProps} />
          <path d="M 50 24 L 35 34 L 38 52 L 44 56 L 50 68 L 56 56 L 62 52 L 65 34 Z" {...strokeProps} />
          <path d="M 35 34 L 28 24 L 38 28 L 50 18 L 62 28 L 72 24 L 65 34" {...strokeProps} />
          <line x1="43" y1="42" x2="47" y2="44" stroke={color} strokeWidth="4" />
          <line x1="57" y1="42" x2="53" y2="44" stroke={color} strokeWidth="4" />
          <polygon points="47,50 53,50 50,54" fill={color} />
        </g>
      );
    case "Tiger":
      return (
        <g>
          <path d="M 34 28 L 50 18 L 66 28 L 62 48 L 66 56 L 50 70 L 34 56 L 38 48 Z" {...fillProps} />
          <path d="M 34 28 L 50 18 L 66 28 L 62 48 L 66 56 L 50 70 L 34 56 L 38 48 Z" {...strokeProps} />
          <path d="M 38 34 L 46 36 M 62 34 L 54 36 M 37 42 L 45 43 M 63 42 L 55 43" {...strokeProps} strokeWidth="3.5" />
          <line x1="41" y1="48" x2="46" y2="50" stroke={color} strokeWidth="4.5" />
          <line x1="59" y1="48" x2="54" y2="50" stroke={color} strokeWidth="4.5" />
          <polygon points="48,56 52,56 50,60" fill={color} />
        </g>
      );
    case "Panther":
      return (
        <g>
          <path d="M 34 34 L 32 22 L 42 28 L 50 26 L 58 28 L 68 22 L 66 34 L 62 52 L 50 68 L 38 52 Z" {...fillProps} />
          <path d="M 34 34 L 32 22 L 42 28 L 50 26 L 58 28 L 68 22 L 66 34 L 62 52 L 50 68 L 38 52 Z" {...strokeProps} />
          <polygon points="41,40 46,42 43,38" fill={color} />
          <polygon points="59,40 53,42 57,38" fill={color} />
          <path d="M 36 48 L 44 50 M 64 48 L 56 50" stroke={color} strokeWidth="3" />
        </g>
      );
    case "Eagle":
      return (
        <g>
          <path d="M 22 42 L 36 26 L 50 36 L 64 26 L 78 42 L 66 64 L 50 72 L 34 64 Z" {...fillProps} />
          <path d="M 22 42 L 36 26 L 50 36 L 64 26 L 78 42 L 66 64 L 50 72 L 34 64 Z" {...strokeProps} />
          <path d="M 44 38 L 56 38 L 50 52 Z" fill={color} />
          <circle cx="44" cy="32" r="2.5" fill={color} />
          <circle cx="56" cy="32" r="2.5" fill={color} />
        </g>
      );
    case "Falcon":
      return (
        <g>
          <path d="M 18 34 L 50 24 L 82 34 L 66 62 L 50 72 L 34 62 Z" {...fillProps} />
          <path d="M 18 34 L 50 24 L 82 34 L 66 62 L 50 72 L 34 62 Z" {...strokeProps} />
          <path d="M 40 42 L 46 44 M 60 42 L 54 44" stroke={color} strokeWidth="4.5" />
          <polygon points="48,50 52,50 50,56" fill={color} />
        </g>
      );
    case "Wolf":
      return (
        <g>
          <path d="M 34 32 L 32 20 L 42 28 L 50 24 L 58 28 L 68 20 L 66 32 L 60 50 L 50 68 L 40 50 Z" {...fillProps} />
          <path d="M 34 32 L 32 20 L 42 28 L 50 24 L 58 28 L 68 20 L 66 32 L 60 50 L 50 68 L 40 50 Z" {...strokeProps} />
          <polygon points="41,40 46,42 43,38" fill={color} />
          <polygon points="59,40 53,42 57,38" fill={color} />
          <path d="M 45 52 L 50 46 L 55 52 L 50 58 Z" {...strokeProps} strokeWidth="3" />
        </g>
      );
    case "Dragon":
      return (
        <g>
          <path d="M 30 36 L 36 22 L 50 30 L 64 22 L 70 36 L 64 54 L 50 70 L 36 54 Z" {...fillProps} />
          <path d="M 30 36 L 36 22 L 50 30 L 64 22 L 70 36 L 64 54 L 50 70 L 36 54 Z" {...strokeProps} />
          <path d="M 36 22 L 24 12 M 64 22 L 76 12" {...strokeProps} strokeWidth="5" />
          <polygon points="42,40 47,42 45,38" fill={color} />
          <polygon points="58,40 53,42 55,38" fill={color} />
        </g>
      );
    case "Cobra":
      return (
        <g>
          <path d="M 24 45 C 24 30, 35 22, 50 22 C 65 22, 76 30, 76 45 C 76 56, 64 64, 50 74 C 36 64, 24 56, 24 45 Z" {...fillProps} />
          <path d="M 24 45 C 24 30, 35 22, 50 22 C 65 22, 76 30, 76 45 C 76 56, 64 64, 50 74 C 36 64, 24 56, 24 45 Z" {...strokeProps} />
          <path d="M 44 42 L 50 32 L 56 42 L 54 52 L 50 58 L 46 52 Z" {...strokeProps} strokeWidth="3.5" />
          <line x1="47" y1="50" x2="47" y2="54" stroke="#ffffff" strokeWidth="2.5" />
          <line x1="53" y1="50" x2="53" y2="54" stroke="#ffffff" strokeWidth="2.5" />
        </g>
      );
    case "Rhino":
      return (
        <g>
          <path d="M 36 30 L 50 24 L 64 30 L 60 52 L 50 66 L 40 52 Z" {...fillProps} />
          <path d="M 36 30 L 50 24 L 64 30 L 60 52 L 50 66 L 40 52 Z" {...strokeProps} />
          <path d="M 50 38 L 50 18 L 45 28 Z" fill={color} />
          <circle cx="43" cy="34" r="2" fill={color} />
          <circle cx="57" cy="34" r="2" fill={color} />
        </g>
      );
    case "Bull":
      return (
        <g>
          <path d="M 34 38 C 26 32, 22 18, 38 12 M 66 38 C 74 32, 78 18, 62 12" {...strokeProps} strokeWidth="5" />
          <path d="M 34 38 L 50 30 L 66 38 L 60 56 L 50 70 L 40 56 Z" {...fillProps} />
          <path d="M 34 38 L 50 30 L 66 38 L 60 56 L 50 70 L 40 56 Z" {...strokeProps} />
          <circle cx="50" cy="60" r="5" fill="none" stroke={color} strokeWidth="3.5" />
        </g>
      );
    case "Shark":
      return (
        <g>
          <path d="M 24 58 C 35 53, 65 53, 76 58 L 50 20 Z" {...fillProps} />
          <path d="M 24 58 C 35 53, 65 53, 76 58 L 50 20 Z" {...strokeProps} />
          <path d="M 44 46 L 50 30 L 56 46" {...strokeProps} />
        </g>
      );
    case "Phoenix":
      return (
        <g>
          <path d="M 22 42 C 22 26, 35 16, 50 26 C 65 16, 78 26, 78 42 C 78 56, 50 70, 50 70 Z" {...fillProps} />
          <path d="M 22 42 C 22 26, 35 16, 50 26 C 65 16, 78 26, 78 42 C 78 56, 50 70, 50 70 Z" {...strokeProps} />
          <path d="M 50 26 L 44 38 L 50 48 L 56 38 Z" fill={color} />
        </g>
      );
    case "Spartan":
      return (
        <g>
          <path d="M 50 12 C 34 12, 38 24, 50 21 C 62 24, 66 12, 50 12 Z" fill={color} />
          <path d="M 35 26 L 50 20 L 65 26 L 61 50 L 50 63 L 39 50 Z" {...fillProps} />
          <path d="M 35 26 L 50 20 L 65 26 L 61 50 L 50 63 L 39 50 Z" {...strokeProps} />
          <path d="M 43 32 L 57 32 M 50 32 L 50 48" stroke="#000000" strokeWidth="4.5" strokeLinecap="square" />
        </g>
      );
    case "Knight":
      return (
        <g>
          <path d="M 36 30 L 50 22 L 64 30 L 60 50 L 50 60 L 40 50 Z" {...fillProps} />
          <path d="M 36 30 L 50 22 L 64 30 L 60 50 L 50 60 L 40 50 Z" {...strokeProps} />
          <path d="M 43 35 L 57 35 M 43 40 L 57 40 M 45 45 L 55 45" stroke="#000000" strokeWidth="2.5" />
          <line x1="50" y1="28" x2="50" y2="47" stroke={color} strokeWidth="2.5" />
        </g>
      );
    case "Viking":
      return (
        <g>
          <path d="M 34 26 C 24 22, 22 10, 35 10 M 66 26 C 76 22, 78 10, 65 10" {...strokeProps} strokeWidth="4" />
          <path d="M 35 26 L 50 21 L 65 26 L 61 46 L 50 56 L 39 46 Z" {...fillProps} />
          <path d="M 35 26 L 50 21 L 65 26 L 61 46 L 50 56 L 39 46 Z" {...strokeProps} />
          <path d="M 50 23 L 50 42 L 45 42" stroke={color} strokeWidth="3.5" fill="none" />
        </g>
      );
    default:
      return null;
  }
}

export function TeamAvatar({ 
  team, 
  size = "md", 
  className,
  variant = "default"
}: { 
  team?: Team; 
  size?: "sm" | "md" | "lg" | "responsive" | "card-redesign"; 
  className?: string; 
  variant?: "default" | "card" | "raw" | "sports";
}) {
  const dimensions = 
    size === "card-redesign"
      ? "w-32 h-32 md:w-40 md:h-40 lg:w-56 lg:h-56"
      : size === "responsive" 
        ? "w-20 h-20 md:w-32 md:h-32 lg:w-44 lg:h-44 text-2xl md:text-3xl lg:text-4xl" 
        : size === "lg" 
          ? "h-24 w-24 text-2xl" 
          : size === "sm" 
            ? "h-10 w-10 text-xs" 
            : "h-16 w-16 text-lg";

  const brandPrimary = team?.colors?.[0] ?? "#f59e0b"; // gold/amber fallback
  const brandSecondary = team?.colors?.[1] ?? "#10b981"; // emerald fallback
  const initials = team?.shortName ?? "XI";
  const name = team?.name ?? "Cricket Club";
  const mascotName = team ? getMascotForTeam(team.name) : "Lion";
  const badgeStyle = getBadgeStyle(name);
  const logoImage = team ? getTeamLogoImage(team.name) : null;

  return (
    <div className={cn("relative shrink-0 select-none", dimensions, className)}>
      {/* Persistent SVG definition for Chroma Key White Background Removal */}
      <svg className="absolute w-0 h-0 pointer-events-none opacity-0" aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="removeWhiteBg" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              -3.8 -3.8 -3.8 11 -0.4
            " />
          </filter>
        </defs>
      </svg>

      {/* RENDER SPORTS/RAW VARIANT */}
      {variant === "sports" || variant === "raw" ? (
        logoImage ? (
          <div className="w-full h-full aspect-square flex items-center justify-center overflow-visible bg-transparent relative border-none">
            {/* Soft dynamic color glow behind mascot */}
            <div 
              className="absolute inset-0 rounded-full blur-3xl opacity-30 pointer-events-none"
              style={{ background: brandPrimary }}
            />
            <img 
              src={`${logoImage}?v=1.3`} 
              alt={`${name} Mascot`} 
              className="w-[80%] h-[80%] md:w-[85%] md:h-[85%] lg:w-[90%] lg:h-[90%] max-w-[90%] max-h-[90%] object-contain bg-transparent relative z-10 transition-all duration-300 drop-shadow-[0_0_25px_rgba(255,255,255,0.15)] drop-shadow-[0_0_40px_rgba(16,185,129,0.25)]"
              style={{ filter: "url(#removeWhiteBg)", mixBlendMode: "screen" }}
            />
          </div>
        ) : (
          <div className="w-full h-full aspect-square flex items-center justify-center overflow-visible bg-transparent relative border-none">
            {/* Soft dynamic color glow behind mascot */}
            <div 
              className="absolute inset-0 rounded-full blur-3xl opacity-30 pointer-events-none"
              style={{ background: brandPrimary }}
            />
            <svg 
              viewBox="0 0 100 100" 
              className="w-[80%] h-[80%] md:w-[85%] md:h-[85%] lg:w-[90%] lg:h-[90%] drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)] hover:scale-[1.05] transition-transform duration-300 overflow-visible"
              role="img"
              aria-label={`${name} Esports Emblem`}
            >
              <defs>
                <linearGradient id={`sportsShieldBg-${team?.id ?? "default"}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={`${brandSecondary}22`} />
                  <stop offset="100%" stopColor="#0B0F14" />
                </linearGradient>
                <linearGradient id={`sportsBorder-${team?.id ?? "default"}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={brandPrimary} />
                  <stop offset="100%" stopColor={brandSecondary} />
                </linearGradient>
              </defs>
              
              {/* Glow path */}
              <path 
                d="M 16 16 L 50 8 L 84 16 L 84 56 C 84 76, 50 94, 50 94 C 50 94, 16 76, 16 56 Z" 
                fill="none" 
                stroke={brandPrimary} 
                strokeWidth="6" 
                opacity="0.5" 
                className="blur-[2px]" 
              />

              {/* Main Shield Plate */}
              <path 
                d="M 16 16 L 50 8 L 84 16 L 84 56 C 84 76, 50 94, 50 94 C 50 94, 16 76, 16 56 Z" 
                fill={`url(#sportsShieldBg-${team?.id ?? "default"})`} 
                stroke={`url(#sportsBorder-${team?.id ?? "default"})`} 
                strokeWidth="3.5" 
              />

              {/* Mascot Emblem centered in the shield */}
              <g transform="translate(0, 0) scale(0.95)" transform-origin="50 50">
                <MascotEmblem mascot={mascotName} color={brandPrimary} />
              </g>
            </svg>
          </div>
        )
      ) : (
        /* 
          High-End Classy Sports Franchise Crest.
          Uses a unified SVG structure. If a generated logo image is present, we render it
          with an SVG chroma-key filter matrix. This removes ONLY the solid white/off-white 
          background of the generated logo, leaving the mascot colors 100% vibrant, opaque, 
          and bright, perfectly blending into our dark stadium gradient background.
        */
        logoImage ? (
        <div className="w-full h-full relative flex items-center justify-center">
          {/* Symmetrical Neon Silhouette Glow */}
          <div 
            className="absolute inset-1.5 rounded-[22px] blur-[10px] opacity-85 transition-all duration-300 animate-pulse"
            style={{ background: `radial-gradient(circle, ${brandPrimary} 0%, transparent 75%)` }}
          />
          {/* Classy outer metallic frame */}
          <div 
            className="absolute inset-0 rounded-[24px] border-2 p-1 flex items-center justify-center overflow-hidden transition-all duration-300 shadow-[0_12px_24px_rgba(0,0,0,0.6)]"
            style={{ 
              borderColor: brandPrimary,
              background: "#000000"
            }}
          >
            {/* Inner silver lining */}
            <div className="w-full h-full rounded-[20px] border border-slate-700/40 p-1 flex items-center justify-center relative">
              <img 
                src={`${logoImage}?v=1.3`} 
                alt={`${name} Mascot`} 
                className="w-[95%] h-[95%] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.75)] transform hover:scale-[1.06] transition-transform duration-300 relative z-10"
                style={{ filter: "url(#removeWhiteBg)" }}
              />
              
              {/* Gloss Highlight Curvature Overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-[20px]" />
              

            </div>
          </div>
        </div>
      ) : (
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)] hover:scale-[1.03] transition-transform duration-300"
          role="img"
          aria-label={`${name} Cricket League Emblem (${mascotName})`}
        >
          <defs>
            {/* Symmetrical dark backdrop gradient */}
            <radialGradient id={`shieldBg-${team?.id ?? "default"}`} cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#111111" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>

            {/* Luxury Metallic Gold Gradient */}
            <linearGradient id={`goldBorder-${team?.id ?? "default"}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF2D4" />
              <stop offset="30%" stopColor="#D4AF37" />
              <stop offset="50%" stopColor="#8A6414" />
              <stop offset="70%" stopColor="#DFAC6C" />
              <stop offset="100%" stopColor="#5C3B0D" />
            </linearGradient>

            {/* Premium Metallic Silver Gradient */}
            <linearGradient id={`silverBorder-${team?.id ?? "default"}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#94A3B8" />
              <stop offset="70%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>

            {/* Path for curved text wraps inside circular badges */}
            <path id={`circleTextPath-${team?.id ?? "default"}`} d="M 12 50 A 38 38 0 1 1 88 50" fill="none" />
          </defs>

          {/* 1. Heavy Neon Silhouette Highlight Glow */}
          {badgeStyle === "circle" ? (
            <circle cx="50" cy="50" r="46" fill="none" stroke={brandPrimary} strokeWidth="6" opacity="0.65" className="blur-[3px]" />
          ) : badgeStyle === "shield" ? (
            <path d="M 16 16 L 50 8 L 84 16 L 84 56 C 84 76, 50 94, 50 94 C 50 94, 16 76, 16 56 Z" fill="none" stroke={brandPrimary} strokeWidth="6" opacity="0.65" className="blur-[3px]" />
          ) : badgeStyle === "modern" ? (
            <path d="M 14 10 L 86 10 L 80 64 L 50 94 L 20 64 Z" fill="none" stroke={brandPrimary} strokeWidth="6" opacity="0.65" className="blur-[3px]" />
          ) : (
            <path d="M 15 15 L 85 15 L 85 60 C 85 82, 50 95, 50 95 C 50 95, 15 82, 15 60 Z" fill="none" stroke={brandPrimary} strokeWidth="6" opacity="0.65" className="blur-[3px]" />
          )}

          {/* 2. Outer Shield Base Plate */}
          {badgeStyle === "circle" ? (
            <circle cx="50" cy="50" r="46" fill={`url(#shieldBg-${team?.id ?? "default"})`} stroke={`url(#goldBorder-${team?.id ?? "default"})`} strokeWidth="4" />
          ) : badgeStyle === "shield" ? (
            <path d="M 16 16 L 50 8 L 84 16 L 84 56 C 84 76, 50 94, 50 94 C 50 94, 16 76, 16 56 Z" fill={`url(#shieldBg-${team?.id ?? "default"})`} stroke={`url(#goldBorder-${team?.id ?? "default"})`} strokeWidth="4" />
          ) : badgeStyle === "modern" ? (
            <path d="M 14 10 L 86 10 L 80 64 L 50 94 L 20 64 Z" fill={`url(#shieldBg-${team?.id ?? "default"})`} stroke={`url(#goldBorder-${team?.id ?? "default"})`} strokeWidth="4" />
          ) : (
            <path d="M 15 15 L 85 15 L 85 60 C 85 82, 50 95, 50 95 C 50 95, 15 82, 15 60 Z" fill={`url(#shieldBg-${team?.id ?? "default"})`} stroke={`url(#goldBorder-${team?.id ?? "default"})`} strokeWidth="4" />
          )}

          {/* 3. Crossed Cricket Bats & Wickets Backdrop */}
          <g stroke={`url(#goldBorder-${team?.id ?? "default"})`} strokeWidth="2.5" strokeLinecap="round" opacity="0.22" fill="none">
            <path d="M 28 28 L 72 72 M 25 25 L 31 31" />
            <path d="M 72 28 L 28 72 M 75 25 L 69 31" />
            <line x1="45" y1="40" x2="45" y2="78" strokeWidth="1.8" />
            <line x1="50" y1="36" x2="50" y2="78" strokeWidth="1.8" />
            <line x1="55" y1="40" x2="55" y2="78" strokeWidth="1.8" />
            <line x1="43" y1="38" x2="57" y2="38" strokeWidth="1.5" />
          </g>

          {/* 4. Silver Inner Framing Lines */}
          {badgeStyle === "circle" ? (
            <circle cx="50" cy="50" r="41" fill="none" stroke={`url(#silverBorder-${team?.id ?? "default"})`} strokeWidth="1.5" opacity="0.45" />
          ) : badgeStyle === "shield" ? (
            <path d="M 21 20 L 50 14 L 79 20 L 79 54 C 79 70, 50 87, 50 87 C 50 87, 21 70, 21 54 Z" fill="none" stroke={`url(#silverBorder-${team?.id ?? "default"})`} strokeWidth="1.5" opacity="0.45" />
          ) : badgeStyle === "modern" ? (
            <path d="M 19 15 L 81 15 L 75 60 L 50 87 L 25 60 Z" fill="none" stroke={`url(#silverBorder-${team?.id ?? "default"})`} strokeWidth="1.5" opacity="0.45" />
          ) : (
            <path d="M 20 20 L 80 20 L 80 56 C 80 75, 50 87, 50 87 C 50 87, 20 75, 20 56 Z" fill="none" stroke={`url(#silverBorder-${team?.id ?? "default"})`} strokeWidth="1.5" opacity="0.45" />
          )}

          {/* 5. Curved Text Wrapping or Championship Stars */}
          {badgeStyle === "circle" ? (
            <g>
              <text className="font-display font-black text-[7px] tracking-[0.25em] fill-white opacity-85">
                <textPath href={`#circleTextPath-${team?.id ?? "default"}`} startOffset="50%" textAnchor="middle">
                  {name.toUpperCase()}
                </textPath>
              </text>
              <g fill={brandPrimary} opacity="0.75" transform="translate(50, 50)">
                <polygon points="0,-37 1,-34 4,-34 2,-32 3,-29 0,-31 -3,-29 -2,-32 -4,-34 -1,-34" transform="rotate(-65)" />
                <polygon points="0,-37 1,-34 4,-34 2,-32 3,-29 0,-31 -3,-29 -2,-32 -4,-34 -1,-34" transform="rotate(65)" />
              </g>
            </g>
          ) : (
            <g fill={`url(#goldBorder-${team?.id ?? "default"})`} transform="translate(50, 20) scale(0.65)" opacity="0.9">
              <polygon points="0,-10 3,-3 10,-3 5,2 7,9 0,5 -7,9 -5,2 -10,-3 -3,-3" />
              <polygon points="-16,-7 -13,0 -6,0 -11,5 -9,12 -16,8 -23,12 -21,5 -26,0 -19,0" />
              <polygon points="16,-7 19,0 26,0 21,5 23,12 16,8 9,12 11,5 6,0 13,0" />
            </g>
          )}

          {/* 6. Mascot Vector Symbol Fallback */}
          <g transform="translate(0, 3)">
            <MascotEmblem mascot={mascotName} color={brandPrimary} />
          </g>

          {/* 7. Classy Cricket Ball Graphic overlay */}
          <g transform="translate(50, 70) scale(0.85)">
            <circle cx="0" cy="0" r="7.5" fill="#e11d48" stroke="#ffffff" strokeWidth="1.2" />
            <path d="M -5.3 -5.3 Q 0 0 -5.3 5.3 M 5.3 -5.3 Q 0 0 5.3 5.3" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="1.5,1.5" fill="none" opacity="0.9" />
          </g>

          {/* 8. Glass Highlight Layer */}
          <path 
            d="M 14 18 C 35 11, 65 11, 86 18 C 86 18, 78 48, 50 53 C 22 48, 14 18, 14 18 Z" 
            fill="#ffffff" 
            opacity="0.04" 
          />


        </svg>
      ))}
    </div>
  );
}
