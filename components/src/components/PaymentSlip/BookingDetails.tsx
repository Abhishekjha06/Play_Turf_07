import { memo } from "react";
import {
  MapPin,
  Calendar,
  Clock,
  Timer,
  LayoutGrid,
  Home,
} from "lucide-react";
import type { PaymentSlipData } from "./types";

export interface BookingDetailsProps {
  data: PaymentSlipData;
}

export const BookingDetails = memo(function BookingDetails({ data }: BookingDetailsProps) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  return (
    <section className="pt-invoice__section" aria-label="Booking Details">
      <div className="pt-invoice__section-title">
        <MapPin aria-hidden="true" />
        Booking Details
      </div>
      <div className="space-y-0">
        <DetailRow icon={<MapPin className="w-3.5 h-3.5" />} label="Turf" value={data.turfName} accent />
        <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Sport" value={data.sport} />
        <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Date" value={formatDate(data.bookingDate)} />
        <DetailRow
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Time"
          value={`${formatTime(data.bookingTime)}${data.endTime ? ` – ${formatTime(data.endTime)}` : ""}`}
        />
        <DetailRow icon={<Timer className="w-3.5 h-3.5" />} label="Duration" value={`${data.duration} Hour(s)`} />
        <DetailRow icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Court" value={data.groundName || "Main Court"} />
        <DetailRow icon={<Home className="w-3.5 h-3.5" />} label="Address" value={data.address} />
      </div>
    </section>
  );
});

/* ── Internal Detail Row ─────────────────────────────────── */

function DetailRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="pt-invoice__row">
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ color: "#94a3b8", flexShrink: 0 }}>{icon}</span>
        <span className="pt-invoice__row-label">{label}</span>
      </div>
      <span className={`pt-invoice__row-value${accent ? " pt-invoice__row-value--accent" : ""}`}>
        {value}
      </span>
    </div>
  );
}
