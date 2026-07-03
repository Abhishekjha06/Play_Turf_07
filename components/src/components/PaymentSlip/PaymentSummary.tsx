import { memo } from "react";
import type { PaymentSlipData } from "./types";

export interface PaymentSummaryProps {
  data: PaymentSlipData;
}

export const PaymentSummary = memo(function PaymentSummary({ data }: PaymentSummaryProps) {
  const currency = data.currency ?? "₹";
  const format = (n: number) => `${currency}${n.toLocaleString("en-IN")}`;

  const items = [
    { label: "Turf Charges", value: data.subtotal, type: "charge" as const },
    { label: "Platform Fee", value: data.platformFee, type: "fee" as const },
    ...(data.convenienceFee ? [{ label: "Convenience Fee", value: data.convenienceFee, type: "fee" as const }] : []),
    ...(data.discount ? [{ label: "Discount", value: -data.discount, type: "discount" as const }] : []),
    { label: "GST", value: data.gst, type: "tax" as const },
  ];

  return (
    <section className="pt-invoice__section" aria-label="Payment Summary">
      <div className="pt-invoice__section-title" style={{ color: "#f59e0b" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
        Payment Summary
      </div>
      <table className="pt-invoice__table" role="table" aria-label="Payment line items">
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td style={item.value < 0 ? { color: "#22c55e" } : undefined}>
                {item.value < 0 ? "-" : ""}
                {format(Math.abs(item.value))}
              </td>
            </tr>
          ))}
          <tr className="pt-invoice__total-row">
            <td>TOTAL PAID</td>
            <td>{format(data.total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
});
