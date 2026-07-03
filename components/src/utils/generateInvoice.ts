import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { InvoiceDocument } from "@/components/Invoice/InvoiceDocument";
import type { InvoiceData } from "@/components/Invoice/types";

/**
 * Generate a QR code as a base64 PNG data URL.
 */
export async function generateQRCode(data: InvoiceData): Promise<string> {
  const value = [
    data.invoiceNumber,
    data.bookingId,
    data.total,
    data.customerName,
    "https://www.playturf.in",
  ].join(" | ");

  return QRCode.toDataURL(value, {
    width: 200,
    margin: 2,
    color: {
      dark: "#0F1115",
      light: "#FFFFFF",
    },
  });
}

/**
 * Build the complete invoice data with QR code.
 */
export async function buildInvoiceWithQR(data: InvoiceData): Promise<InvoiceData> {
  const qrCodeDataUrl = await generateQRCode(data);
  return { ...data, qrCodeDataUrl };
}

/**
 * Generate a PDF Blob from invoice data.
 *
 * @param data — Invoice data (must include qrCodeDataUrl)
 * @returns PDF Blob
 */
export async function generateInvoicePDF(data: InvoiceData): Promise<Blob> {
  const instance = pdf(<InvoiceDocument data={data} />);
  return instance.toBlob();
}
