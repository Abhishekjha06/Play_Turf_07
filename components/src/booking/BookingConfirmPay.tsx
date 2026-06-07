import React from "react";
import { Calendar, Clock, IndianRupee, ShieldCheck } from "lucide-react";
import { Card } from "@/ui/Card";
import { SlideToConfirm } from "@/ui/SlideToConfirm";
import { VsBadge } from "@/cricket/components/VsBadge";
import { TeamAvatar } from "@/cricket/components/TeamAvatar";
import { cn } from "@/lib/utils";

interface BookingConfirmPayProps {
    turf: any;
    booking: any;
    cricket: any;
    total: number;
    pay: () => void;
    paymentMethods: Array<{ value: string; label: string; icon: any }>;
}

function TeamSummary({ team }: { team: any }) {
    return (
        <div className="min-w-0 text-center">
            <TeamAvatar team={team} size="lg" className="mx-auto border border-border/40 shadow-sm" />
            <p className="mt-2.5 truncate text-xs font-black text-foreground font-display">{team?.name}</p>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div
            className="rounded-2xl border p-3 text-center transition-all duration-300"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
        >
            <p className="text-[8px] font-extrabold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-xs font-black text-foreground font-display">{value}</p>
        </div>
    );
}

function Row({ icon: Icon, label, value, valueClass }: { icon: any; label: string; value: string; valueClass?: string }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-2 text-muted-foreground uppercase font-bold tracking-wider">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </span>
            <span className={valueClass ?? "text-foreground font-semibold"}>{value}</span>
        </div>
    );
}

export function BookingConfirmPay({
    turf,
    booking,
    cricket,
    total,
    pay,
    paymentMethods
}: BookingConfirmPayProps) {
    return (
        <div className="mt-4 px-4 pb-32">
            <Card
                className="relative p-5 transition-all duration-300"
                bordered
            >
                <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-neon" />

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <TeamSummary team={cricket.teamA} />
                    <VsBadge />
                    <TeamSummary team={cricket.teamB} />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2.5">
                    <MiniStat label="Turf Total" value={`Rs ${total.toLocaleString()}`} />
                    <MiniStat label="Odds Ratio" value={`${cricket.state.odds}x`} />
                    <MiniStat label="Est. Return" value={`Rs ${cricket.potentialWin.toLocaleString()}`} />
                </div>

                <div
                    className="mt-4 rounded-2xl border p-4 transition-all"
                    style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--bg-secondary)" }}
                >
                    <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">Booking ID Reference</p>
                    <p className="break-all text-sm font-black text-foreground font-display mt-0.5">{cricket.state.bookingId}</p>
                </div>
            </Card>

            <Card
                className="mt-4 space-y-4 p-5 transition-all duration-300"
                bordered
            >
                <div className="flex items-center gap-3.5 pb-2 border-b border-[var(--border-primary)]">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/20 flex-shrink-0">
                        <img src={turf.image} alt={turf.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="font-black text-foreground font-display text-sm">{turf.name}</p>
                        <p className="text-xs text-muted-foreground font-semibold mt-0.5">{turf.city}, India</p>
                    </div>
                </div>
                <Row icon={Calendar} label="Reserved Date" value={booking.date} />
                <Row icon={Clock} label="Reserved Time" value={`${booking.start_time} - ${booking.end_time}`} />
                <Row icon={IndianRupee} label="Base Turf Cost" value={`Rs ${booking.amount}`} valueClass="text-primary font-black font-display text-sm" />
            </Card>

            <Card
                className="mt-4 p-5 transition-all duration-300"
                bordered
            >
                <div className="flex items-center gap-2 text-xs font-black tracking-widest text-primary">
                    <ShieldCheck className="h-4.5 w-4.5 text-primary" /> SECURE MOCK GATEWAY
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed font-semibold">
                    Select your preferred mock billing profile. This confirms your booking slots instantly inside real-time system logs.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                    {paymentMethods.map((method) => {
                        const Icon = method.icon;
                        const active = method.value === cricket.state.paymentMethod;
                        return (
                            <button
                                key={method.value}
                                onClick={() => cricket.setPaymentMethod(method.value)}
                                className={cn(
                                    "rounded-2xl border p-3 text-left transition-all duration-350 cursor-pointer",
                                    active ? "border-primary shadow-lg scale-[1.02]" : "border-border hover:border-primary/30"
                                )}
                                style={{
                                    backgroundColor: active ? "var(--l-accent-soft)" : "var(--card-bg)",
                                    borderColor: active ? "var(--primary)" : "var(--border-primary)",
                                    boxShadow: active ? "var(--l-shadow-glow)" : "none"
                                }}
                            >
                                <Icon className={cn("mb-2.5 h-4.5 w-4.5", active ? "text-primary animate-pulse" : "text-muted-foreground")} />
                                <span className="font-extrabold text-foreground text-xs block leading-none">{method.label}</span>
                                <span className="mt-1 block text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Demo profile</span>
                            </button>
                        );
                    })}
                </div>
            </Card>

            <div
                className="sticky bottom-0 mx-4 mb-4 z-40 flex items-center justify-between rounded-[24px] border p-4 shadow-2xl backdrop-blur-xl"
                style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--border-primary)",
                }}
            >
                <div>
                    <p className="text-[8px] text-muted-foreground uppercase font-black tracking-wider leading-none">EST. TOTAL CHARGES</p>
                    <p className="text-lg font-black text-primary leading-none mt-1 font-display">
                        Rs {booking.amount}
                    </p>
                </div>
                <SlideToConfirm
                    onConfirm={pay}
                    text="Slide to Pay"
                    successText="Paid & Confirmed"
                    width={200}
                    className="bg-panel hover:bg-panel-2 border-border shadow-neon h-11"
                />
            </div>
        </div>
    );
}
