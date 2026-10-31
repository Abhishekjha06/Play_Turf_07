import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Search, Users, X } from "lucide-react";
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

    const pick = (id: string) => {
        onChange(id);
        setOpen(false);
        setQuery("");
    };

    return (
        <div className="relative flex-1 min-w-0">
            <MeteorImpactBorder className="rounded-2xl transition-all duration-300 hover:scale-[1.02] w-full">
                <motion.div whileTap={{ scale: 0.97 }}>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        aria-haspopup="dialog"
                        className="w-full rounded-[14px] px-2 py-3 text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-transparent border-none outline-none"
                    >
                        <TeamAvatar team={selected} size="lg" className="h-20 w-20 border border-border/40 shadow-sm mx-auto" />
                        <p className="text-[8px] font-extrabold uppercase tracking-widest text-muted-foreground leading-none">
                            Team {side}
                        </p>
                        <h4 className="text-[13px] font-black text-foreground line-clamp-2 leading-tight font-display min-w-0">
                            {selected?.name || `Select Team ${side}`}
                        </h4>
                        <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider leading-none flex items-center gap-1">
                            {selected?.shortName || "Tap to select"}
                            <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
                        </p>
                    </button>
                </motion.div>
            </MeteorImpactBorder>

            {/* Team picker — bottom sheet so the list is readable on mobile */}
            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="fixed inset-0 z-[45] bg-black/70 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: "100%", x: "-50%" }}
                            animate={{ y: 0, x: "-50%" }}
                            exit={{ y: "100%", x: "-50%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-[480px] max-h-[80dvh] flex-col bg-card rounded-t-[2rem] border-t border-border shadow-2xl"
                            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
                            role="dialog"
                            aria-label={`Select team ${side}`}
                        >
                            <div className="flex items-center justify-between border-b border-border px-5 pt-4 pb-3">
                                <h3 className="font-display font-black text-sm text-foreground flex items-center gap-2">
                                    <Users className="h-4 w-4 text-primary" />
                                    Select Team {side}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="p-1 hover:bg-muted rounded-full cursor-pointer text-muted-foreground hover:text-foreground border-none bg-transparent"
                                    aria-label="Close"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mx-5 mt-3 bg-panel-2 border border-border rounded-xl px-3">
                                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="h-10 w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50 border-none"
                                    placeholder="Search teams..."
                                    autoFocus
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
                                {filtered.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-6">
                                        No teams match “{query}”
                                    </p>
                                )}
                                {filtered.map((t) => {
                                    const disabled = t.id === blockedId;
                                    const active = t.id === selectedId;
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => pick(t.id)}
                                            className={cn(
                                                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs transition-all border bg-transparent",
                                                active
                                                    ? "border-primary/40 bg-primary/5"
                                                    : disabled
                                                        ? "border-transparent opacity-30 cursor-not-allowed"
                                                        : "border-transparent hover:bg-muted/60 cursor-pointer"
                                            )}
                                        >
                                            <TeamAvatar team={t} size="sm" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block font-bold text-foreground truncate">{t.name}</span>
                                                {t.shortName && (
                                                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">
                                                        {t.shortName}
                                                    </span>
                                                )}
                                            </span>
                                            {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                                            {disabled && (
                                                <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground shrink-0">
                                                    Picked
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
