import React, { useEffect } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
  Lock,
  Bell,
  BellRing,
} from "lucide-react";import { toast } from "sonner";

interface DateOption {
    iso: string;
    day: string;
    num: string;
}

interface BookingDateSelectProps {
    dates: DateOption[];
    date: string;
    setDate: (d: string) => void;
    handlePrevDate: () => void;
    handleNextDate: () => void;
    slots: string[];
    slot: string | null;
    setSlot: (s: string | null) => void;
    bookedSlots: string[];
    hours: number;
    setHours: (h: number) => void;
    formatSlotTime: (s: string) => string;
    currentTime: Date;
    remindedSlots: string[];
onToggleReminder: (slot: string) => void;
}

export function BookingDateSelect({
    dates,
    date,
    setDate,
    handlePrevDate,
    handleNextDate,
    slots,
    slot,
    setSlot,
    bookedSlots,
    hours,
    setHours,
    formatSlotTime,
    currentTime,
    remindedSlots,
onToggleReminder,
}: BookingDateSelectProps) {
    // Collapsible period groups (Morning / Afternoon / Evening)
    const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

    React.useEffect(() => {
        if (slot) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            if (date === todayStr) {
                const [sh, sm] = slot.split(":").map(Number);
                const currentHour = currentTime.getHours();
                const currentMin = currentTime.getMinutes();                if (currentHour > sh || (currentHour === sh && currentMin > sm)) {
                    setSlot(null);
                    toast.warning("Your selected slot has expired.");
                }
            }
        }
    }, [currentTime, slot, date, setSlot]);

    return (
        <>
            {/* DATE SELECTOR */}
            <section className="mt-6 px-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display text-xs font-black text-foreground flex items-center gap-2 uppercase tracking-wide">
                        <Calendar className="w-4 h-4 text-primary" />
                        Choose Date
                    </h2>
                    <div className="flex gap-1.5">
                        <button
                            onClick={handlePrevDate}
                            aria-label="Previous date"
                            className="w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-all hover:bg-panel-2 active:scale-90"
                            style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--card-bg)" }}
                        >
                            <ChevronLeft className="h-4 w-4 text-foreground" />
                        </button>
                        <button
                            onClick={handleNextDate}
                            aria-label="Next date"
                            className="w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-all hover:bg-panel-2 active:scale-90"
                            style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--card-bg)" }}
                        >
                            <ChevronRight className="h-4 w-4 text-foreground" />
                        </button>
                    </div>
                </div>

                {/* pt-2 gives the selected chip's corner check badge room inside the
                    scroll container — overflow-x-auto clips vertical overflow. */}
                <div className="no-scrollbar flex gap-2 overflow-x-auto pt-2 pb-1">
                    {dates.map((d) => {
                        const isSelected = date === d.iso;
                        return (
                            <button
                                key={d.iso}
                                onClick={() => setDate(d.iso)}
                                className="pressable relative flex h-20 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border transition-all duration-300"
                                style={{
                                    backgroundColor: isSelected ? "var(--l-accent-soft)" : "var(--card-bg)",
                                    borderColor: isSelected ? "hsl(var(--primary))" : "var(--border-primary)",
                                    color: "var(--text-primary)",
                                    boxShadow: isSelected ? "var(--l-shadow-glow)" : "var(--shadow-card)",
                                }}
                                data-testid={`date-${d.iso}`}
                            >
                                {isSelected && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-md">
                                        <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3.5} />
                                    </div>
                                )}
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{d.day}</span>
                                <span className="mt-1.5 text-xl font-black leading-none font-display">{d.num}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* TIME SLOT SECTION */}
            <section className="mt-6 px-4">
                <h2 className="font-display text-xs font-black text-foreground flex items-center gap-2 mb-3 uppercase tracking-wide">
                    <Clock className="w-4 h-4 text-primary" />
                    Pick a time slot
                </h2>

                {(() => {
                    const SEGMENTS = [
                        { label: "Morning", icon: "🌅", range: [6, 12] },
                        { label: "Afternoon", icon: "☀️", range: [12, 17] },
                        { label: "Evening", icon: "🌃", range: [17, 24] },
                    ] as const;

                    const getHour = (time: string) => parseInt(time.split(":")[0], 10);

                    const grouped = SEGMENTS.map((segment) => ({
                        ...segment,
                        slots: slots.filter((s) => {
                            const hour = getHour(s);
                            return hour >= segment.range[0] && hour < segment.range[1];
                        }),
                    })).filter((group) => group.slots.length > 0);

                    const isExpiredSlot = (s: string) => {
                        const todayStr = new Date().toLocaleDateString("en-CA");
                        if (date !== todayStr) return false;
                        const [sh, sm] = s.split(":").map(Number);
                        const currentHour = currentTime.getHours();
                        const currentMin = currentTime.getMinutes();
                        return currentHour > sh || (currentHour === sh && currentMin > sm);
                    };

                    return (
                        <div className="space-y-5">
                            {grouped.map((group) => {
                                const freeCount = group.slots.filter(
                                    (s) => !bookedSlots.includes(s) && !isExpiredSlot(s)
                                ).length;
                                const isCollapsed = !!collapsed[group.label];

                                return (
                                    <div key={group.label} className="space-y-2.5">
                                        {/* Period header — tap to collapse the group */}
                                        <button
                                            type="button"
                                            onClick={() => setCollapsed((c) => ({ ...c, [group.label]: !c[group.label] }))}
                                            aria-expanded={!isCollapsed}
                                            className="w-full flex items-center gap-2 cursor-pointer bg-transparent border-none outline-none text-left"
                                        >
                                            <span className="h-7 w-7 rounded-lg bg-primary/10 grid place-items-center text-sm shrink-0">
                                                {group.icon}
                                            </span>
                                            <span className="text-[11px] font-black text-foreground uppercase tracking-widest">
                                                {group.label}
                                            </span>
                                            <span className="h-[1px] flex-1 bg-border/60" />
                                            <span
                                                className="text-[9px] font-extrabold uppercase tracking-wider shrink-0"
                                                style={{ color: freeCount > 0 ? "var(--emerald-primary)" : "var(--text-tertiary)" }}
                                            >
                                                {freeCount > 0 ? `${freeCount} free` : "Full"}
                                            </span>
                                            <ChevronDown
                                                className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${
                                                    isCollapsed ? "-rotate-90" : ""
                                                }`}
                                            />
                                        </button>

                                        {!isCollapsed && (
                                            <div className="grid grid-cols-3 gap-2.5">
                                                {group.slots.map((s) => {
                                                    const booked = bookedSlots.includes(s);
                                                    const isSelected = slot === s;
                                                    const isReminderSet = remindedSlots.includes(s);
                                                    const formattedTime = formatSlotTime(s);
                                                    const isExpired = isExpiredSlot(s);
                                                    const isDisabled = booked || isExpired;

                                                    // Bell only for booked slots that are NOT locked/expired
                                                    const showReminder = booked && !isExpired;

                                                    return (
                                                        <div key={s} className="relative">
                                                            {/* 🔔 Alert Bell */}
                                                            {showReminder && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onToggleReminder(s);
                                                                    }}
                                                                    aria-label={
                                                                        isReminderSet
                                                                            ? `Cancel alert for ${formattedTime}`
                                                                            : `Alert me when ${formattedTime} becomes available`
                                                                    }
                                                                    title={
                                                                        isReminderSet
                                                                            ? "Cancel alert"
                                                                            : "Notify me when available"
                                                                    }
                                                                    className="absolute -top-1.5 -right-1.5 z-20 w-7 h-7 rounded-full border shadow-md flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                                                                    style={{
                                                                        backgroundColor: "var(--card-bg)",
                                                                        borderColor: "var(--border-primary)",
                                                                    }}
                                                                >
                                                                    {isReminderSet ? (
                                                                        <BellRing className="w-3.5 h-3.5 text-primary" />
                                                                    ) : (
                                                                        <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                                                                    )}
                                                                </button>
                                                            )}

                                                            {/* Time Slot */}
                                                            <button
                                                                type="button"
                                                                disabled={isDisabled}
                                                                onClick={() => {
                                                                    if (!isDisabled) setSlot(s);
                                                                }}
                                                                aria-label={`${formattedTime}${isDisabled ? " — unavailable" : " — available"}`}
                                                                className={`pressable relative w-full rounded-2xl border p-3 flex flex-col items-center justify-center gap-1 transition-all duration-300 disabled:cursor-not-allowed ${
                                                                    isSelected ? "border-transparent" : ""
                                                                }`}
                                                                style={{
                                                                    backgroundColor: isSelected
                                                                        ? "hsl(var(--primary))"
                                                                        : isDisabled
                                                                        ? "var(--bg-secondary)"
                                                                        : "var(--card-bg)",
                                                                    borderColor: isSelected
                                                                        ? "transparent"
                                                                        : "var(--border-primary)",
                                                                    opacity: isDisabled ? 0.45 : 1,
                                                                    boxShadow: isSelected
                                                                        ? "var(--shadow-neon)"
                                                                        : isDisabled
                                                                        ? "none"
                                                                        : "var(--shadow-card)",
                                                                }}
                                                            >
                                                                {/* Selected Check */}
                                                                {isSelected && (
                                                                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-md ring-2" style={{ backgroundColor: "var(--card-bg)", boxShadow: "var(--shadow-card)", ["--tw-ring-color" as any]: "var(--card-bg)" }}>
                                                                        <Check className="w-3 h-3 text-primary" strokeWidth={3.5} />
                                                                    </div>
                                                                )}

                                                                {/* Time */}
                                                                <span
                                                                    className="text-xs font-black font-display"
                                                                    style={{ color: isSelected ? "hsl(var(--primary-foreground))" : undefined }}
                                                                >
                                                                    {formattedTime}
                                                                </span>

                                                                {/* Status — icon only for a cleaner grid */}
                                                                {isExpired || booked ? (
                                                                    <Lock className="w-3 h-3 text-muted-foreground" />
                                                                ) : isSelected ? (
                                                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "hsl(var(--primary-foreground))" }} />
                                                                ) : (
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </section>

            {/* DURATION SELECTOR */}
            <section className="mt-6 px-4">
                <h2 className="font-display text-xs font-black text-foreground flex items-center gap-2 mb-3 uppercase tracking-wide">
                    <Clock className="w-4 h-4 text-primary" />
                    Choose Duration
                </h2>
                <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, "custom"].map((h) => {
                        const isSelected = h === "custom" ? hours > 3 : hours === h;
                        const label = h === "custom" ? "+ Hrs" : `${h} Hour${h === 1 ? "" : "s"}`;

                        return (
                            <button
                                key={h}
                                onClick={() => {
                                    if (h === "custom") {
                                        setHours(Math.max(4, hours + 1));
                                    } else {
                                        setHours(h as number);
                                    }
                                }}
                                className="pressable relative h-11 rounded-2xl border font-black text-xs uppercase tracking-wider transition-all duration-350"
                                style={{
                                    backgroundColor: isSelected ? "var(--l-accent-soft)" : "var(--card-bg)",
                                    borderColor: isSelected ? "var(--gold-primary)" : "var(--border-primary)",
                                    color: "var(--text-primary)",
                                    boxShadow: isSelected ? "var(--l-shadow-glow)" : "none",
                                }}
                            >
                                {isSelected && (
                                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-md">
                                        <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3.5} />
                                    </div>
                                )}
                                {h === "custom" && hours > 3 ? `${hours} Hours` : label}
                            </button>
                        );
                    })}
                </div>
            </section>
        </>
    );
}
