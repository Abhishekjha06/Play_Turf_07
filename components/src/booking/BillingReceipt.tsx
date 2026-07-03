import React from "react";
import { Check, MapPin, Calendar, Clock, Timer, CreditCard, Shield, User, Mail, Phone, QrCode } from "lucide-react";
import type { Booking } from "@/data/seed";
import type { OpenGame } from "@/types/openGames";
import type { Team } from "@/cricket/types";
import { TeamAvatar } from "@/cricket/components/TeamAvatar";

/* Logo paths */
const LOGO_FULL = "/playturf-logo.png";

export interface BillingReceiptProps {
  booking: Booking;
  turf?: {
    name?: string;
    address?: string;
    city?: string;
    sport_types?: string[];
  };
  game?: OpenGame;
  user?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  teamA?: Team;
  teamB?: Team;
  isHost?: boolean;
  playerName?: string;
  qrData?: string;
}

/* ── Helpers ─────────────────────────────────────────────────── */

const formatTime12 = (timeStr: string) => {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
};

const formatDateShort = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const formatDateTimeShort = (isoStr: string) => {
  const d = new Date(isoStr);
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

/* ── Tiny VS Badge ─────────────────────────────────────────── */
function VsBadgeMini() {
  return (
    <div
      style={{
        width: "32px", height: "32px", borderRadius: "50%",
        display: "grid", placeItems: "center",
        background: "linear-gradient(135deg, #14b8a6, #0d9488)",
        fontSize: "10px", fontWeight: 900, color: "#fff",
        flexShrink: 0,
      }}
    >
      VS
    </div>
  );
}

/* ── Compact Row ───────────────────────────────────────────── */
function CompactRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: "10px", color: accent || (bold ? "#14b8a6" : "rgba(255,255,255,0.85)"), fontWeight: bold ? 800 : 700, textAlign: "right", maxWidth: "60%" }}>
        {value}
      </span>
    </div>
  );
}

/* ── Section Header ────────────────────────────────────────── */
function SectionHeader({ icon: Icon, title, accent = "#14b8a6" }: { icon: typeof MapPin; title: string; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
      <Icon style={{ width: "12px", height: "12px", color: accent }} />
      <span style={{ fontSize: "9px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.18em", color: accent }}>{title}</span>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────── */

export const BillingReceipt = React.forwardRef<HTMLDivElement, BillingReceiptProps>(
  ({ booking, turf, game, user, teamA, teamB, isHost, playerName, qrData }, ref) => {
    const sport = turf?.sport_types?.[0] || game?.sport || "Football";
    const address = turf?.address || game?.venue || turf?.city || "—";
    const baseAmount = booking.amount;
    const platformFee = 20;
    const gst = Math.round(baseAmount * 0.18);
    const totalPaid = baseAmount + platformFee + gst;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      qrData || `PlayTurf|Verify|${booking.id}|${booking.turf_name}|${booking.date}|${booking.start_time}`
    )}`;

    const showTeams = !!(teamA && teamB);
    const customerName = isHost
      ? (user?.name || game?.host_name || "Host")
      : (playerName || user?.name || "Player");
    const customerRole = isHost ? "Host" : "Player";
    const paymentMethod = game?.players?.find((p) => p.name === playerName)?.payment_method || "UPI";

    return (
      <div
        ref={ref}
        data-billing-capture
        style={{
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          maxWidth: "600px",
          width: "100%",
          margin: "0 auto",
          padding: "16px",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.06)",
          boxSizing: "border-box",
        }}
      >
        {/* ═══════ HEADER: Logo + Confirmed ═══════ */}
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <img
            src={LOGO_FULL}
            alt="PlayTurf"
            crossOrigin="anonymous"
            style={{ height: "36px", width: "auto", objectFit: "contain", margin: "0 auto 4px" }}
          />
          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 800, color: "#14b8a6" }}>
            <Check style={{ width: "14px", height: "14px" }} /> BOOKING CONFIRMED
          </div>
        </div>

        {/* ═══════ QR + Booking Info (side by side) ═══════ */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          {/* QR Code */}
          <div style={{ flexShrink: 0, width: "72px", height: "72px", borderRadius: "8px", overflow: "hidden", background: "#ffffff", padding: "3px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <img src={qrUrl} alt="QR" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>

          {/* Booking details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <CompactRow label="Booking ID" value={booking.id} />
            <CompactRow label="Status" value={booking.status} accent="#22c55e" />
            <CompactRow label="Date" value={formatDateShort(booking.date)} />
            <CompactRow label="Time" value={`${formatTime12(booking.start_time)} – ${formatTime12(booking.end_time)}`} />
          </div>
        </div>

        {/* ═══════ TURF DETAILS ═══════ */}
        <div style={{ background: "#111111", borderRadius: "10px", padding: "8px 10px", marginBottom: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
          <SectionHeader icon={MapPin} title="Turf Details" />
          <CompactRow label="Turf" value={booking.turf_name} />
          <CompactRow label="Sport" value={sport} />
          <CompactRow label="Duration" value={`${booking.hours} Hour(s)`} />
          <CompactRow label="Address" value={address} />
        </div>

        {/* ═══════ MATCH SUMMARY (optional) ═══════ */}
        {showTeams && (
          <div style={{ background: "#111111", borderRadius: "10px", padding: "8px 10px", marginBottom: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
            <SectionHeader icon={Shield} title="Match Summary" accent="#f59e0b" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "6px 0" }}>
              <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
                <div style={{ width: "44px", height: "44px", margin: "0 auto 3px" }}>
                  <TeamAvatar team={teamA} size="sm" variant="sports" />
                </div>
                <p style={{ fontSize: "9px", fontWeight: 800, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {teamA.name}
                </p>
              </div>
              <VsBadgeMini />
              <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
                <div style={{ width: "44px", height: "44px", margin: "0 auto 3px" }}>
                  <TeamAvatar team={teamB} size="sm" variant="sports" />
                </div>
                <p style={{ fontSize: "9px", fontWeight: 800, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {teamB.name}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ CUSTOMER ═══════ */}
        <div style={{ background: "#111111", borderRadius: "10px", padding: "8px 10px", marginBottom: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
          <SectionHeader icon={User} title="Customer" accent="#a78bfa" />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(167,139,250,0.12)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <User style={{ width: "14px", height: "14px", color: "#a78bfa" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "11px", fontWeight: 800, color: "#fff" }}>{customerName}</p>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{customerRole}</p>
              {user?.email && (
                <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: "3px" }}>
                  <Mail style={{ width: "9px", height: "9px" }} /> {user.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════ PAYMENT ═══════ */}
        <div style={{ background: "#111111", borderRadius: "10px", padding: "8px 10px", marginBottom: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
          <SectionHeader icon={CreditCard} title="Payment" accent="#f59e0b" />
          <CompactRow label="Turf Charges" value={`₹${baseAmount.toLocaleString("en-IN")}`} />
          <CompactRow label="Platform Fee" value={`₹${platformFee}`} />
          <CompactRow label="GST (18%)" value={`₹${gst.toLocaleString("en-IN")}`} />
          <div style={{ borderTop: "1.5px solid rgba(20,184,166,0.25)", margin: "4px 0", paddingTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#14b8a6" }}>TOTAL PAID</span>
            <span style={{ fontSize: "14px", fontWeight: 900, color: "#14b8a6" }}>₹{totalPaid.toLocaleString("en-IN")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Payment: {paymentMethod}</span>
            <span style={{ fontSize: "9px", color: "#22c55e", fontWeight: 800 }}>CONFIRMED</span>
          </div>
          {booking.payment_id && (
            <CompactRow label="Transaction ID" value={booking.payment_id} />
          )}
        </div>

        {/* ═══════ FOOTER ═══════ */}
        <div style={{ textAlign: "center", paddingTop: "6px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
            Booked On: {formatDateTimeShort(booking.created_at)}
          </p>
          <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", fontWeight: 600, marginTop: "2px" }}>
            Cancellation: Refund up to 24 hours before slot
          </p>
          <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginTop: "2px" }}>
            Support: support@playturf.in &nbsp;|&nbsp; www.playturf.in
          </p>
          <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: "4px" }}>
            © 2026 PlayTurf — All Rights Reserved
          </p>
        </div>
      </div>
    );
  }
);

BillingReceipt.displayName = "BillingReceipt";
