import { memo } from "react";
import type { PaymentSlipData } from "./types";

export interface PaymentSlipFooterProps {
  data?: PaymentSlipData;
}

export const PaymentSlipFooter = memo(function PaymentSlipFooter({ data }: PaymentSlipFooterProps) {
  const supportEmail = data?.notes?.includes("@") ? data.notes : "support@playturf.in";

  return (
    <footer className="pt-invoice__footer" aria-label="Invoice Footer">
      <div className="pt-invoice__footer-divider" />

      <div className="pt-invoice__footer-text">
        <p style={{ margin: 0, fontWeight: 700, fontSize: "11px", color: "#64748b" }}>
          Terms & Conditions
        </p>
        <p style={{ margin: "4px 0 0", maxWidth: "480px", marginInline: "auto" }}>
          Cancellations are refundable up to 24 hours before the scheduled slot time.
          No refunds for cancellations within 2 hours of the slot. Arrive at least
          15 minutes before your booking. Carry valid ID for verification.
        </p>
      </div>

      <div className="pt-invoice__footer-links">
        <span>Support</span>
        <span>•</span>
        <span>{supportEmail}</span>
        <span>•</span>
        <span>www.playturf.in</span>
      </div>

      <p className="pt-invoice__footer-disclaimer">
        This is a computer-generated invoice and does not require a signature.
      </p>

      <p
        style={{
          marginTop: "8px",
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "#94a3b8",
        }}
      >
        © 2026 PlayTurf — All Rights Reserved
      </p>
    </footer>
  );
});
