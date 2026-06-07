import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { MeteorImpactBorder } from "@/app/component2/proui/meteor-impact-border";
import { TeamAvatar } from "@/cricket/components/TeamAvatar";
import { cn } from "@/lib/utils";

interface TeamSelectorCardProps {
    side: "A" | "B";
    teams: any[];
    selectedId: string;
    blockedId?: string;
    onChange: (id: string) => void;
}

export function TeamSelectorCard({
    side,
    teams,
    selectedId,
    blockedId,
    onChange
}: TeamSelectorCardProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const selected = teams.find((t) => t.id === selectedId);

    const filtered = useMemo(() =>
        teams.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())),
        [teams, query]
    );

    return (
        <div className="relative flex-1 min-w-0">
            <MeteorImpactBorder className="rounded-2xl transition-all duration-300 hover:scale-[1.02] w-full">
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="w-full rounded-[14px] p-4 text-center flex flex-col items-center justify-center gap-2 cursor-pointer bg-transparent border-none outline-none"
                >
                    <TeamAvatar team={selected} size="lg" className="border border-border/40 shadow-sm mx-auto" />
                    <p className="text-[8px] font-extrabold uppercase tracking-widest text-muted-foreground leading-none">Team {side}</p>
                    <h4 className="text-xs font-black text-foreground truncate max-w-full leading-none font-display">
                        {selected?.name || `Select Team ${side}`}
                    </h4>
                    <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider leading-none">
                        {selected?.shortName || "Tap to select"}
                    </p>
                </button>
            </MeteorImpactBorder>

            {open && (
                <div
                    className="absolute z-50 mt-2 w-56 overflow-hidden rounded-2xl border bg-panel shadow-2xl backdrop-blur-xl"
                    style={{
                        backgroundColor: "var(--card-bg)",
                        borderColor: "var(--border-primary)",
                        left: side === "B" ? "auto" : "-1rem",
                        right: side === "B" ? "-1rem" : "auto",
                    }}
                >
                    <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderBottomColor: "var(--border-primary)" }}>
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="h-9 w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                            placeholder="Search teams..."
                            autoFocus
                        />
                    </div>
                    <div className="max-h-60 overflow-auto p-1.5 flex flex-col gap-1">
                        {filtered.map((t) => {
                            const disabled = t.id === blockedId;
                            const active = t.id === selectedId;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => {
                                        onChange(t.id);
                                        setOpen(false);
                                        setQuery("");
                                    }}
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition",
                                        disabled ? "cursor-not-allowed opacity-30" : "hover:bg-primary/5",
                                    )}
                                    style={{
                                        backgroundColor: active ? "var(--l-accent-soft)" : "transparent",
                                        color: "var(--l-foreground)",
                                    }}
                                >
                                    <TeamAvatar team={t} size="sm" />
                                    <span className="font-semibold text-foreground truncate">{t.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
