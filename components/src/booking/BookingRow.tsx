import type { Booking } from "@/data/seed";
import { Calendar, Clock, Copy, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

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
  // Determine duration and end time
  const duration = booking.durationHours || booking.hours || 1;
  const endTimeStr = booking.end_time || booking.start_time; // Fallback

  // Determine actual status and style (Upcoming, Past, Cancelled)
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

  return (
    <Link
      to={`/booking/${booking.id}`}
      className="flex items-start gap-4 card-panel rounded-[2rem] p-4.5 pressable border border-[var(--border-primary)] transition hover:border-primary/40 block text-left"
      style={{ backgroundColor: "var(--card-bg)" }}
      data-testid={`booking-row-${booking.id}`}
    >
      <img
        src={booking.turf_image}
        alt={booking.turf_name}
        loading="lazy"
        decoding="async"
        className="h-16 w-16 rounded-2xl object-cover flex-shrink-0 border border-white/5 shadow-md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-extrabold text-sm text-foreground line-clamp-1 font-display">
            {booking.turf_name}
          </p>
          <span
            className="text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border"
            style={{
              background: statusBg,
              color: statusColor,
              borderColor: `${statusColor}30`,
            }}
          >
            {statusText}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground font-semibold">
          <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5 font-mono">
            ID: {booking.id}
          </span>
          <button
            onClick={handleCopyId}
            className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground cursor-pointer transition"
            title="Copy ID"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-3 text-[11px] text-muted-foreground font-semibold border-t border-[var(--border-primary)] pt-3">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            {booking.date}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-primary" />
            {formatSlotTime(booking.start_time)} - {formatSlotTime(endTimeStr)}
          </span>
          <span className="col-span-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Duration: <strong className="text-foreground font-black font-display">{duration} Hour{duration > 1 ? "s" : ""}</strong>
          </span>
        </div>

        <div className="flex items-center justify-between mt-3 border-t border-[var(--border-primary)] pt-2.5">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Amount Paid</span>
          <p className="text-base font-black text-foreground font-display">₹{booking.amount}</p>
        </div>
      </div>
    </Link>
  );
}
