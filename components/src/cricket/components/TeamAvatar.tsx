import { Shield, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Team } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";

export function TeamAvatar({ team, size = "md", className }: { team?: Team; size?: "sm" | "md" | "lg"; className?: string }) {
  const dimensions = size === "lg" ? "h-24 w-24 text-2xl" : size === "sm" ? "h-10 w-10 text-xs" : "h-16 w-16 text-lg";
  const colors = team?.colors ?? ["#22d3ee", "#8b5cf6"];

  return (
    <div className={cn("relative shrink-0", dimensions, className)}>
      <Avatar 
        className="w-full h-full border border-white/15 shadow-[0_0_34px_rgba(34,211,238,.35)]"
        style={{
          background: `radial-gradient(circle at 35% 20%, ${colors[0]} 0, transparent 28%), linear-gradient(135deg, ${colors[0]}, ${colors[1]} 58%, #050505)`,
        }}
      >
        <AvatarImage src={team?.logo} alt={team?.shortName ?? "Team Logo"} />
        <AvatarFallback className="bg-transparent">
          <div className="absolute inset-1 rounded-full bg-black/55 backdrop-blur-sm" />
          <Shield className="absolute h-3/5 w-3/5 text-white/10" />
          <span className="relative font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,.75)]">{team?.shortName ?? "XI"}</span>
        </AvatarFallback>
      </Avatar>
      {size === "lg" && <Trophy className="absolute -bottom-1 -right-1 z-10 h-7 w-7 rounded-full bg-black/80 p-1.5 text-cyan-200" />}
    </div>
  );
}
