import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    ArrowLeft,
    Calendar,
    Clock,
    MapPin,
    CreditCard,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Share2,
    Download,
    RotateCcw,
    Receipt,
    Timer,
    Ticket,
    X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Booking } from "@/data/seed";
import type { OpenGame } from "@/types/openGames";
import { api } from "@/lib/api";
import { MobileShell } from "@/layout/MobileShell";
import { useRealtimeBookingStatus } from "@/lib/realtime";
import { useAuth } from "@/hooks/use-auth";
import { BookingTicket } from "@/booking/BookingTicket";
import { useBookingTicket } from "@/hooks/useBookingTicket";

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
    CONFIRMED: { icon: CheckCircle2, color: "text-[#4ade80]", bg: "bg-[#0d2e1a] border-[#0d2e1a]", label: "Booked" },
    PENDING: { icon: AlertCircle, color: "text-[#f5b942]", bg: "bg-[#2d1e00] border-[#2d1e00]", label: "Pending Payment" },
    CANCELLED: { icon: XCircle, color: "text-[#f87171]", bg: "bg-[#3d1a1a] border-[#3d1a1a]", label: "Cancelled" },
    COMPLETED: { icon: CheckCircle2, color: "text-soft", bg: "bg-white/10 border-white/15", label: "Completed" },
};

const BookingDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [paying, setPaying] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showTicket, setShowTicket] = useState(false);
    const [timeLeftStr, setTimeLeftStr] = useState<string | null>(null);
    const [cancellationExpired, setCancellationExpired] = useState(true);
    const [turf, setTurf] = useState<any>(null);
    const [game, setGame] = useState<OpenGame | null>(null);
    const { user } = useAuth();
    const { ticketRef, downloadPDF, shareTicket, isGenerating } = useBookingTicket();

    useEffect(() => {
        if (!id) return;
        api
            .getBooking(id)
            .then(async (b) => {
                setBooking(b);
                try {
                    const turfData = await api.getTurf(b.turf_id);
                    setTurf(turfData);
                } catch {}
                if (b.open_game_id) {
                    try {
                        const gameData = await api.getOpenGame(b.open_game_id);
                        setGame(gameData);
                    } catch {}
                }
            })
            .catch((err) => setError(err.message || "Booking not found"))
            .finally(() => setLoading(false));
    }, [id]);

    // Track 15-minute cancellation window
    useEffect(() => {
        if (!booking || booking.status !== "CONFIRMED") {
            setTimeLeftStr(null);
            setCancellationExpired(true);
            return;
        }

        const updateCountdown = () => {
            const createdAtTime = new Date(booking.created_at).getTime();
            const deadlineTime = createdAtTime + 15 * 60 * 1000;
            const now = Date.now();
            const diff = deadlineTime - now;

            if (diff <= 0) {
                setTimeLeftStr(null);
                setCancellationExpired(true);
                return;
            }

            setCancellationExpired(false);
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeftStr(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [booking]);

    // Subscribe to real-time booking status changes.
    // When the booking is confirmed/cancelled by an external action,
    // the booking detail page updates automatically and notifies the user.
    useRealtimeBookingStatus(id, (event) => {
        if (!booking) return;

        const updated = { ...booking, status: event.new_status };
        setBooking(updated);

        // Show a prominent toast notification based on the new status
        if (event.new_status === "CONFIRMED") {
            toast.success("Booking Confirmed!", {
                description: `Your booking at ${event.turf_name} on ${event.date} at ${event.start_time} has been confirmed.`,
                duration: 6_000,
            });
        } else if (event.new_status === "CANCELLED") {
            toast.error("Booking Cancelled", {
                description: `Your booking at ${event.turf_name} on ${event.date} at ${event.start_time} has been cancelled.`,
                duration: 6_000,
            });
        } else if (event.new_status === "COMPLETED") {
            toast.success("Session Completed", {
                description: `Your session at ${event.turf_name} has been marked as completed.`,
                duration: 5_000,
            });
        } else if (event.new_status === "PENDING" && event.old_status !== "PENDING") {
            toast.info("Payment Required", {
                description: `Your booking at ${event.turf_name} is awaiting payment.`,
                duration: 5_000,
            });
        }
    });

    const handleCancel = async () => {
        if (!booking) return;
        setCancelling(true);
        try {
            const updated = await api.cancelBooking(booking.id);
            setBooking(updated);
            toast.success("Booking cancelled successfully");
            setShowCancelConfirm(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel booking");
        } finally {
            setCancelling(false);
        }
    };

    const handlePay = async () => {
        if (!booking) return;
        setPaying(true);
        try {
            const updated = await api.payMock(booking.id);
            setBooking(updated);
            toast.success("Payment successful! Booking confirmed.");
        } catch (err: any) {
            toast.error(err.message || "Payment failed");
        } finally {
            setPaying(false);
        }
    };

    const handleShare = async () => {
        if (!booking) return;
        const text = [
            "Play Turf Booking",
            `Booking ID: ${booking.id}`,
            `Turf: ${booking.turf_name}`,
            `Date: ${booking.date}`,
            `Time: ${booking.start_time} - ${booking.end_time}`,
            `Amount: ₹${booking.amount}`,
            `Status: ${booking.status}`,
        ].join("\n");
        if (navigator.share) {
            await navigator.share({ title: "Play Turf Booking", text });
        } else {
            await navigator.clipboard.writeText(text);
            toast.success("Booking details copied");
        }
    };

    if (loading) {
        return (
            <MobileShell>
                <div className="flex min-h-screen items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-sm text-muted2">Loading booking details…</p>
                    </div>
                </div>
            </MobileShell>
        );
    }

    if (error || !booking) {
        return (
            <MobileShell>
                <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
                    <XCircle className="h-12 w-12 text-destructive" />
                    <h2 className="text-lg font-semibold">Booking Not Found</h2>
                    <p className="text-sm text-muted2">{error || "This booking doesn't exist or has been removed."}</p>
                    <button onClick={() => navigate("/bookings")} className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold pressable">
                        Back to Bookings
                    </button>
                </div>
            </MobileShell>
        );
    }

    const cfg = statusConfig[booking.status] || statusConfig.PENDING;
    const StatusIcon = cfg.icon;
    const canCancel = booking.status === "PENDING" || (booking.status === "CONFIRMED" && !cancellationExpired);
    const canPay = booking.status === "PENDING";

    return (
        <MobileShell>
            <div className="min-h-screen pb-8">
                {/* Header */}
                <header className="sticky top-0 z-30 glass flex items-center gap-3 px-4 py-3">
                    <button onClick={() => navigate(-1)} className="pressable rounded-xl p-1.5 hover:bg-white/5">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h1 className="text-base font-semibold flex-1">Booking Details</h1>
                    <button onClick={handleShare} className="pressable rounded-xl p-1.5 hover:bg-white/5">
                        <Share2 className="h-5 w-5 text-muted2" />
                    </button>
                </header>

                <div className="px-4 mt-4 space-y-4">
                    {/* Status Banner */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl border p-4 flex items-center gap-3 ${cfg.bg}`}
                    >
                        <StatusIcon className={`h-8 w-8 ${cfg.color}`} />
                        <div>
                            <p className={`font-bold text-lg ${cfg.color}`}>{cfg.label}</p>
                            <p className="text-xs text-muted2 mt-0.5">
                                {booking.status === "CONFIRMED" && (
                                    cancellationExpired
                                    ? "This booking has been confirmed and can no longer be cancelled."
                                    : `Free cancellation available for: ${timeLeftStr || "15:00"}`
                                )}
                                {booking.status === "PENDING" && "Complete payment to confirm your booking."}
                                {booking.status === "CANCELLED" && "This booking has been cancelled."}
                                {booking.status === "COMPLETED" && "This session has been completed."}
                            </p>
                        </div>
                    </motion.div>

                    {/* Turf Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                    >
                        <Link to={`/turf/${booking.turf_id}`} className="flex items-center gap-3 card-panel rounded-2xl p-3 pressable">
                            <img
                                src={booking.turf_image}
                                alt={booking.turf_name}
                                loading="lazy"
                                decoding="async"
                                className="h-20 w-20 rounded-xl object-cover"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold line-clamp-1">{booking.turf_name}</p>
                                <div className="flex items-center gap-1.5 text-xs text-muted2 mt-1">
                                    <MapPin className="h-3 w-3" />
                                    <span>View turf details</span>
                                </div>
                            </div>
                        </Link>
                    </motion.div>

                    {/* Booking Info */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="card-panel rounded-2xl p-4 space-y-3"
                    >
                        <h3 className="text-sm font-semibold text-muted2 uppercase tracking-wider">Booking Info</h3>
                        <DetailRow icon={Receipt} label="Booking ID" value={booking.id} />
                        <DetailRow icon={Calendar} label="Date" value={formatDate(booking.date)} />
                        <DetailRow icon={Clock} label="Time" value={`${booking.start_time} – ${booking.end_time}`} />
                        <DetailRow icon={Timer} label="Duration" value={`${booking.hours} hour${booking.hours > 1 ? "s" : ""}`} />
                        <DetailRow icon={CreditCard} label="Amount" value={`₹${booking.amount}`} valueClass="neon-text font-bold" />
                        {booking.payment_id && (
                            <DetailRow icon={CheckCircle2} label="Payment ID" value={booking.payment_id} />
                        )}
                        <DetailRow
                            icon={Calendar}
                            label="Booked On"
                            value={new Date(booking.created_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        />
                    </motion.div>

                    {/* Price Breakdown */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="card-panel rounded-2xl p-4 space-y-3"
                    >
                        <h3 className="text-sm font-semibold text-muted2 uppercase tracking-wider">Price Breakdown</h3>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted2">Turf charges ({booking.hours}h)</span>
                            <span>₹{booking.amount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted2">Platform fee</span>
                            <span>₹0</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted2">GST</span>
                            <span>₹0</span>
                        </div>
                        <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-bold">
                            <span>Total</span>
                            <span className="neon-text">₹{booking.amount}</span>
                        </div>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-3"
                    >
                        {canPay && (
                            <button
                                onClick={handlePay}
                                disabled={paying}
                                className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold pressable disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {paying ? (
                                    <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Processing…
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="h-4 w-4" />
                                        Pay ₹{booking.amount} & Confirm
                                    </>
                                )}
                            </button>
                        )}

                        {booking.status === "CONFIRMED" && (
                            <button
                                onClick={() => setShowTicket(true)}
                                className="w-full rounded-2xl border border-primary/40 bg-primary/10 py-3 text-sm font-semibold text-primary pressable flex items-center justify-center gap-2"
                            >
                                <Ticket className="h-4 w-4" />
                                View Premium Ticket
                            </button>
                        )}

                        {canCancel && (
                            <>
                                <button
                                    onClick={() => setShowCancelConfirm(true)}
                                    className="w-full rounded-2xl border border-destructive/40 bg-destructive/10 py-3 text-sm font-semibold text-destructive pressable flex items-center justify-center gap-2"
                                >
                                    <XCircle className="h-4 w-4" />
                                    Cancel Booking
                                </button>

                                <AnimatePresence>
                                    {showCancelConfirm && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                                                <p className="text-sm text-center">
                                                    Are you sure you want to cancel this booking?
                                                    <br />
                                                    <span className="text-xs text-muted2">This action cannot be undone.</span>
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setShowCancelConfirm(false)}
                                                        className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold pressable"
                                                    >
                                                        Keep Booking
                                                    </button>
                                                    <button
                                                        onClick={handleCancel}
                                                        disabled={cancelling}
                                                        className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold pressable disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                    >
                                                        {cancelling ? (
                                                            <>
                                                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                                Cancelling…
                                                            </>
                                                        ) : (
                                                            "Yes, Cancel"
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        )}

                        {booking.status === "CANCELLED" && (
                            <Link
                                to={`/turf/${booking.turf_id}`}
                                className="w-full rounded-2xl border border-primary/40 bg-primary/10 py-3 text-sm font-semibold text-primary pressable flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Rebook This Turf
                            </Link>
                        )}

                        {booking.status === "COMPLETED" && (
                            <Link
                                to={`/turf/${booking.turf_id}`}
                                className="w-full rounded-2xl border border-primary/40 bg-primary/10 py-3 text-sm font-semibold text-primary pressable flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Book Again
                            </Link>
                        )}
                    </motion.div>
                </div>

                {/* Premium Ticket Modal */}
                {showTicket && (
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md overflow-y-auto p-4"
                        >
                            <div className="max-w-lg mx-auto">
                                <div className="flex items-center justify-between mb-4 sticky top-0 z-10 py-2">
                                    <h3 className="text-lg font-bold text-white">Your Booking Ticket</h3>
                                    <button
                                        onClick={() => setShowTicket(false)}
                                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer border-none"
                                    >
                                        <X className="w-5 h-5 text-white" />
                                    </button>
                                </div>
                                <BookingTicket
                                    ref={ticketRef}
                                    booking={booking}
                                    turf={turf || undefined}
                                    game={game || undefined}
                                    user={user ? { name: user.name, email: user.email } : undefined}
                                    onDownload={() => {
                                        if (ticketRef.current) {
                                            downloadPDF(ticketRef.current, `PlayTurf-Booking-${booking.id}`);
                                        }
                                    }}
                                    onShare={() => shareTicket({
                                        bookingId: booking.id,
                                        turfName: booking.turf_name,
                                        sport: turf?.sport_types?.[0] || game?.sport || "Football",
                                        date: booking.date,
                                        startTime: booking.start_time,
                                        endTime: booking.end_time,
                                        duration: booking.hours,
                                        amount: booking.amount,
                                        status: booking.status,
                                        paymentId: booking.payment_id,
                                        playerName: user?.name || "Player",
                                        hostName: game?.host_name,
                                        address: turf?.address || game?.venue,
                                        paymentMethod: "UPI",
                                        slots: game ? `${game.slots_filled}/${game.slots_total}` : undefined,
                                        bookedAt: booking.created_at,
                                    })}
                                    isGenerating={isGenerating}
                                />
                            </div>
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </MobileShell>
    );
};

function DetailRow({
    icon: Icon,
    label,
    value,
    valueClass,
}: {
    icon: typeof Calendar;
    label: string;
    value: string;
    valueClass?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-muted2">
                <Icon className="h-4 w-4" />
                <span className="text-sm">{label}</span>
            </div>
            <span className={`text-sm text-right ${valueClass || ""}`}>{value}</span>
        </div>
    );
}

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr + "T00:00:00");
        return d.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

export default BookingDetail;
