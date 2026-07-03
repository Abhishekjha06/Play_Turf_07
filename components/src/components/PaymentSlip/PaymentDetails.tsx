import { memo } from "react";
import { CreditCard, Hash, Globe, Shield, Calendar } from "lucide-react";
import type { PaymentSlipData } from "./types";

export interface PaymentDetailsProps {
  data: PaymentSlipData;
}

export const PaymentDetails = memo(function PaymentDetails({ data }: PaymentDetailsProps) {
  const statusColor =
    data.paymentStatus === "PAID"
      ? "#22c55e"
      : data.paymentStatus === "PENDING"
      ? "#f59e0b"
      : data.paymentStatus === "REFUNDED"
      ? "#64748b"
      : "#ef4444";

  const formatDateTime = (isoStr?: string) => {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section className="pt-invoice__section" aria-label="Payment Details">
      <div className="pt-invoice__section-title" style={{ color: "#a78bfa" }}>
        <CreditCard aria-hidden="true" />
        Payment Details
      </div>
      <div className="space-y-0">
        <DetailRow icon={<CreditCard className="w-3.5 h-3.5" />} label="Payment Method" value={data.paymentMethod} />
        <DetailRow icon={<Hash className="w-3.5 h-3.5" />} label="UPI Reference" value={data.upiReference || "—"} />
        <DetailRow icon={<Globe className="w-3.5 h-3.5" />} label="Gateway" value={data.paymentGateway} />
        <DetailRow
          icon={<Shield className="w-3.5 h-3.5" />}
          label="Payment Status"
          value={data.paymentStatus}
          valueColor={statusColor}
        />
        <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Paid On" value={formatDateTime(data.createdAt)} />
      </div>
    </section>
  );
});

/* ── Internal Detail Row ─────────────────────────────────── */

function DetailRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="pt-invoice__row">
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ color: "#94a3b8", flexShrink: 0 }}>{icon}</span>
        <span className="pt-invoice__row-label">{label}</span>
      </div>
      <span
        className="pt-invoice__row-value"
        style={valueColor ? { color: valueColor, fontWeight: 800 } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
