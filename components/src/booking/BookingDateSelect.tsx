import React, { useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, Check, Lock } from "lucide-react";
import { toast } from "sonner";

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
    currentTime
}: BookingDateSelectProps) {
    React.useEffect(() => {
        if (slot) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            if (date === todayStr) {
                const [sh, sm] = slot.split(":").map(Number);
                const currentHour = currentTime.getHours();
                const currentMin = currentTime.getMinutes();
                if (currentHour > sh || (currentHour === sh && currentMin > sm)) {
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
                            className="w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-all hover:bg-panel-2 active:scale-90"
                            style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--card-bg)" }}
                        >
                            <ChevronLeft className="h-4 w-4 text-foreground" />
                        </button>
                        <button
                            onClick={handleNextDate}
                            className="w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-all hover:bg-panel-2 active:scale-90"
                            style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--card-bg)" }}
                        >
                            <ChevronRight className="h-4 w-4 text-foreground" />
                        </button>
                    </div>
                </div>

                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {dates.map((d) => {
                        const isSelected = date === d.iso;
                        return (
                            <button
                                key={d.iso}
                                onClick={() => setDate(d.iso)}
                                className="pressable relative flex h-20 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border transition-all duration-300"
                                style={{
                                    backgroundColor: isSelected ? "var(--l-accent-soft)" : "var(--card-bg)",
                                    borderColor: isSelected ? "var(--gold-primary)" : "var(--border-primary)",
                                    color: "var(--text-primary)",
                                    boxShadow: isSelected ? "var(--l-shadow-glow)" : "none",
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
                <div className="grid grid-cols-3 gap-2.5">
                    {slots.map((s) => {
                        const booked = bookedSlots.includes(s);
                        const isSelected = slot === s;
                        const formattedTime = formatSlotTime(s);

                        const isExpired = (() => {
                            const todayStr = new Date().toLocaleDateString('en-CA');
                            if (date !== todayStr) return false;
                            const [sh, sm] = s.split(":").map(Number);
                            const currentHour = currentTime.getHours();
                            const currentMin = currentTime.getMinutes();
                            if (currentHour > sh) return true;
                            if (currentHour === sh && currentMin > sm) return true;
                            return false;
                        })();

                        const isDisabled = booked || isExpired;

                        return (
                            <button
                                key={s}
                                disabled={isDisabled}
                                onClick={() => setSlot(s)}
                                className="pressable relative rounded-2xl border p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: isSelected
                                        ? "var(--l-accent-soft)"
                                        : isDisabled
                                            ? "var(--bg-secondary)"
                                            : "var(--card-bg)",
                                    borderColor: isSelected
                                        ? "var(--gold-primary)"
                                        : isDisabled
                                            ? "var(--border-primary)"
                                            : "var(--border-primary)",
                                    opacity: isDisabled ? 0.45 : 1,
                                    boxShadow: isSelected ? "var(--l-shadow-glow)" : "none",
                                }}
                            >
                                {isSelected && (
                                    <div className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-primary flex items-center justify-center shadow-md">
                                        <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3.5} />
                                    </div>
                                )}

                                <span className="text-xs font-black text-foreground font-display">
                                    {formattedTime}
                                </span>

                                {isExpired ? (
                                    <span className="flex items-center gap-1 text-[8px] text-red-500 uppercase font-extrabold tracking-wider">
                                        <Lock className="w-2.5 h-2.5 text-red-500" /> Lock
                                    </span>
                                ) : booked ? (
                                    <span className="flex items-center gap-1 text-[8px] text-muted-foreground uppercase font-extrabold tracking-wider">
                                        <Lock className="w-2.5 h-2.5 text-muted-foreground" /> Booked
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[8px] uppercase font-extrabold tracking-wider" style={{ color: isSelected ? "var(--gold-primary)" : "var(--emerald-primary)" }}>
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" /> Available
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
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
