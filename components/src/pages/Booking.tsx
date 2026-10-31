import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation,   useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import PushNotificationSettings from "@/components/PushNotificationSettings";
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
import { Card } from "@/ui/card";
import { api } from "@/lib/api";
import type { Booking as TurfBooking, Turf } from "@/data/seed";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeSlots } from "@/lib/realtime";
import { CricketBookingProvider, useCricketBooking } from "@/cricket/BookingContext";
import { TeamManagerModal } from "@/cricket/components/TeamManagerModal";
import { ExclusiveTabs } from "@/ui/exclusive-tab";
import { bookingSchema } from "@/lib/validations";
import { trackEvent } from "@/lib/analytics";

// Extracted Components
import { BookingDateSelect } from "@/booking/BookingDateSelect";
import { BookingMatchSummary } from "@/booking/BookingMatchSummary";
import { BookingConfirmPay } from "@/booking/BookingConfirmPay";
import { BookingSuccessReceipt } from "@/booking/BookingSuccessReceipt";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import {
  Bell,
  BellRing,
} from "lucide-react";

type Step = "pick" | "confirm" | "success";
/// slot reminder
////
const slots = [
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
    "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
    "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
];

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
    const [hourStr, minStr] = timeStr.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const formattedHour = hour.toString().padStart(2, "0");
    return `${formattedHour}:${minStr} ${ampm}`;
};

const BookingContent = () => {

    /// slot reminder
////

    const { turfId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [searchParams] = useSearchParams();

    const sportFromUrl = searchParams.get("sport") || "";

    const [turf, setTurf] = useState<Turf | null>(null);

    const selectedSport =
    sportFromUrl ||
    location.state?.selectedSport ||
    turf?.sport_types?.[0] ||
    "";

    const normalizedSport = selectedSport.trim();

    const { user } = useAuth();
    const cricket = useCricketBooking();

    const dates = useMemo(dateLabels, []);

    const turfDbId = turf?.new_id;
    const [remindedSlots, setRemindedSlots] = useState<string[]>([]);///reminded slot remider

    const [step, setStep] = useState<Step>("pick");
    const [date, setDate] = useState(dates[0].iso);
    const [slot, setSlot] = useState<string | null>(null);
    const [hours, setHours] = useState(1);
    const [booking, setBooking] = useState<TurfBooking | null>(null);
    const [managerOpen, setManagerOpen] = useState(false);
    const [bookedSlots, setBookedSlots] = useState<string[]>([]);
    const [activeView, setActiveView] = useState("all");
    const [currentTime, setCurrentTime] = useState(new Date());

    //
    const [selectedPitch, setSelectedPitch] = useState<any | null>(null);
    const [showCourtPopup, setShowCourtPopup] = useState(false);
    const [courtList, setCourtList] = useState<any[]>([]);
    const [courtLoading, setCourtLoading] = useState(false);
    //



///
    useEffect(() => {
        if (turfId) api.getTurf(turfId).then(setTurf);
    }, [turfId]);




    // Fetch booked slots on date/turf change
    // Lock a time slot ONLY when ALL pitches are booked
        useEffect(() => {
            if (!turfDbId || !date || !normalizedSport) {
                setBookedSlots([]);
                return;
            }

            const loadFullyBookedSlots = async () => {
                try {
                    const result = await api.getCourtAvailability(
                        Number(turfDbId),
                        date,
                        normalizedSport
                    );

                    const pitches = result?.pitches || [];
                    const bookings = result?.bookings || [];

                    if (pitches.length === 0) {
                        setBookedSlots([]);
                        return;
                    }

                    const bookedBySlot: Record<string, Set<number>> = {};

                    bookings.forEach((booking: any) => {
                        const status =
                            String(booking.status).toLowerCase();

                        if (
                            status === "cancelled" ||
                            status === "completed" ||
                            !booking.pitch_id ||
                            !booking.start_time
                        ) {
                            return;
                        }

                        const [hour, minute] =
                            booking.start_time
                                .split(":")
                                .map(Number);

                        const hours =
                            Number(booking.hours) || 1;

                        for (let i = 0; i < hours; i++) {
                            const slotTime =
                                `${String(hour + i).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

                            if (!bookedBySlot[slotTime]) {
                                bookedBySlot[slotTime] =
                                    new Set<number>();
                            }

                            bookedBySlot[slotTime].add(
                                Number(booking.pitch_id)
                            );
                        }
                    });

                    // Lock only when every pitch is booked
                    const fullyBookedSlots =
                        Object.entries(bookedBySlot)
                            .filter(
                                ([, pitchIds]) =>
                                    pitchIds.size >= pitches.length
                            )
                            .map(([slotTime]) => slotTime);

                    setBookedSlots(fullyBookedSlots);

                    // If currently selected slot became fully booked
                    if (
                        slot &&
                        fullyBookedSlots.includes(slot)
                    ) {
                        setSlot(null);
                        setSelectedPitch(null);
                    }

                } catch (error) {
                    console.error(
                        "Failed to load slot availability:",
                        error
                    );

                    setBookedSlots([]);
                }
            };

            loadFullyBookedSlots();
        }, [
            turfDbId,
            date,
            normalizedSport,
            slot,
        ]);

    const total = (turf?.price_per_hour ?? 0) * hours;
    const placedAt = cricket.state.placedAt ? new Date(cricket.state.placedAt) : new Date();

    // Sync cricket booking amount with turf total amount
    useEffect(() => {
        if (cricket.state.amount !== total) {
            cricket.setAmount(total);
        }
    }, [total, cricket.state.amount, cricket]);

    const initiatePayment = () => {
        if (!turf || !slot) return;
        trackEvent("Payment Started", { turfId: turf.id, amount: turf.price_per_hour, date, time: slot });
    };

    const onBack = () => {
        if (step === "confirm") setStep("pick");
        else if (step === "success") navigate("/");
        else if (window.history.length > 1) navigate(-1);
        else navigate("/");
    };

 // pitch pop up
    const selectSlot = async (s: string) => {
        if (!turfDbId || !date || !selectedSport) {
            toast.error("Sport information is missing.");
            return;
}

        setSlot(s);
        setSelectedPitch(null);
        setCourtLoading(true);

        trackEvent("Slot Selected", {
            turfId: turf?.id,
            date,
            time: s,
            sport: selectedSport,
        });

        const result = await api.getCourtAvailability(
            Number(turfDbId),
            date,
            selectedSport
            );

            const booked = (result?.bookings || [])
            .filter((booking: any) => {
                if (
                booking.status === "CANCELLED" ||
                booking.status === "cancelled"
                ) {
                return false;
                }

                if (selectedPitch?.pitch_id != null) {
                return booking.pitch_id === selectedPitch.pitch_id;
                }

                return true;
            })
            .flatMap((booking: any) => {
                const [hour, minute] = booking.start_time
                .split(":")
                .map(Number);

                const hours = Number(booking.hours) || 1;

                return Array.from({ length: hours }, (_, i) =>
                `${String(hour + i).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
                );
            });

        try {
            const result = await api.getCourtAvailability(
                turfDbId,
                date,
                selectedSport
            );

            console.log("COURT AVAILABILITY:", result);

            const courts = (result?.pitches || []).map((pitch: any) => {
            const booked = (result?.bookings || []).some(
                (booking: any) => {
                if (booking.pitch_id !== pitch.pitch_id) {
                    return false;
                }

                if (
                    booking.status === "CANCELLED" ||
                    booking.status === "cancelled"
                ) {
                    return false;
                }

                const bookingStart = booking.start_time;
                const bookingHours = Number(booking.hours) || 1;

                const [bookingHour, bookingMinute] =
                    bookingStart.split(":").map(Number);

                const [slotHour, slotMinute] =
                    s.split(":").map(Number);

                const bookingStartMinutes =
                    bookingHour * 60 + bookingMinute;

                const bookingEndMinutes =
                    bookingStartMinutes + bookingHours * 60;

                const selectedMinutes =
                    slotHour * 60 + slotMinute;

                return (
                    selectedMinutes >= bookingStartMinutes &&
                    selectedMinutes < bookingEndMinutes
                );
                }
            );

            return {
                ...pitch,
                booked,
            };
            });

            console.log("COURTS WITH AVAILABILITY:", courts);

            setCourtList(courts);

            // Open pitch/court popup
            setShowCourtPopup(true);

        } catch (error) {

            console.error(
                "Failed to load court availability:",
                error
            );

            toast.error(
                "Unable to check court availability."
            );

        } finally {

            setCourtLoading(false);
        };
    }
 //
 /// slot reminder
 const handleToggleReminder = async (slot: string) => {
  if (!turfDbId || !date || !selectedSport) {
    toast.error("Missing slot information.");
    return;
  }

  try {
    const supabase = await getSupabase();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser?.id) {
      toast.error("Please login to set a reminder.");
      return;
    }

    const userId = authUser.id;
    const isSet = remindedSlots.includes(slot);

    if (isSet) {
      const { error } = await supabase
        .from("slot_reminders")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
        .eq("turf_id", turfDbId)
        .eq("sport", selectedSport)
        .eq("reminder_date", date)
        .eq("start_time", slot)
        .eq("status", "active");

      if (error) throw error;

      setRemindedSlots((prev) =>
        prev.filter((s) => s !== slot)
      );

      toast.success("Reminder cancelled.");
      return;
    }

    const { error } = await supabase
      .from("slot_reminders")
      .insert({
        user_id: userId,
        turf_id: turfDbId,
        sport: selectedSport,
        reminder_date: date,
        start_time: slot,
        push_enabled: true,
        whatsapp_enabled: false,
      });

    if (error && error.code !== "23505") {
      throw error;
    }

    setRemindedSlots((prev) =>
      prev.includes(slot) ? prev : [...prev, slot]
    );

    toast.success("Reminder set.");
  } catch (error) {
    console.error("Reminder error:", error);
    toast.error("Unable to update reminder.");
  }
};
 ///

    const proceed = async () => {
        // 1. Check login
        if (!user) {
            toast.error("Please sign in first");
            navigate("/login", {
            state: {
                from: location.pathname + location.search,
            },
            });
            return;
        }

        // 2. Check time slot
        if (!slot) {
            toast.error("Pick a time slot");
            return;
        }

        // 3. Check court
        if (!selectedPitch) {
            toast.error("Please select a court");
            return;
        }

        // 4. Check teams
        if (
            !cricket.teamA ||
            !cricket.teamB ||
            cricket.teamA.id === cricket.teamB.id
        ) {
            toast.error("Pick two different teams");
            return;
        }

        if (!turf) return;

        // 5. Validate booking
        const validationResult = bookingSchema.safeParse({
            date,
            startTime: slot,
            hours,
        });

        if (!validationResult.success) {
            toast.error(validationResult.error.errors[0].message);
            return;
        }

        try {
            // 6. Create booking with selected pitch
            const b = await api.createBooking({
            turf_id: turf.id,
            pitch_id: selectedPitch.pitch_id,
            date,
            start_time: slot,
            hours,
            sport: normalizedSport,
            });

            // 7. Move to confirmation
            setBooking(b);
            setStep("confirm");

            trackEvent("Booking Start", {
            turf_id: turf.id,
            turf_name: turf.name,
            amount: total,
            hours,
            });
        } catch (e) {
            toast.error((e as Error).message);
        }
        };

    const pay = async () => {
        if (!booking || !turf || !slot) return;
        try {
            initiatePayment();
            const b = await api.payMock(booking.id);
            setBooking(b);
            cricket.completeBooking();
            setStep("success");

            trackEvent("Payment Success", { bookingId: b.id, amount: turf.price_per_hour });
            trackEvent("Booking Complete", {
                turfId: turf.id,
                bookingId: b.id,
                date,
                time: slot,
                amount: turf.price_per_hour,
            });
            toast.success("Payment successful!");
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
                            className="px-2.5 py-1 rounded-xl border border-border bg-panel hover:bg-panel-2 text-foreground font-black text-xs tracking-wider uppercase cursor-pointer flex items-center gap-1.5 transition-all"
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
                            className="text-xs font-extrabold tracking-widest px-2.5 py-0.5 rounded-full uppercase"
                            style={{ backgroundColor: "var(--l-accent-soft)", color: "var(--primary)", border: "1px solid var(--border-primary)" }}
                        >
                            Step {step === "pick" ? 1 : step === "confirm" ? 2 : 3} of 3
                        </span>
                        <h2 className="text-xl font-black text-foreground font-display mt-1.5">
                            {step === "pick" ? "Pick Match" : step === "confirm" ? "Confirm Bet & Pay" : "Payment Receipt"}
                        </h2>
                        {step === "pick" && (
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
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
                                        <img src={turf.image} alt={turf.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="text-base font-black text-foreground truncate font-display">
                                                {turf.name}
                                            </h3>
                                            <CheckCircle2 className="h-4 w-4 text-blue-500 fill-blue-500/10 flex-shrink-0" />
                                        </div>

                                        <div className="flex items-center gap-1 text-xs text-muted-foreground font-semibold mt-1">
                                            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                            <span className="truncate">{turf.city}, India</span>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                                            {selectedSport && (
                                                <span
                                                    className="text-xs font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full flex items-center gap-1 text-primary border border-primary/30"
                                                    style={{ backgroundColor: "var(--l-accent-soft)" }}
                                                >
                                                    <Trophy className="h-2.5 w-2.5 text-primary" /> {selectedSport}
                                                </span>
                                            )}

                                            <span
                                                className="text-xs font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1"
                                                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
                                            >
                                                <Tag className="h-2.5 w-2.5 text-primary" /> 
                                                  {selectedPitch
                                                    ? selectedPitch.pitch_name ||
                                                    selectedPitch.pitch_code ||
                                                    `Pitch ${selectedPitch.pitch_id}`
                                                    : "Choose Pitch"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-[1px] border-t border-[var(--border-primary)]" />

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-black tracking-wider leading-none">Total Amount</p>
                                        <p className="text-xl font-black text-foreground mt-1 font-display">
                                            ₹{total.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </section>

                        {/* Extracted Date & Time Component */}
                        <div className="mb-4">
                            <PushNotificationSettings />
                        </div>
                        <BookingDateSelect
                            dates={dates}
                            date={date}
                            setDate={setDate}
                            handlePrevDate={handlePrevDate}
                            handleNextDate={handleNextDate}
                            slots={slots}
                            slot={slot}
                            setSlot={selectSlot}
                            bookedSlots={bookedSlots}
                            hours={hours}
                            setHours={setHours}
                            formatSlotTime={formatSlotTime}
                            currentTime={currentTime}
                            remindedSlots={remindedSlots}
                            onToggleReminder={handleToggleReminder}
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
                            selectedSport={selectedSport}
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
                                <p className="text-xs text-muted-foreground uppercase font-black tracking-wider leading-none">Selected Slot</p>
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

                {/* PITCH SELECTION POPUP */}
                <Dialog open={showCourtPopup} onOpenChange={setShowCourtPopup}>
                <DialogContent className="w-[calc(100%-24px)] max-w-[400px] rounded-2xl p-5">
                    
                    <DialogHeader>
                    <DialogTitle>Select Pitch / Court</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-3">
                    {courtLoading ? (
                        <p className="text-center text-sm text-muted-foreground">
                        Checking availability...
                        </p>
                    ) : courtList.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground">
                        No pitches available for {selectedSport}.
                        </p>
                    ) : (
                        courtList.map((court) => (
                        <button
                            key={court.pitch_id}
                            type="button"
                            disabled={court.booked}
                            onClick={() => {
                            setSelectedPitch(court);
                            setShowCourtPopup(false);
                            }}
                            className={`w-full rounded-xl border p-4 text-left transition ${
                            court.booked
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:border-primary"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                            
                            <div>
                                <p className="font-bold">
                                {court.pitch_name || court.pitch_code}
                                </p>

                                <p className="text-xs text-muted-foreground">
                                {court.sports}
                                </p>
                            </div>

                            <span
                                className={`text-xs font-bold ${
                                court.booked
                                    ? "text-red-500"
                                    : "text-green-500"
                                }`}
                            >
                                {court.booked ? "BOOKED" : "AVAILABLE"}
                            </span>

                            </div>
                        </button>
                        ))
                    )}
                    </div>

                </DialogContent>
                </Dialog>

                <TeamManagerModal
                open={managerOpen}
                onOpenChange={setManagerOpen}
                />
            
        </MobileShell>
    );
};

const Booking = () => (
    <CricketBookingProvider>
        <BookingContent />
    </CricketBookingProvider>
);

export default Booking;
