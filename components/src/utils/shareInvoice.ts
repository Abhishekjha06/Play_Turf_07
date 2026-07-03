import { toast } from "sonner";
import type { InvoiceData } from "@/components/Invoice/types";

/**
 * Format invoice data as plain text for sharing.
 */
function formatInvoiceText(data: InvoiceData): string {
  const currency = data.currency || "₹";
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
    `Subtotal   : ${currency}${data.subtotal.toLocaleString("en-IN")}`,
    `Platform Fee: ${currency}${data.platformFee.toLocaleString("en-IN")}`,
    data.convenienceFee ? `Convenience: ${currency}${data.convenienceFee.toLocaleString("en-IN")}` : "",
    data.discount ? `Discount   : -${currency}${data.discount.toLocaleString("en-IN")}` : "",
    `GST        : ${currency}${data.gst.toLocaleString("en-IN")}`,
    `TOTAL      : ${currency}${data.total.toLocaleString("en-IN")}`,
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
 * Share an invoice PDF.
 *
 * Priority:
 * 1. Web Share API with PDF file
 * 2. Web Share API with text only
 * 3. Clipboard copy + auto-download
 *
 * @param blob — PDF Blob
 * @param data — Invoice data
 * @param fileName — Suggested filename
 */
export async function shareInvoice(
  blob: Blob,
  data: InvoiceData,
  fileName: string
): Promise<void> {
  const text = formatInvoiceText(data);
  const file = new File([blob], fileName, { type: "application/pdf" });

  try {
    // Try file share first
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `PlayTurf Invoice — ${data.invoiceNumber}`,
        text,
        files: [file],
      });
      toast.success("Invoice shared!");
      return;
    }

    // Fallback to text share
    if (navigator.share) {
      await navigator.share({
        title: `PlayTurf Invoice — ${data.invoiceNumber}`,
        text,
      });
      toast.success("Invoice shared!");
      return;
    }

    // Final fallback: clipboard
    await navigator.clipboard.writeText(text);
    toast.success("Invoice details copied to clipboard!");
  } catch (err: any) {
    if (err.name === "AbortError") return;
    console.error("Share failed:", err);
    toast.error("Failed to share invoice.");
  }
}
