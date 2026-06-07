import type { Booking } from "@/data/seed";
import { Calendar, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";

const statusStyleLegacy: Record<string, string> = {
  CONFIRMED: "bg-primary/15 text-primary border border-primary/40",
  PENDING: "bg-warning/15 text-warning border border-warning/40",
  CANCELLED: "bg-destructive/15 text-destructive border border-destructive/40",
  COMPLETED: "bg-white/10 text-soft border border-white/15",
};

const statusStylePremium: Record<string, { bg: string; color: string }> = {
  CONFIRMED: { bg: "rgba(34,197,94,0.12)", color: "#22C55E" },
  PENDING: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  CANCELLED: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
  COMPLETED: { bg: "rgba(100,116,139,0.10)", color: "#64748B" },
};

export function BookingRow({ booking }: { booking: Booking }) {
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";

  if (isPremium) {
    const statusStyle = statusStylePremium[booking.status] ?? statusStylePremium.COMPLETED;
    return (
      <Link
        to={`/booking/${booking.id}`}
        className="flex items-center gap-3 pressable"
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 8px 30px rgba(15,23,42,0.08)",
          padding: "12px",
        }}
        data-testid={`booking-row-${booking.id}`}
      >
        <img
          src={booking.turf_image}
          alt={booking.turf_name}
          loading="lazy"
          decoding="async"
          className="object-cover flex-shrink-0"
          style={{ height: "60px", width: "60px", borderRadius: "14px" }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold line-clamp-1"
            style={{ fontSize: "14px", color: "#0F172A" }}
          >
            {booking.turf_name}
          </p>
          <div
            className="flex items-center gap-3 mt-0.5"
            style={{ fontSize: "11px", color: "#64748B" }}
          >
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {booking.date}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {booking.start_time}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span
              className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold"
              style={{
                background: statusStyle.bg,
                color: statusStyle.color,
                border: `1px solid ${statusStyle.color}30`,
              }}
            >
              {booking.status}
            </span>
            <p
              className="font-bold"
              style={{ fontSize: "15px", color: "#14B8B0" }}
            >
              ₹{booking.amount}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  // Legacy
  return (
    <Link
      to={`/booking/${booking.id}`}
      className="flex items-center gap-3 card-panel rounded-2xl p-3 pressable"
      data-testid={`booking-row-${booking.id}`}
    >
      <img
        src={booking.turf_image}
        alt={booking.turf_name}
        loading="lazy"
        decoding="async"
        className="h-14 w-14 rounded-xl object-cover"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm line-clamp-1">{booking.turf_name}</p>
        <div className="flex items-center gap-3 text-[11px] text-muted2 mt-0.5">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {booking.date}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {booking.start_time}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusStyleLegacy[booking.status]}`}
          >
            {booking.status}
          </span>
          <p className="text-sm font-bold neon-text">₹{booking.amount}</p>
        </div>
      </div>
    </Link>
  );
}
