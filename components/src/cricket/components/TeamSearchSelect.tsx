import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Team } from "../types";
import { TeamAvatar } from "./TeamAvatar";

export function TeamSearchSelect({
  label,
  teams,
  value,
  blockedId,
  onChange,
}: {
  label: string;
  teams: Team[];
  value: string;
  blockedId?: string;
  onChange: (teamId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = teams.find((team) => team.id === value);
  const filtered = useMemo(() => teams.filter((team) => team.name.toLowerCase().includes(query.toLowerCase())), [teams, query]);

  return (
    <div className="relative">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-panel-2 p-3 text-left transition hover:border-primary/50 hover:bg-primary/5"
        style={{ borderColor: "var(--l-divider)", backgroundColor: "var(--l-card)" }}
      >
        <TeamAvatar team={selected} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-black text-foreground">{selected?.name}</span>
          <span className="text-xs text-muted-foreground">Tap to search team</span>
        </span>
        <ChevronDown className={cn("h-5 w-5 text-foreground/60 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl backdrop-blur-2xl"
             style={{ backgroundColor: "var(--l-card)", borderColor: "var(--l-divider)" }}>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2"
               style={{ borderBottomColor: "var(--l-divider)" }}>
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              placeholder="Search teams..."
            />
          </div>
          <div className="max-h-72 overflow-auto p-2">
            {filtered.map((team) => {
              const disabled = team.id === blockedId;
              const active = team.id === value;
              return (
                <button
                  key={team.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(team.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition",
                    disabled ? "cursor-not-allowed opacity-30" : "hover:bg-primary/5",
                  )}
                  style={{
                    backgroundColor: active ? "var(--l-accent-soft)" : "transparent",
                    color: "var(--l-foreground)",
                  }}
                >
                  <TeamAvatar team={team} size="sm" />
                  <span className="font-semibold text-foreground">{team.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
