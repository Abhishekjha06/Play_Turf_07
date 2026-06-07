import React from "react";
import { Calendar, Clock, MapPin, ShieldCheck, Trophy, Sparkles, Crown } from "lucide-react";
import { MeteorImpactBorder } from "@/app/component2/proui/meteor-impact-border";
import { VsBadge } from "@/cricket/components/VsBadge";
import { TeamSelectorCard } from "./components/TeamSelectorCard";

interface BookingMatchSummaryProps {
    turf: any;
    date: string;
    slot: string | null;
    hours: number;
    total: number;
    cricket: any;
    formatSlotTime: (s: string) => string;
}

function RowItem({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
    return (
        <div className="flex items-start gap-3 text-xs">
            <span className="text-muted-foreground uppercase font-extrabold tracking-wider flex items-center gap-1.5 shrink-0 w-24">
                <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {label}
            </span>
            <span className="font-black text-foreground text-right flex-1 min-w-0 break-words">{value}</span>
        </div>
    );
}

export function BookingMatchSummary({
    turf,
    date,
    slot,
    hours,
    total,
    cricket,
    formatSlotTime
}: BookingMatchSummaryProps) {
    return (
        <>
            <section className="mt-6 px-4">
                <h2 className="font-display text-xs font-black text-foreground flex items-center gap-2 mb-3 uppercase tracking-wide">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Match Summary
                </h2>

                <MeteorImpactBorder className="rounded-[26px]">
                    <div
                        className="rounded-3xl border p-5 shadow-xl flex flex-col gap-6 transition-all duration-300 w-full"
                        style={{
                            backgroundColor: "var(--card-bg)",
                            borderColor: "var(--border-primary)",
                            boxShadow: "var(--shadow-primary)",
                        }}
                    >
                        <div className="flex items-center gap-3 justify-center">
                            <TeamSelectorCard
                                side="A"
                                teams={cricket.state.teams}
                                selectedId={cricket.state.teamAId}
                                blockedId={cricket.state.teamBId}
                                onChange={cricket.setTeamA}
                            />
                            <VsBadge />
                            <TeamSelectorCard
                                side="B"
                                teams={cricket.state.teams}
                                selectedId={cricket.state.teamBId}
                                blockedId={cricket.state.teamAId}
                                onChange={cricket.setTeamB}
                            />
                        </div>

                        <div className="flex flex-col gap-3.5 border-t border-[var(--border-primary)] pt-5">
                            <RowItem label="Turf" value={turf.name} icon={MapPin} />
                            <RowItem label="Date" value={new Date(date).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "long", day: "numeric" })} icon={Calendar} />
                            <RowItem label="Time" value={slot ? formatSlotTime(slot) : "Not Selected"} icon={Clock} />
                            <RowItem label="Duration" value={`${hours} Hour${hours === 1 ? "" : "s"}`} icon={Clock} />

                            <div className="h-[1px] border-t border-dashed border-[var(--border-primary)] my-1" />

                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-muted-foreground uppercase">Amount</span>
                                <span className="text-lg font-black text-primary font-display">₹{total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </MeteorImpactBorder>
            </section>

            <section className="mt-8 mb-6 px-4">
                <h2 className="font-display text-xs font-black text-foreground flex items-center gap-2 mb-3 uppercase tracking-wide">
                    <ShieldCheck className="w-4 h-4 text-primary animate-pulse" />
                    Match Insights & Security
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    {[
                        { title: "Secure Booking", desc: "SSL encrypted sports club reservation protection", icon: ShieldCheck, badge: "Verified" },
                        { title: "Instant Confirmation", desc: "Real-time Supabase sync with BoxCric main office", icon: Sparkles, badge: "Live" },
                        { title: "Team Protection Roster", desc: "Priority checks for locker room & umpire allocations", icon: Trophy, badge: "Protected" },
                        { title: "Premium Concierge Support", desc: "24/7 client booking assistance from luxury hosts", icon: Crown, badge: "VIP Support" }
                    ].map((insight) => {
                        const Icon = insight.icon;
                        return (
                            <div
                                key={insight.title}
                                className="rounded-2xl border p-4 flex gap-3 items-start transition-all duration-300 hover:scale-[1.01]"
                                style={{
                                    backgroundColor: "var(--card-bg)",
                                    borderColor: "var(--border-primary)",
                                    boxShadow: "var(--shadow-primary)",
                                }}
                            >
                                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                    <Icon className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="text-xs font-black text-foreground font-display uppercase tracking-wider">
                                            {insight.title}
                                        </h4>
                                        <span
                                            className="text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full animate-pulse"
                                            style={{ backgroundColor: "var(--l-badge-bg)", color: "var(--l-badge-text)" }}
                                        >
                                            {insight.badge}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1 leading-normal font-semibold">
                                        {insight.desc}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </>
    );
}
