import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/ui/card";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Shield, AlertCircle, XCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
    format,
    isSameDay,
    addDays,
    startOfMonth,
    addMonths,
    subMonths,
    getDay,
    getDaysInMonth,
    isToday,
    isSameMonth,
} from "date-fns";

export const DashboardCalendar = React.memo(function DashboardCalendar() {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const bookedDates = useMemo(() => {
        const today = new Date();
        return [
        { date: today, booked: 3, available: 5, status: "booked" as const },
        { date: addDays(today, 1), booked: 2, available: 6, status: "booked" as const },
        { date: addDays(today, 2), booked: 2, available: 6, status: "partial" as const },
        { date: addDays(today, 3), booked: 1, available: 7, status: "booked" as const },
        { date: addDays(today, 5), booked: 2, available: 6, status: "partial" as const },
        { date: addDays(today, 7), booked: 4, available: 4, status: "booked" as const },
        { date: addDays(today, 8), booked: 0, available: 0, status: "blocked" as const },
        { date: addDays(today, 10), booked: 1, available: 7, status: "partial" as const },
        { date: addDays(today, 12), booked: 3, available: 5, status: "booked" as const },
        { date: addDays(today, 14), booked: 0, available: 0, status: "blocked" as const },
        { date: addDays(today, -1), booked: 2, available: 6, status: "booked" as const },
        { date: addDays(today, -3), booked: 1, available: 7, status: "partial" as const },
        { date: addDays(today, -5), booked: 3, available: 5, status: "booked" as const },
        { date: addDays(today, -7), booked: 1, available: 7, status: "partial" as const },
        { date: addDays(today, 4), booked: 0, available: 8, status: "available" as const },
        { date: addDays(today, 6), booked: 0, available: 8, status: "available" as const },
        { date: addDays(today, 9), booked: 0, available: 8, status: "available" as const },
        { date: addDays(today, 11), booked: 0, available: 8, status: "available" as const },
    ];
    }, []);

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const daysInMonth = getDaysInMonth(monthStart);
        const startDay = getDay(monthStart);
        const days: (Date | null)[] = [];
        for (let i = 0; i < startDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
        }
        return days;
    }, [currentMonth]);

    const monthStats = useMemo(() => {
        const totalDays = getDaysInMonth(currentMonth);
        const monthBookedDates = bookedDates.filter(d => isSameMonth(d.date, currentMonth));
        const bookedCount = monthBookedDates.filter(d => d.status === "booked" || d.status === "partial").length;
        const blockedCount = monthBookedDates.filter(d => d.status === "blocked").length;
        const availableCount = totalDays - bookedCount - blockedCount;
        return { totalDays, bookedCount, availableCount, blockedCount };
    }, [currentMonth, bookedDates]);

    const selectedDateBookings = useMemo(() => {
        if (!date) return [];
        const match = bookedDates.find(d => isSameDay(d.date, date));
        if (!match) return [];
        if (match.status === "blocked") return [
            { time: "06:00 – 08:00", customer: "— Blocked —", status: "Blocked", amount: "—" },
            { time: "08:00 – 10:00", customer: "— Blocked —", status: "Blocked", amount: "—" },
            { time: "10:00 – 12:00", customer: "— Blocked —", status: "Blocked", amount: "—" },
            { time: "12:00 – 14:00", customer: "— Blocked —", status: "Blocked", amount: "—" },
            { time: "14:00 – 16:00", customer: "— Blocked —", status: "Blocked", amount: "—" },
            { time: "16:00 – 18:00", customer: "— Blocked —", status: "Blocked", amount: "—" },
            { time: "18:00 – 20:00", customer: "— Blocked —", status: "Blocked", amount: "—" },
            { time: "20:00 – 22:00", customer: "— Blocked —", status: "Blocked", amount: "—" },
        ];
        if (match.status === "partial") return [
            { time: "06:00 – 08:00", customer: "Morning Slot", status: "Available", amount: "₹ 1,200" },
            { time: "08:00 – 10:00", customer: "Vikram R.", status: "Confirmed", amount: "₹ 2,400" },
            { time: "10:00 – 12:00", customer: "Sneha M.", status: "Confirmed", amount: "₹ 2,400" },
            { time: "12:00 – 14:00", customer: "Lunch Break", status: "Available", amount: "₹ 1,200" },
            { time: "14:00 – 16:00", customer: "Arjun P.", status: "Pending", amount: "₹ 3,000" },
            { time: "16:00 – 18:00", customer: "Evening Slot", status: "Available", amount: "₹ 1,800" },
            { time: "18:00 – 20:00", customer: "Karan S.", status: "Confirmed", amount: "₹ 3,600" },
            { time: "20:00 – 22:00", customer: "Night Slot", status: "Available", amount: "₹ 2,000" },
        ];
        return [
            { time: "06:00 – 08:00", customer: "Deepak T.", status: "Confirmed", amount: "₹ 2,400" },
            { time: "08:00 – 10:00", customer: "Rahul Sharma", status: "Confirmed", amount: "₹ 2,400" },
            { time: "10:00 – 12:00", customer: "Priya Patel", status: "Pending", amount: "₹ 3,000" },
            { time: "12:00 – 14:00", customer: "Lunch Break", status: "Available", amount: "₹ 1,200" },
            { time: "14:00 – 16:00", customer: "Amit Kumar", status: "Confirmed", amount: "₹ 3,600" },
            { time: "16:00 – 18:00", customer: "Suresh K.", status: "Confirmed", amount: "₹ 3,000" },
            { time: "18:00 – 20:00", customer: "Neha Singh", status: "Cancelled", amount: "₹ 4,000" },
            { time: "20:00 – 22:00", customer: "Ravi M.", status: "Confirmed", amount: "₹ 3,600" },
        ];
    }, [date, bookedDates]);

    const selectedDateSummary = useMemo(() => {
        if (!date) return { booked: 0, available: 0 };
        const match = bookedDates.find(d => isSameDay(d.date, date));
        if (!match) return { booked: 0, available: 8 };
        if (match.status === "blocked") return { booked: 8, available: 0 };
        return { booked: match.booked, available: match.available };
    }, [date, bookedDates]);

    const getSlotColor = (status: string) => {
        switch (status) {
            case "Available": return { bg: "rgba(20,83,45,.45)", text: "#4ade80" };
            case "Confirmed": return { bg: "rgba(127,29,29,.45)", text: "#fb7185" };
            case "Pending": return { bg: "rgba(161,98,7,.35)", text: "#fbbf24" };
            case "Cancelled": return { bg: "rgba(127,29,29,.35)", text: "#f87171" };
            case "Blocked": return { bg: "rgba(127,29,29,.45)", text: "#f5886a" };
            default: return { bg: "#1a1a2e", text: "#666" };
        }
    };

    const prevMonth = () => setCurrentMonth(m => subMonths(m, 1));
    const nextMonth = () => setCurrentMonth(m => addMonths(m, 1));
    const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    return (
        <Card className="bg-panel-2/60 border-border/50 overflow-hidden">
            <CardContent className="p-4 space-y-4">
                {/* Header with title + month nav */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-xl font-extrabold tracking-tight">Booking Calendar</h2>
                        <p className="text-sm text-gray-400 mt-1">View and manage your turf bookings</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            onClick={prevMonth}
                            className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-[#0f172a] text-white hover:bg-[#1e293b] hover:-translate-y-0.5 transition-all"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div
                            className="flex items-center gap-2 h-9 px-4 rounded-xl font-bold text-sm"
                            style={{
                                background: "linear-gradient(145deg, #27145f, #312e81)",
                                border: "1px solid rgba(167,139,250,.25)",
                                color: "#a78bfa",
                            }}
                        >
                            <CalendarDays className="h-4 w-4" />
                            {format(currentMonth, "MMM yyyy")}
                        </div>
                        <button
                            onClick={nextMonth}
                            className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-[#0f172a] text-white hover:bg-[#1e293b] hover:-translate-y-0.5 transition-all"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
                    <div
                        className="flex items-center gap-3 rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
                        style={{ background: "rgba(91,33,182,.18)", border: "1px solid rgba(139,92,246,.3)" }}
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full text-lg" style={{ background: "rgba(139,92,246,.18)", color: "#c4b5fd" }}>
                            📅
                        </div>
                        <div>
                            <p className="text-2xl font-extrabold" style={{ color: "#a78bfa" }}>{monthStats.totalDays}</p>
                            <p className="text-[0.65rem] tracking-wider text-gray-400 font-semibold">TOTAL DAYS</p>
                        </div>
                    </div>
                    <div
                        className="flex items-center gap-3 rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
                        style={{ background: "rgba(127,29,29,.25)", border: "1px solid rgba(239,68,68,.3)" }}
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full text-lg" style={{ background: "rgba(239,68,68,.18)", color: "#fb7185" }}>
                            🎟️
                        </div>
                        <div>
                            <p className="text-2xl font-extrabold" style={{ color: "#fb7185" }}>{monthStats.bookedCount}</p>
                            <p className="text-[0.65rem] tracking-wider text-gray-400 font-semibold">BOOKED</p>
                        </div>
                    </div>
                    <div
                        className="flex items-center gap-3 rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
                        style={{ background: "rgba(20,83,45,.28)", border: "1px solid rgba(34,197,94,.28)" }}
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full text-lg" style={{ background: "rgba(34,197,94,.18)", color: "#4ade80" }}>
                            ✔
                        </div>
                        <div>
                            <p className="text-2xl font-extrabold" style={{ color: "#4ade80" }}>{monthStats.availableCount}</p>
                            <p className="text-[0.65rem] tracking-wider text-gray-400 font-semibold">AVAILABLE</p>
                        </div>
                    </div>
                </div>

                {/* Calendar grid */}
                <div className="rounded-2xl p-2 min-[380px]:p-3" style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)" }}>
                    <div className="grid grid-cols-7 mb-3">
                        {weekDays.map(d => (
                            <span key={d} className="text-center text-xs font-semibold text-gray-400">{d}</span>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                        {calendarDays.map((dayDate, i) => {
                            if (!dayDate) return <div key={`empty-${i}`} className="min-h-[4.5rem]" />;
                            const match = bookedDates.find(d => isSameDay(d.date, dayDate));
                            const isSelected = date && isSameDay(dayDate, date);
                            const isTodays = isToday(dayDate);
                            const isCurrentMonth = isSameMonth(dayDate, currentMonth);

                            let dayBg = "transparent";
                            let dayBorder = "1px solid transparent";
                            let dayShadow = "none";
                            if (isSelected) {
                                dayBg = "linear-gradient(145deg, #312e81, #1d4ed8)";
                                dayBorder = "2px solid #8b5cf6";
                                dayShadow = "0 0 20px rgba(139,92,246,.4)";
                            } else if (isTodays) {
                                dayBorder = "1px solid rgba(167,139,250,.4)";
                            }

                            return (
                                <button
                                    key={dayDate.toISOString()}
                                    onClick={() => setDate(dayDate)}
                                    className="flex min-h-14 flex-col items-center justify-center rounded-xl p-1 text-center transition-all hover:bg-white/[.03] min-[380px]:min-h-[4.5rem] min-[380px]:rounded-2xl min-[380px]:p-1.5"
                                    style={{ background: dayBg, border: dayBorder, boxShadow: dayShadow }}
                                >
                                    <span className={`text-lg font-bold leading-none ${isSelected ? "text-white" : isTodays ? "text-[#a78bfa]" : "text-gray-200"}`}>
                                        {format(dayDate, "d")}
                                    </span>
                                    {match && match.status !== "available" && (
                                        <div className="mt-1 space-y-0.5">
                                            {match.booked > 0 && (
                                                <p className="text-[0.6rem] font-semibold leading-none" style={{ color: "#fb7185" }}>
                                                    {match.booked} Bkd
                                                </p>
                                            )}
                                            {match.available > 0 && (
                                                <p className="text-[0.6rem] font-semibold leading-none" style={{ color: "#4ade80" }}>
                                                    {match.available} Avl
                                                </p>
                                            )}
                                            {match.status === "blocked" && (
                                                <p className="text-[0.6rem] font-semibold leading-none" style={{ color: "#f5886a" }}>
                                                    Blocked
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {match && match.status === "available" && (
                                        <p className="text-[0.6rem] font-semibold leading-none mt-1" style={{ color: "#4ade80" }}>
                                            {match.available} Avl
                                        </p>
                                    )}
                                    {!match && isCurrentMonth && (
                                        <p className="text-[0.6rem] font-semibold leading-none mt-1 text-gray-600">8 Avl</p>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-4 mt-3 px-2 py-2 rounded-xl" style={{ background: "rgba(255,255,255,.03)" }}>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#fb7185" }} />
                            <span className="text-xs text-gray-400">Booked</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#4ade80" }} />
                            <span className="text-xs text-gray-400">Available</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#fbbf24" }} />
                            <span className="text-xs text-gray-400">Blocked</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#a78bfa" }} />
                            <span className="text-xs text-gray-400">Today</span>
                        </div>
                    </div>
                </div>

                {/* Booking Details for selected date */}
                <AnimatePresence mode="wait">
                    {date && (
                        <motion.div
                            key={date.toISOString()}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="rounded-2xl p-4 space-y-3"
                            style={{
                                background: "rgba(255,255,255,.02)",
                                border: "1px solid rgba(139,92,246,.2)",
                                boxShadow: "0 0 20px rgba(91,33,182,.12)",
                            }}
                        >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="text-base font-extrabold">{format(date, "EEEE, MMM d")}</h3>
                                <div className="flex gap-3 text-sm font-bold">
                                    <span style={{ color: "#fb7185" }}>{selectedDateSummary.booked} Booked</span>
                                    <span style={{ color: "#4ade80" }}>{selectedDateSummary.available} Available</span>
                                </div>
                            </div>

                            <div className="space-y-0">
                                {selectedDateBookings.length > 0 ? selectedDateBookings.map((booking, i) => {
                                    const slotColors = getSlotColor(booking.status);
                                    return (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between gap-2 border-b border-white/5 py-2.5 last:border-b-0"
                                        >
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <div
                                                    className="flex items-center justify-center w-8 h-8 rounded-full"
                                                    style={{ background: "rgba(139,92,246,.12)", color: "#a78bfa" }}
                                                >
                                                    <Clock className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-sm text-gray-200">{booking.time}</span>
                                                    {booking.customer && booking.customer !== "— Blocked —" && booking.customer !== "Lunch Break" && booking.customer !== "Morning Slot" && booking.customer !== "Evening Slot" && booking.customer !== "Night Slot" && (
                                                        <p className="text-[0.65rem] text-gray-500">{booking.customer}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <span
                                                className="shrink-0 rounded-full px-2 py-1.5 text-xs font-bold sm:px-3"
                                                style={{ background: slotColors.bg, color: slotColors.text }}
                                            >
                                                {booking.status}
                                            </span>
                                        </div>
                                    );
                                }) : (
                                    <div className="py-6 text-center text-sm text-gray-500">
                                        No bookings for this date
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
});
