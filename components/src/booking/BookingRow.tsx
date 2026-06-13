import type { Booking } from "@/data/seed";
import { Calendar, Clock, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";

const formatSlotTime = (timeStr: string) => {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const formattedHour = hour.toString().padStart(2, "0");
  return `${formattedHour}:${minStr} ${ampm}`;
};

export function BookingRow({
  booking,
  currentTime = new Date()
}: {
  booking: Booking & { durationHours?: number; end_time?: string };
  currentTime?: Date;
}) {
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";

  // Determine duration and end time
  const duration = booking.durationHours || booking.hours || 1;
  const endTimeStr = booking.end_time || booking.start_time;

  // Determine status (Upcoming, Past, Cancelled)
  let statusText = "Upcoming";
  let statusColor = "#22C55E"; // Green
  let statusBg = "rgba(34, 197, 94, 0.12)";

  if (booking.status === "CANCELLED") {
    statusText = "Cancelled";
    statusColor = "#EF4444"; // Red
    statusBg = "rgba(239, 68, 68, 0.12)";
  } else {
    // Check if past
    const todayStr = currentTime.toLocaleDateString('en-CA');
    let isPast = false;

    if (booking.date < todayStr) {
      isPast = true;
    } else if (booking.date === todayStr) {
      let endH = 0;
      let endM = 0;
      if (endTimeStr.includes("AM") || endTimeStr.includes("PM")) {
        const match = endTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (match) {
          endH = parseInt(match[1], 10);
          endM = parseInt(match[2], 10);
          const ampm = match[3].toUpperCase();
          if (ampm === "PM" && endH < 12) endH += 12;
          if (ampm === "AM" && endH === 12) endH = 0;
        }
      } else {
        const [h, m] = endTimeStr.split(":").map(Number);
        endH = h;
        endM = m;
      }

      const currentH = currentTime.getHours();
      const currentM = currentTime.getMinutes();
      isPast = currentH > endH || (currentH === endH && currentM >= endM);
    }

    if (isPast) {
      statusText = "Past";
      statusColor = "#64748B"; // Grey
      statusBg = "rgba(100, 116, 139, 0.12)";
    }
  }

  const handleCopyId = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(booking.id);
    toast.success("Booking ID copied!");
  };

  // Base card styling properties for text overflow
  const cardStyle = {
    wordBreak: "break-word" as const,
    overflowWrap: "anywhere" as const,
    whiteSpace: "normal" as const,
  };

  if (isPremium) {
    return (
      <Link
        to={`/booking/${booking.id}`}
        className="flex items-start gap-3 pressable text-left mb-3 w-full border border-[#e5e7eb] rounded-[14px] p-3.5 shadow-sm block transition hover:border-[#14B8B0]/50"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          ...cardStyle
        }}
        data-testid={`booking-row-${booking.id}`}
      >
        <img
          src={booking.turf_image}
          alt={booking.turf_name}
          loading="lazy"
          decoding="async"
          className="h-14 w-14 rounded-xl object-cover flex-shrink-0 border border-slate-100"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5 flex-wrap">
            <p className="font-bold text-sm text-[#0F172A] line-clamp-2" style={{ wordBreak: "break-word" }}>
              {booking.turf_name}
            </p>
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
              style={{
                background: statusBg,
                color: statusColor,
                border: `1px solid ${statusColor}30`,
              }}
            >
              {statusText}
            </span>
          </div>

          <div className="flex items-center gap-1 mt-1 text-[10px] text-[#64748B]">
            <span className="bg-[#F8FAFC] px-1.5 py-0.5 rounded border border-[#E2E8F0] font-mono text-[9px]">
              ID: {booking.id}
            </span>
            <button
              onClick={handleCopyId}
              className="p-0.5 hover:bg-[#F1F5F9] rounded text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              title="Copy ID"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5 border-t border-[#F1F5F9] pt-2.5 text-[10.5px] text-[#64748B] font-medium">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-[#14B8B0]" />
              {booking.date}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#14B8B0]" />
              {formatSlotTime(booking.start_time)} - {formatSlotTime(endTimeStr)}
            </span>
            <span className="text-[10px] text-[#64748B] mt-0.5">
              Duration: <strong className="text-[#0F172A] font-bold">{duration} Hr{duration > 1 ? "s" : ""}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between mt-2.5 border-t border-[#F1F5F9] pt-2">
            <span className="text-[9px] uppercase font-bold text-[#64748B] tracking-wider">Amount Paid</span>
            <p className="text-sm font-extrabold text-[#14B8B0]">₹{booking.amount}</p>
          </div>
        </div>
      </Link>
    );
  }

  // Dark Theme / Legacy
  return (
    <Link
      to={`/booking/${booking.id}`}
      className="flex items-start gap-3 pressable text-left mb-3 w-full border rounded-[14px] p-3.5 shadow-md block transition"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--border-primary)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        ...cardStyle
      }}
      data-testid={`booking-row-${booking.id}`}
    >
      <img
        src={booking.turf_image}
        alt={booking.turf_name}
        loading="lazy"
        decoding="async"
        className="h-14 w-14 rounded-xl object-cover flex-shrink-0 border border-white/5 shadow-sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1.5 flex-wrap">
          <p className="font-extrabold text-sm text-foreground line-clamp-2" style={{ wordBreak: "break-word" }}>
            {booking.turf_name}
          </p>
          <span
            className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border"
            style={{
              background: statusBg,
              color: statusColor,
              borderColor: `${statusColor}30`,
            }}
          >
            {statusText}
          </span>
        </div>

        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
          <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5 font-mono text-[9px]">
            ID: {booking.id}
          </span>
          <button
            onClick={handleCopyId}
            className="p-0.5 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground cursor-pointer transition"
            title="Copy ID"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5 border-t border-[var(--border-primary)] pt-2.5 text-[10.5px] text-muted-foreground font-semibold">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            {booking.date}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-primary" />
            {formatSlotTime(booking.start_time)} - {formatSlotTime(endTimeStr)}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            Duration: <strong className="text-foreground font-black font-display">{duration} Hr{duration > 1 ? "s" : ""}</strong>
          </span>
        </div>

        <div className="flex items-center justify-between mt-2.5 border-t border-[var(--border-primary)] pt-2">
          <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Amount Paid</span>
          <p className="text-sm font-black text-foreground font-display">₹{booking.amount}</p>
        </div>
      </div>
    </Link>
  );
}
