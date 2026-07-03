/**
 * PaymentSlip — Share
 * Shares the invoice via Web Share API (with PDF file) or falls back
 * to clipboard copy + download.
 */

import { toast } from "sonner";
import { generatePaymentSlipPDF } from "./downloadPaymentSlip";
import type { PaymentSlipData } from "@/components/PaymentSlip/types";

export interface SharePaymentSlipOptions {
  element: HTMLElement;
  data: PaymentSlipData;
  filename?: string;
  fallbackToClipboard?: boolean;
}

/**
 * Format the invoice data as plain text for sharing.
 */
function formatInvoiceText(data: PaymentSlipData): string {
  const lines = [
    "═══════════════════════════════════════",
    "      PLAYTURF — PAYMENT INVOICE",
    "═══════════════════════════════════════",
    "",
    `Invoice No : ${data.invoiceNumber}`,
    `Booking ID : ${data.bookingId}`,
    `Transaction: ${data.transactionId}`,
    "",
    `Turf       : ${data.turfName}`,
    `Sport      : ${data.sport}`,
    `Date       : ${data.bookingDate}`,
    `Time       : ${data.bookingTime}${data.endTime ? ` – ${data.endTime}` : ""}`,
    `Duration   : ${data.duration} hour(s)`,
    `Address    : ${data.address}`,
    "",
    `Customer   : ${data.customerName}`,
    `Phone      : ${data.customerPhone}`,
    `Email      : ${data.customerEmail}`,
    "",
    `Subtotal   : ${data.currency ?? "₹"}${data.subtotal.toLocaleString("en-IN")}`,
    `Platform Fee: ${data.currency ?? "₹"}${data.platformFee.toLocaleString("en-IN")}`,
    data.convenienceFee ? `Convenience: ${data.currency ?? "₹"}${data.convenienceFee.toLocaleString("en-IN")}` : "",
    data.discount ? `Discount   : -${data.currency ?? "₹"}${data.discount.toLocaleString("en-IN")}` : "",
    `GST        : ${data.currency ?? "₹"}${data.gst.toLocaleString("en-IN")}`,
    `TOTAL PAID : ${data.currency ?? "₹"}${data.total.toLocaleString("en-IN")}`,
    "",
    `Payment    : ${data.paymentMethod}`,
    `Gateway    : ${data.paymentGateway}`,
    `Status     : ${data.paymentStatus}`,
    "",
    "═══════════════════════════════════════",
    "www.playturf.in  |  support@playturf.in",
    "═══════════════════════════════════════",
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Share the invoice.
 *
 * 1. If the browser supports Web Share API with files → share the PDF.
 * 2. Else if navigator.share exists → share plain text.
 * 3. Else → copy text to clipboard and download the PDF.
 *
 * @param options — Share options
 */
export async function sharePaymentSlip(options: SharePaymentSlipOptions): Promise<void> {
  const { element, data, filename = "PlayTurf-Invoice", fallbackToClipboard = true } = options;

  try {
    const text = formatInvoiceText(data);
    const fileName = `${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

    /* Try to generate PDF for file sharing */
    let pdfBlob: Blob | undefined;
    try {
      pdfBlob = await generatePaymentSlipPDF(element, { filename, scale: 2, quality: 0.9 });
    } catch {
      pdfBlob = undefined;
    }

    const shareData: ShareData = {
      title: `PlayTurf Invoice — ${data.invoiceNumber}`,
      text,
    };

    /* Web Share API with file support */
    if (pdfBlob && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], fileName, { type: "application/pdf" })] })) {
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });
      await navigator.share({ ...shareData, files: [file] });
      toast.success("Invoice shared!");
      return;
    }

    /* Plain text share */
    if (navigator.share) {
      await navigator.share(shareData);
      toast.success("Invoice shared!");
      return;
    }

    /* Fallback: clipboard + download */
    if (fallbackToClipboard) {
      await navigator.clipboard.writeText(text);
      toast.success("Invoice details copied to clipboard!");

      /* Also download the PDF */
      if (pdfBlob) {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  } catch (err: any) {
    if (err.name === "AbortError") return; /* User cancelled */
    console.error("Share failed:", err);
    toast.error("Failed to share invoice.");
  }
}

/**
 * Copy invoice text to clipboard (quick fallback helper).
 */
export async function copyInvoiceToClipboard(data: PaymentSlipData): Promise<void> {
  try {
    await navigator.clipboard.writeText(formatInvoiceText(data));
    toast.success("Invoice details copied to clipboard!");
  } catch {
    toast.error("Failed to copy invoice details.");
  }
}
