import { memo } from "react";
import { User, Phone, Mail } from "lucide-react";
import type { PaymentSlipData } from "./types";

export interface CustomerDetailsProps {
  data: PaymentSlipData;
}

export const CustomerDetails = memo(function CustomerDetails({ data }: CustomerDetailsProps) {
  return (
    <section className="pt-invoice__section" aria-label="Customer Details">
      <div className="pt-invoice__section-title">
        <User aria-hidden="true" />
        Customer Details
      </div>
      <div className="space-y-0">
        <DetailRow icon={<User className="w-3.5 h-3.5" />} label="Name" value={data.customerName} highlight />
        <DetailRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={data.customerPhone} />
        <DetailRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={data.customerEmail} />
      </div>
    </section>
  );
});

/* ── Internal Detail Row ─────────────────────────────────── */

function DetailRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="pt-invoice__row">
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ color: "#94a3b8", flexShrink: 0 }}>{icon}</span>
        <span className="pt-invoice__row-label">{label}</span>
      </div>
      <span className={`pt-invoice__row-value${highlight ? " pt-invoice__row-value--accent" : ""}`}>
        {value}
      </span>
    </div>
  );
}
