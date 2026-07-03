import { memo } from "react";
import { Check, Receipt } from "lucide-react";
import type { PaymentSlipData } from "./types";

export interface PaymentSlipHeaderProps {
  data: PaymentSlipData;
}

const LOGO_FULL = "/playturf-logo.png";

export const PaymentSlipHeader = memo(function PaymentSlipHeader({ data }: PaymentSlipHeaderProps) {
  const statusConfig = {
    PAID: { color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.30)", label: "PAID", icon: Check },
    PENDING: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)", label: "PENDING", icon: Receipt },
    FAILED: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.30)", label: "FAILED", icon: Receipt },
    REFUNDED: { color: "#64748b", bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.30)", label: "REFUNDED", icon: Receipt },
  };

  const cfg = statusConfig[data.paymentStatus] || statusConfig.PENDING;
  const StatusIcon = cfg.icon;

  return (
    <header className="pt-invoice__header">
      <div className="pt-invoice__header-brand">
        <img
          src={LOGO_FULL}
          alt="PlayTurf"
          className="pt-invoice__logo"
          crossOrigin="anonymous"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div>
          <div className="pt-invoice__header-title">Payment Receipt</div>
        </div>
      </div>

      <div className="pt-invoice__header-right">
        <div
          className="pt-invoice__paid-badge"
          style={{
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
          }}
          aria-label={`Payment status: ${cfg.label}`}
        >
          <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {cfg.label}
        </div>
        <div className="pt-invoice__header-meta">
          <span className="pt-invoice__badge">{data.invoiceNumber}</span>
          <span className="pt-invoice__badge">{data.bookingId}</span>
        </div>
      </div>
    </header>
  );
});
