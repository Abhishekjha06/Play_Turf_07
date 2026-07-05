import { memo } from "react";
import type { Booking } from "@/data/seed";
import { Calendar, Clock, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const formatSlotTime = (timeStr: string) => {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour>= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const formattedHour = hour.toString().padStart(2, "0");
  return `${formattedHour}:${minStr} ${ampm}`;
};

export const BookingRow = memo(function BookingRow({
  booking,
  currentTime = new Date()
}: {
  booking: Booking & { durationHours?: number; end_time?: string };
  currentTime?: Date;
}) {


  // Determine duration and end time
  const duration = booking.durationHours || booking.hours || 1;
  const endTimeStr = booking.end_time || booking.start_time;

  // Determine status (Upcoming, Past, Cancelled)
  let statusText = "Upcoming";
  let statusColor = "hsl(var(--color-success))";
  let statusBg = "hsl(var(--color-success-surface))";
  let statusBorder = "hsl(var(--color-success) / 0.18)";

  if (booking.status === "cancelled") {
    statusText = "Cancelled";
    statusColor = "hsl(var(--color-danger))";
    statusBg = "hsl(var(--color-danger-surface))";
    statusBorder = "hsl(var(--color-danger) / 0.18)";
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
      isPast = currentH> endH || (currentH === endH && currentM>= endM);
    }

    if (isPast) {
      statusText = "Past";
      statusColor = "hsl(var(--color-neutral))";
      statusBg = "hsl(var(--color-neutral-surface))";
      statusBorder = "hsl(var(--color-neutral) / 0.18)";
    }
  }

  const handleCopyId = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(booking.id);
    toast.success("Booking ID copied!");
  };

  // Base card styling — safe word breaking only at word boundaries
  const cardStyle = {
    overflowWrap: "break-word" as const,
    whiteSpace: "normal" as const,
  };

  return (
      <Link
        to={`/booking/${booking.id}`} className="flex items-start gap-3 pressable text-left mb-3 w-full border border-[hsl(var(--color-border-default))] rounded-[14px] p-3.5 shadow-sm block transition hover:border-[hsl(var(--color-primary))]/50"
        style={{
          background: "hsl(var(--color-surface-elevated))",
          boxShadow: "var(--shadow-card)",
          ...cardStyle
        }}
        data-testid={`booking-row-${booking.id}`}>
        <img
          src={booking.turf_image}
          alt={booking.turf_name}
          loading="lazy"
          decoding="async" className="h-14 w-14 rounded-xl object-cover flex-shrink-0 border border-[hsl(var(--color-border-default))]"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5 flex-wrap">
            <p className="font-bold text-sm line-clamp-2" style={{ color: "hsl(var(--color-text-primary))" }}>
              {booking.turf_name}
            </p>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
              style={{
                background: statusBg,
                color: statusColor,
                border: `1px solid ${statusBorder}`,
              }}>
              {statusText}
            </span>
          </div>

          <div className="flex items-center gap-1 mt-1 text-[10px]" style={{ color: "hsl(var(--color-text-tertiary))" }}>
            <span className="px-1.5 py-0.5 rounded border font-mono text-[9px]" style={{ background: "hsl(var(--color-surface-overlay))", borderColor: "hsl(var(--color-border-default))" }}>
              ID: {booking.id}
            </span>
            <button
              onClick={handleCopyId} className="p-0.5 rounded cursor-pointer" style={{ color: "hsl(var(--color-text-secondary))" }}
              title="Copy ID">
              <Copy className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5 border-t pt-2.5 text-[10.5px] font-medium" style={{ borderColor: "hsl(var(--color-surface-default))", color: "hsl(var(--color-text-secondary))" }}>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" style={{ color: "hsl(var(--color-primary))" }} />
              {booking.date}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" style={{ color: "hsl(var(--color-primary))" }} />
              {formatSlotTime(booking.start_time)} - {formatSlotTime(endTimeStr)}
            </span>
            <span className="text-[10px] mt-0.5" style={{ color: "hsl(var(--color-text-secondary))" }}>
              Duration: <strong className="font-bold" style={{ color: "hsl(var(--color-text-primary))" }}>{duration} Hr{duration> 1 ? "s" : ""}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between mt-2.5 border-t pt-2" style={{ borderColor: "hsl(var(--color-surface-default))" }}>
            <span className="text-[9px] uppercase font-bold tracking-wider" style={{ color: "hsl(var(--color-text-secondary))" }}>Amount Paid</span>
            <p className="text-sm font-extrabold" style={{ color: "hsl(var(--color-primary))" }}>₹{booking.amount}</p>
          </div>
        </div>
      </Link>
  );
});
