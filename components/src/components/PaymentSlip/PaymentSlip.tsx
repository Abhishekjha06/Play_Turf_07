import { memo, forwardRef, useCallback, useRef, useState } from "react";
import {
  Download,
  Share2,
  Printer,
  FileDown,
} from "lucide-react";
import type { PaymentSlipProps } from "./types";
import { PaymentSlipHeader } from "./PaymentSlipHeader";
import { PaymentSlipFooter } from "./PaymentSlipFooter";
import { PaymentSummary } from "./PaymentSummary";
import { CustomerDetails } from "./CustomerDetails";
import { BookingDetails } from "./BookingDetails";
import { PaymentDetails } from "./PaymentDetails";
import { QRSection } from "./QRSection";
import { downloadPaymentSlip } from "@/utils/downloadPaymentSlip";
import { printPaymentSlip } from "@/utils/printPaymentSlip";
import { sharePaymentSlip } from "@/utils/sharePaymentSlip";
import "@/styles/payment-slip.css";

/**
 * PaymentSlip — Main Invoice Component
 *
 * A premium, production-ready PlayTurf payment invoice.
 * Features:
 *   • Responsive, branded design (Premium Black + Teal)
 *   • One-page A4 layout
 *   • Download as PDF (html2canvas + jsPDF, lazy-loaded)
 *   • Print support (hides nav/buttons, preserves colors)
 *   • Share via Web Share API (with PDF file)
 *   • Canvas-based QR code (no external image dependencies)
 *   • Semantic HTML, ARIA labels, keyboard accessible
 */
export const PaymentSlip = memo(
  forwardRef<HTMLDivElement, PaymentSlipProps>(function PaymentSlip(
    { data, className, onDownload, onShare, onPrint, hideActions = false },
    ref
  ) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const innerRef = useRef<HTMLDivElement>(null);

    /* Merge refs */
    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    const handleDownload = useCallback(async () => {
      if (!innerRef.current) return;
      setIsDownloading(true);
      try {
        await downloadPaymentSlip(innerRef.current, {
          filename: `PlayTurf-Invoice-${data.invoiceNumber}`,
          scale: 2.5,
          quality: 0.92,
        });
        onDownload?.();
      } finally {
        setIsDownloading(false);
      }
    }, [data.invoiceNumber, onDownload]);

    const handlePrint = useCallback(() => {
      if (!innerRef.current) return;
      printPaymentSlip(innerRef.current);
      onPrint?.();
    }, [onPrint]);

    const handleShare = useCallback(async () => {
      if (!innerRef.current) return;
      setIsSharing(true);
      try {
        await sharePaymentSlip({
          element: innerRef.current,
          data,
          filename: `PlayTurf-Invoice-${data.invoiceNumber}`,
        });
        onShare?.();
      } finally {
        setIsSharing(false);
      }
    }, [data, onShare]);

    const qrData = data.qrCodeValue || [
      data.bookingId,
      data.customerName,
      data.total,
      data.invoiceNumber,
      "https://www.playturf.in",
    ].join("|");

    return (
      <div className={className} style={{ width: "100%" }}>
        {/* ── Invoice Card ── */}
        <div
          ref={setRefs}
          data-payment-slip-capture
          className="pt-invoice"
          role="document"
          aria-label={`PlayTurf Payment Invoice ${data.invoiceNumber}`}
        >
          <PaymentSlipHeader data={data} />

          {/* QR + Key Info */}
          <section className="pt-invoice__section" aria-label="Verification QR Code">
            <QRSection
              value={qrData}
              size={96}
              bookingId={data.bookingId}
              customerName={data.customerName}
              amount={data.total}
              invoiceNumber={data.invoiceNumber}
            />
          </section>

          <BookingDetails data={data} />
          <CustomerDetails data={data} />
          <PaymentSummary data={data} />
          <PaymentDetails data={data} />
          <PaymentSlipFooter data={data} />
        </div>

        {/* ── Action Buttons ── */}
        {!hideActions && (
          <div className="pt-invoice__actions" aria-label="Invoice Actions">
            <button
              className="pt-invoice__btn pt-invoice__btn--primary"
              onClick={handleDownload}
              disabled={isDownloading}
              aria-label="Download invoice as PDF"
            >
              {isDownloading ? (
                <span className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              {isDownloading ? "Generating…" : "Download Invoice"}
            </button>

            <button
              className="pt-invoice__btn pt-invoice__btn--secondary"
              onClick={handlePrint}
              aria-label="Print invoice"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>

            <button
              className="pt-invoice__btn pt-invoice__btn--ghost"
              onClick={handleShare}
              disabled={isSharing}
              aria-label="Share invoice"
            >
              <Share2 className="w-4 h-4" />
              {isSharing ? "Sharing…" : "Share Invoice"}
            </button>
          </div>
        )}
      </div>
    );
  })
);
