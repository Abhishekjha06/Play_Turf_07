import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Team } from "../types";

export function TeamAvatar({ team, size = "md", className }: { team?: Team; size?: "sm" | "md" | "lg"; className?: string }) {
  const dimensions = size === "lg" ? "h-24 w-24 text-2xl" : size === "sm" ? "h-10 w-10 text-xs" : "h-16 w-16 text-lg";
  const colors = team?.colors ?? ["#22d3ee", "#8b5cf6"];
  const initials = team?.shortName ?? "XI";

  return (
    <div className={cn("relative shrink-0", dimensions, className)}>
      {/* Crisp vector team crest: initials on the team's brand gradient.
          No external image / no blur — always sharp and matches the team name. */}
      <div
        className="relative w-full h-full rounded-full border border-white/15 shadow-[0_0_34px_rgba(34,211,238,.35)] flex items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(circle at 35% 20%, ${colors[0]} 0, transparent 28%), linear-gradient(135deg, ${colors[0]}, ${colors[1]} 58%, #050505)`,
        }}
        role="img"
        aria-label={team ? `${team.name} logo` : "Team logo"}
      >
        {/* subtle inner ring for a polished crest edge */}
        <span className="pointer-events-none absolute inset-[3px] rounded-full ring-1 ring-white/25" />
        <span className="relative font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,.75)] leading-none select-none">
          {initials}
        </span>
      </div>
      {size === "lg" && <Trophy className="absolute -bottom-1 -right-1 z-10 h-7 w-7 rounded-full bg-black/80 p-1.5 text-cyan-200" />}
    </div>
  );
}
