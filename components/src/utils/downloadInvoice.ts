import { toast } from "sonner";

/**
 * Download a Blob as a file.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download an invoice PDF.
 *
 * @param blob — PDF Blob from generateInvoicePDF
 * @param invoiceNumber — Used in the filename
 */
export function downloadInvoice(blob: Blob, invoiceNumber: string): void {
  const safeName = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `PlayTurf-Invoice-${safeName}.pdf`;
  downloadBlob(blob, fileName);
  toast.success("Invoice downloaded!");
}
