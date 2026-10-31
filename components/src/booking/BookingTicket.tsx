import React from "react";
import QRCode from "qrcode";
import {
  MapPin, Calendar, Clock, Timer, Users, CreditCard, Shield,
  User, Phone, Mail, CheckCircle, AlertCircle, XCircle, Receipt,
  Info, FileText, HelpCircle, Share2, Download, QrCode, ChevronRight,
} from "lucide-react";
import type { Booking } from "@/data/seed";
import type { OpenGame } from "@/types/openGames";

/* Logo paths — referenced at runtime, not imported at build time.
 * This prevents Vite build failures if the file is missing in the repo.
 */
const LOGO_FULL = "/playturf-logo.webp";
/* Second logo (teal P mark) from external CDN with local fallback */
const LOGO_MARK = "https://compulsory-red-bcsumray.edgeone.dev/image%20(1).png";

export interface BookingTicketProps {
  booking: Booking;
  turf?: {
    name?: string;
    address?: string;
    city?: string;
    sport_types?: string[];
    lat?: number;
    lng?: number;
  };
  game?: OpenGame;
  user?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  qrData?: string;
  onDownload?: () => void;
  onShare?: () => void;
  isGenerating?: boolean;
}

/* ── Helpers ─────────────────────────────────────────────────── */

const formatTime12 = (timeStr: string) => {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
};

const formatDateLong = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (isoStr: string) => {
  const d = new Date(isoStr);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ── Status Config — semantic status roles (theme-invariant, NOT brand colors) ── */

const statusConfig: Record<string, { color: string; bg: string; border: string; label: string; icon: typeof CheckCircle }> = {
  CONFIRMED: { color: "hsl(var(--success))", bg: "hsl(var(--color-success-surface))", border: "hsl(var(--success) / 0.30)", label: "Confirmed", icon: CheckCircle },
  PENDING:   { color: "hsl(var(--warning))", bg: "hsl(var(--color-warning-surface))", border: "hsl(var(--warning) / 0.30)", label: "Pending Payment", icon: AlertCircle },
  CANCELLED: { color: "hsl(var(--danger))", bg: "hsl(var(--color-danger-surface))", border: "hsl(var(--danger) / 0.30)", label: "Cancelled", icon: XCircle },
  COMPLETED: { color: "hsl(var(--muted-foreground))", bg: "hsl(var(--color-neutral-surface))", border: "hsl(var(--muted-foreground) / 0.30)", label: "Completed", icon: CheckCircle },
};

/* ── Section Card ──────────────────────────────────────────── */

function SectionCard({ title, icon: Icon, children, accent = "hsl(var(--primary))" }: {
  title: string;
  icon: typeof MapPin;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "hsl(var(--panel-3))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "16px",
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)` }}
        >
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        <p
          className="text-[10px] font-black uppercase tracking-[0.2em] leading-none"
          style={{ color: accent }}
        >
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

/* ── Detail Row ───────────────────────────────────────────── */

function DetailRow({ icon: Icon, label, value, highlight = false, valueColor }: {
  icon: typeof MapPin;
  label: string;
  value: string;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2" style={{ borderBottom: "1px solid hsl(var(--border) / 0.5)" }}>
      <div className="flex items-baseline gap-2 min-w-0 flex-1">
        <Icon className="w-3.5 h-3.5 self-center shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
        <span className="text-xs font-medium whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
      </div>
      <span
        className="text-xs font-bold text-right break-words max-w-[55%]"
        style={{
          color: valueColor || (highlight ? "hsl(var(--primary))" : "hsl(var(--foreground))"),
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────── */

export const BookingTicket = React.forwardRef<HTMLDivElement, BookingTicketProps>(
  ({ booking, turf, game, user, qrData, onDownload, onShare, isGenerating }, ref) => {
    const status = statusConfig[booking.status] || statusConfig.PENDING;
    const StatusIcon = status.icon;

    // QR is generated LOCALLY as a data URL. The previous external service
    // (api.qrserver.com) sends no CORS headers, which tainted the html2canvas
    // capture and made the PDF download fail with a SecurityError.
    const [qrDataUrl, setQrDataUrl] = React.useState<string>("");
    const qrPayload = qrData || `PlayTurf|Verify|${booking.id}|${booking.turf_name}|${booking.date}|${booking.start_time}`;
    React.useEffect(() => {
        let cancelled = false;
        QRCode.toDataURL(qrPayload, { width: 250, margin: 1 })
            .then((url) => {
                if (!cancelled) setQrDataUrl(url);
            })
            .catch(() => {
                if (!cancelled) setQrDataUrl("");
            });
        return () => {
            cancelled = true;
        };
    }, [qrPayload]);

    const sport = turf?.sport_types?.[0] || game?.sport || "Football";
    const address = turf?.address || game?.venue || turf?.city || "Bangalore";
    const baseAmount = booking.amount;
    const platformFee = 20;
    const gst = Math.round(baseAmount * 0.18);
    const totalPaid = baseAmount + platformFee + gst;
    const paymentMethod = game?.players?.find((p) => p.user_id === user?.name)?.payment_method || "UPI";

    return (
      <div
        ref={ref}
        data-ticket-capture
        style={{
          backgroundColor: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          maxWidth: "600px",
          width: "100%",
          margin: "0 auto",
          padding: "24px",
          borderRadius: "24px",
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* ═══════════════════════ TOP LOGO ═══════════════════════ */}
        <div className="text-center mb-5">
          <img
            src={LOGO_FULL}
            alt="PlayTurf"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            style={{ height: "60px", width: "auto", objectFit: "contain", margin: "0 auto" }}
            crossOrigin="anonymous"
          />
        </div>

        {/* ═══════════════════ HEADER ═══════════════════ */}
        <div
          className="text-center mb-5 p-4"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.02))",
            borderRadius: "16px",
            border: "1px solid hsl(var(--primary) / 0.15)",
          }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2" style={{ color: "hsl(var(--primary))" }}>
            Booking Confirmation
          </p>
          <h1 className="font-display text-xl font-black mb-3">
            Your Ticket is Ready
          </h1>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            {/* Status Badge */}
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider"
              style={{ backgroundColor: status.bg, color: status.color, border: `1px solid ${status.border}` }}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </div>

            {/* QR Code — white plate is a scanning constant, never themed */}
            <div
              className="w-20 h-20 rounded-xl overflow-hidden shrink-0"
              style={{
                border: "2px solid hsl(var(--border))",
                backgroundColor: "#ffffff",
                padding: "4px",
              }}
            >
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>

            {/* Booking ID */}
            <div className="text-left min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                Booking ID
              </p>
              <p className="text-xs font-mono font-bold break-all" style={{ color: "hsl(var(--foreground-soft))", maxWidth: "140px" }}>
                {booking.id}
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════ BOOKING DETAILS ═══════════════════ */}
        <SectionCard title="Booking Details" icon={MapPin}>
          <DetailRow icon={MapPin} label="Turf Name" value={booking.turf_name} highlight />
          <DetailRow icon={Calendar} label="Sport Type" value={sport} />
          <DetailRow icon={Calendar} label="Date" value={formatDateLong(booking.date)} />
          <DetailRow icon={Clock} label="Time Slot" value={`${formatTime12(booking.start_time)} – ${formatTime12(booking.end_time)}`} />
          <DetailRow icon={Timer} label="Duration" value={`${booking.hours} hour(s)`} />
          <DetailRow icon={MapPin} label="Ground Address" value={address} />
          {game?.host_name && (
            <DetailRow icon={User} label="Host Name" value={game.host_name} valueColor="var(--l-gold)" />
          )}
          {turf?.lat && turf?.lng && (
            <div className="pt-2">
              <a
                href={`https://www.google.com/maps?q=${turf.lat},${turf.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: "hsl(var(--primary) / 0.08)",
                  color: "hsl(var(--primary))",
                  border: "1px solid hsl(var(--primary) / 0.15)",
                  textDecoration: "none",
                }}
              >
                <MapPin className="w-3 h-3" /> Open in Google Maps
              </a>
            </div>
          )}
        </SectionCard>

        {/* ═══════════════════ CUSTOMER DETAILS ═══════════════════ */}
        <SectionCard title="Customer Details" icon={User}>
          <DetailRow icon={User} label="Player Name" value={user?.name || "Guest Player"} highlight />
          {user?.phone && (
            <DetailRow icon={Phone} label="Mobile Number" value={user.phone} />
          )}
          {user?.email && (
            <DetailRow icon={Mail} label="Email" value={user.email} />
          )}
        </SectionCard>

        {/* ═══════════════════ PAYMENT DETAILS ═══════════════════ */}
        <SectionCard title="Payment Details" icon={CreditCard} accent="var(--l-gold)">
          <DetailRow icon={Receipt} label="Turf Charges" value={`₹${baseAmount.toLocaleString("en-IN")}`} />
          <DetailRow icon={Receipt} label="Platform Fee" value={`₹${platformFee}`} />
          <DetailRow icon={Receipt} label="GST (18%)" value={`₹${gst.toLocaleString("en-IN")}`} />
          <div
            className="flex items-center justify-between gap-3 py-3 mt-1"
            style={{
              borderTop: "2px solid hsl(var(--primary) / 0.3)",
              borderBottom: "1px solid hsl(var(--border) / 0.5)",
            }}
          >
            <span className="text-sm font-bold" style={{ color: "hsl(var(--primary))" }}>Total Paid</span>
            <span className="text-lg font-black" style={{ color: "hsl(var(--primary))" }}>
              ₹{totalPaid.toLocaleString("en-IN")}
            </span>
          </div>
          <DetailRow icon={CreditCard} label="Payment Method" value={paymentMethod} />
          {booking.payment_id && (
            <DetailRow icon={Receipt} label="Transaction ID" value={booking.payment_id} />
          )}
          <DetailRow icon={Shield} label="Payment Status" value={booking.status} valueColor={status.color} />
        </SectionCard>

        {/* ═══════════════════ ADDITIONAL INFO ═══════════════════ */}
        <SectionCard title="Additional Information" icon={Info} accent="hsl(var(--muted-foreground))">
          {game && (
            <DetailRow icon={Users} label="Players Joined" value={`${game.slots_filled} / ${game.slots_total}`} />
          )}
          <DetailRow icon={Calendar} label="Booked On" value={formatDateTime(booking.created_at)} />
          <DetailRow
            icon={FileText}
            label="Cancellation Policy"
            value={game?.cancellation_policy || "Refundable up to 2 hours before start time."}
          />
          <div className="py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              Important Instructions
            </p>
            <ul className="space-y-1.5">
              {[
                "Arrive at least 15 minutes before your slot time.",
                "Carry valid ID proof for verification.",
                "Wear appropriate sports gear and non-marking shoes.",
                "Cancellations within 2 hours of slot are non-refundable.",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px]" style={{ color: "hsl(var(--foreground-soft))" }}>
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-2" style={{ borderTop: "1px solid hsl(var(--border) / 0.5)" }}>
            <DetailRow icon={HelpCircle} label="Customer Support" value="support@playturf.in" valueColor="hsl(var(--primary))" />
            <DetailRow icon={FileText} label="Terms & Conditions" value="playturf.in/terms" />
          </div>
        </SectionCard>

        {/* ═══════════════════ FOOTER ═══════════════════ */}
        <div
          className="text-center mt-6 p-5"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--primary) / 0.02))",
            borderRadius: "16px",
            border: "1px solid hsl(var(--primary) / 0.1)",
          }}
        >
          <img
            src={LOGO_MARK}
            alt="PlayTurf"
            onError={(e) => {
              /* Fallback to local logo if CDN fails */
              const target = e.target as HTMLImageElement;
              target.src = "/playturf-logo.webp";
              target.onerror = () => { target.style.display = "none"; };
            }}
            style={{ height: "40px", width: "auto", objectFit: "contain", margin: "0 auto 10px" }}
            crossOrigin="anonymous"
          />
          <p className="font-display text-sm font-bold mb-1">
            Thank you for choosing PlayTurf! 🏆
          </p>
          <p className="text-[10px] font-medium mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
            Book • Play • Win — Near Me
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
            <span>support@playturf.in</span>
            <span>•</span>
            <span>playturf.in</span>
          </div>
          <div className="flex items-center justify-center gap-3 mt-3 text-[9px] font-bold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground) / 0.7)" }}>
            <span>Terms</span>
            <span>Privacy</span>
            <span>Support</span>
          </div>
        </div>

        {/* ═══════════════════ ACTION BUTTONS ═══════════════════ */}
        {(onDownload || onShare) && (
          <div className="flex items-center gap-3 mt-5">
            {onDownload && (
              <button
                onClick={onDownload}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none"
                style={{
                  background: "var(--gradient-neon)",
                  color: "hsl(var(--primary-foreground))",
                  boxShadow: "var(--shadow-neon)",
                  opacity: isGenerating ? 0.6 : 1,
                }}
              >
                {isGenerating ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isGenerating ? "Generating PDF…" : "Download PDF"}
              </button>
            )}
            {onShare && (
              <button
                onClick={onShare}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none"
                style={{
                  backgroundColor: "hsl(var(--panel-3))",
                  color: "hsl(var(--foreground))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <Share2 className="w-4 h-4" />
                Share Ticket
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
);

BookingTicket.displayName = "BookingTicket";
