import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    CheckCircle2,
    CreditCard,
    MapPin,
    Settings,
    Smartphone,
    Tag,
    Trophy,
    User,
    Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { Card } from "@/ui/Card";
import { api } from "@/lib/api";
import type { Booking as TurfBooking, Turf } from "@/data/seed";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeSlots } from "@/lib/realtime";
import { CricketBookingProvider, useCricketBooking } from "@/cricket/BookingContext";
import { TeamManagerModal } from "@/cricket/components/TeamManagerModal";
import { ExclusiveTabs } from "@/ui/exclusive-tab";

// Extracted Components
import { BookingDateSelect } from "@/booking/BookingDateSelect";
import { BookingMatchSummary } from "@/booking/BookingMatchSummary";
import { BookingConfirmPay } from "@/booking/BookingConfirmPay";
import { BookingSuccessReceipt } from "@/booking/BookingSuccessReceipt";

type Step = "pick" | "confirm" | "success";

const slots = ["06:00", "07:00", "08:00", "09:00", "10:00", "12:00", "14:00", "16:00", "18:00", "19:00", "20:00", "22:00"];

const paymentMethods = [
    { value: "UPI", label: "Fake UPI", icon: Smartphone },
    { value: "Card", label: "Card", icon: CreditCard },
    { value: "Wallet", label: "Wallet", icon: Wallet },
];

function dateLabels() {
    const out: { iso: string; day: string; num: string }[] = [];
    for (let i = 0; i < 8; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        out.push({
            iso: d.toISOString().slice(0, 10),
            day: d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
            num: String(d.getDate()),
        });
    }
    return out;
}

const formatSlotTime = (timeStr: string) => {
    const [hourStr] = timeStr.split(":");
    const hour = parseInt(hourStr, 10);
    const ampm = (hour >= 12 && hour < 24) ? "PM" : "AM";
    return `${timeStr} ${ampm}`;
};

const BookingContent = () => {
    const { turfId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const cricket = useCricketBooking();
    const dates = useMemo(dateLabels, []);

    const [turf, setTurf] = useState<Turf | null>(null);
    const [step, setStep] = useState<Step>("pick");
    const [date, setDate] = useState(dates[0].iso);
    const [slot, setSlot] = useState<string | null>(null);
    const [hours, setHours] = useState(1);
    const [booking, setBooking] = useState<TurfBooking | null>(null);
    const [managerOpen, setManagerOpen] = useState(false);
    const [bookedSlots, setBookedSlots] = useState<string[]>([]);
    const [activeView, setActiveView] = useState("all");

    useEffect(() => {
        if (turfId) api.getTurf(turfId).then(setTurf);
    }, [turfId]);

    // Fetch booked slots on date/turf change
    useEffect(() => {
        if (!turfId || !date) return;
        api.bookedSlots(turfId, date).then((booked) => {
            setBookedSlots(booked);
            if (slot && booked.includes(slot)) setSlot(null);
        });
    }, [turfId, date, slot]);

    // Subscribe to real-time slot changes for this turf
    useRealtimeSlots(turfId, (event: any) => {
        if (event.date === date) {
            api.bookedSlots(turfId!, date).then((booked) => {
                setBookedSlots(booked);
                if (slot && booked.includes(slot)) setSlot(null);
                if (event.status === "CONFIRMED" || event.status === "PENDING") {
                    toast.info("Slot availability updated", {
                        description: `A slot at ${event.start_time} was just booked`,
                    });
                } else if (event.status === "CANCELLED" || event.status === "DELETED") {
                    toast.success("A slot just opened up!", {
                        description: `The ${event.start_time} slot is now available`,
                    });
                }
            });
        }
    });

    const total = (turf?.price_per_hour ?? 0) * hours;
    const placedAt = cricket.state.placedAt ? new Date(cricket.state.placedAt) : new Date();

    // Sync cricket booking amount with turf total amount
    useEffect(() => {
        cricket.setAmount(total);
    }, [total, cricket]);

    const onBack = () => {
        if (step === "confirm") setStep("pick");
        else if (step === "success") navigate("/");
        else if (window.history.length > 1) navigate(-1);
        else navigate("/");
    };

    const proceed = async () => {
        if (!user) {
            toast.error("Please sign in first");
            navigate("/login");
            return;
        }
        if (!slot) {
            toast.error("Pick a time slot");
            return;
        }
        if (!cricket.teamA || !cricket.teamB || cricket.teamA.id === cricket.teamB.id) {
            toast.error("Pick two different teams");
            return;
        }
        if (!turf) return;

        try {
            const b = await api.createBooking({ turf_id: turf.id, date, start_time: slot, hours });
            setBooking(b);
            setStep("confirm");
        } catch (e) {
            toast.error((e as Error).message);
        }
    };

    const pay = async () => {
        if (!booking) return;
        try {
            const b = await api.payMock(booking.id);
            setBooking(b);
            cricket.completeBooking();
            setStep("success");
            toast.success("Payment successful");
        } catch (e) {
            toast.error((e as Error).message);
        }
    };

    const handlePrevDate = () => {
        const idx = dates.findIndex((d) => d.iso === date);
        if (idx > 0) setDate(dates[idx - 1].iso);
    };

    const handleNextDate = () => {
        const idx = dates.findIndex((d) => d.iso === date);
        if (idx < dates.length - 1) setDate(dates[idx + 1].iso);
    };

    const handleResetSelection = () => {
        setDate(dates[0].iso);
        setSlot(null);
        setHours(1);
        toast.info("Selections reset successfully");
    };

    if (!turf) {
        return (
            <MobileShell>
                <div className="p-6 text-center font-bold" style={{ color: "var(--text-secondary)" }}>
                    Loading Premium Turf...
                </div>
            </MobileShell>
        );
    }

    return (
        <MobileShell>
            {/* ── HEADER ── */}
            <header
                className="sticky top-0 z-30 border-b backdrop-blur-md px-4 py-3 flex flex-col gap-2 transition-all duration-300"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-primary)" }}
            >
                {/* Top Logo and Action Bar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-4.5 w-4.5 text-primary animate-pulse" />
                        <span className="text-xs font-black font-display tracking-widest text-foreground">
                            PLAYTURF
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setManagerOpen(true)}
                            className="px-2.5 py-1 rounded-xl border border-border bg-panel hover:bg-panel-2 text-foreground font-black text-[9px] tracking-wider uppercase cursor-pointer flex items-center gap-1.5 transition-all"
                            style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--card-bg)" }}
                        >
                            <User className="h-3 w-3 text-muted-foreground" /> Team Manager
                        </button>
                        <button
                            onClick={() => navigate("/theme")}
                            className="grid h-7.5 w-7.5 place-items-center rounded-xl border border-border bg-panel hover:bg-panel-2 cursor-pointer transition-all"
                            style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--card-bg)" }}
                            title="Theme Settings"
                        >
                            <Settings className="h-4 w-4 text-foreground" />
                        </button>
                    </div>
                </div>

                {/* Step Indicator and Title */}
                <div className="flex items-center justify-between gap-3 mt-1.5 relative">
                    <div className="absolute left-0">
                        <BackButton onClick={onBack} />
                    </div>

                    <div className="flex-1 text-center flex flex-col items-center">
                        <span
                            className="text-[9px] font-extrabold tracking-widest px-2.5 py-0.5 rounded-full uppercase"
                            style={{ backgroundColor: "var(--l-accent-soft)", color: "var(--primary)", border: "1px solid var(--border-primary)" }}
                        >
                            Step {step === "pick" ? 1 : step === "confirm" ? 2 : 3} of 3
                        </span>
                        <h2 className="text-xl font-black text-foreground font-display mt-1.5">
                            {step === "pick" ? "Pick Match" : step === "confirm" ? "Confirm Bet & Pay" : "Payment Receipt"}
                        </h2>
                        {step === "pick" && (
                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                                Choose your teams, date & time
                            </p>
                        )}
                    </div>
                </div>
            </header>

            <AnimatePresence mode="wait">
                {/* ── STEP 1: PICK MATCH ── */}
                {step === "pick" && (
                    <motion.div key="pick" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="pb-4 pt-2">

                        <div className="px-4 mt-2">
                            <ExclusiveTabs
                                activeTab={activeView}
                                onChange={setActiveView}
                                tabs={[
                                    { id: "all", label: "All Types" },
                                    { id: "match", label: "Matches" },
                                    { id: "practice", label: "Practice Nets" }
                                ]}
                            />
                        </div>

                        {/* HERO / VENUE CARD */}
                        <section className="mt-4 px-4">
                            <Card className="p-4 flex flex-col gap-3.5 transition-all duration-300" bordered hoverable>
                                <div className="flex gap-4">
                                    <div className="relative w-28 h-20 rounded-2xl overflow-hidden border border-border/20 flex-shrink-0">
                                        <img src={turf.image} alt={turf.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="text-base font-black text-foreground truncate font-display">
                                                {turf.name}
                                            </h3>
                                            <CheckCircle2 className="h-4 w-4 text-blue-500 fill-blue-500/10 flex-shrink-0" />
                                        </div>

                                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold mt-1">
                                            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                            <span className="truncate">{turf.city}, India</span>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                                            <span
                                                className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                                                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
                                            >
                                                <Trophy className="h-2.5 w-2.5 text-primary" /> Indoor Cage
                                            </span>
                                            <span
                                                className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                                                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
                                            >
                                                <Tag className="h-2.5 w-2.5 text-primary" /> ID: {turf.id}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-[1px] border-t border-[var(--border-primary)]" />

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider leading-none">Total Amount</p>
                                        <p className="text-xl font-black text-foreground mt-1 font-display">
                                            ₹{total.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </section>

                        {/* Extracted Date & Time Component */}
                        <BookingDateSelect
                            dates={dates}
                            date={date}
                            setDate={setDate}
                            handlePrevDate={handlePrevDate}
                            handleNextDate={handleNextDate}
                            slots={slots}
                            slot={slot}
                            setSlot={setSlot}
                            bookedSlots={bookedSlots}
                            hours={hours}
                            setHours={setHours}
                            formatSlotTime={formatSlotTime}
                        />

                        {/* Extracted Match Summary Component */}
                        <BookingMatchSummary
                            turf={turf}
                            date={date}
                            slot={slot}
                            hours={hours}
                            total={total}
                            cricket={cricket}
                            formatSlotTime={formatSlotTime}
                        />

                        {/* BOTTOM ACTION BAR */}
                        <div
                            className="sticky bottom-0 mx-4 mt-6 z-40 flex items-center justify-between rounded-[24px] border p-4 shadow-2xl backdrop-blur-xl"
                            style={{
                                backgroundColor: "var(--bg-secondary)",
                                borderColor: "var(--border-primary)",
                                boxShadow: "var(--shadow-primary)",
                            }}
                        >
                            <div>
                                <p className="text-[8px] text-muted-foreground uppercase font-black tracking-wider leading-none">Selected Slot</p>
                                <p className="text-xs font-black text-foreground mt-0.5 truncate max-w-[130px]">
                                    {slot ? `${date} • ${slot}` : "No Slot Selected"}
                                </p>
                                <p className="text-lg font-black text-primary leading-none mt-1">
                                    Rs {total}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleResetSelection}
                                    className="pressable h-11 px-4 rounded-full border bg-panel hover:bg-panel-2 text-foreground text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center"
                                    style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--card-bg)" }}
                                >
                                    Reset
                                </button>
                                <button
                                    onClick={proceed}
                                    disabled={!slot || !cricket.teamA || !cricket.teamB}
                                    className="pressable h-11 px-6 rounded-full font-black text-xs tracking-wide bg-gradient-neon text-primary-foreground shadow-neon disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>

                    </motion.div>
                )}

                {/* ── STEP 2: CONFIRM BET & PAY ── */}
                {step === "confirm" && booking && (
                    <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <BookingConfirmPay
                            turf={turf}
                            booking={booking}
                            cricket={cricket}
                            total={total}
                            pay={pay}
                            paymentMethods={paymentMethods}
                        />
                    </motion.div>
                )}

                {/* ── STEP 3: SUCCESS ── */}
                {step === "success" && booking && (
                    <BookingSuccessReceipt
                        turf={turf}
                        booking={booking}
                        cricket={cricket}
                        total={total}
                        placedAt={placedAt}
                        navigate={navigate}
                    />
                )}
            </AnimatePresence>

            <TeamManagerModal open={managerOpen} onOpenChange={setManagerOpen} />
        </MobileShell>
    );
};

const Booking = () => (
    <CricketBookingProvider>
        <BookingContent />
    </CricketBookingProvider>
);

export default Booking;
