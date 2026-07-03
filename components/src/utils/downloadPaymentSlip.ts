/**
 * PaymentSlip — Download as PDF
 * Lazy-loads html2canvas + jsPDF, captures the invoice DOM node,
 * and outputs a single A4 portrait PDF with no cropping.
 */

import { toast } from "sonner";

export interface DownloadPaymentSlipOptions {
  filename?: string;
  scale?: number;
  quality?: number;
}

/**
 * Download the invoice element as a high-quality A4 PDF.
 *
 * @param element — The DOM node to capture (the invoice root)
 * @param options — Optional filename, scale, and JPEG quality
 */
export async function downloadPaymentSlip(
  element: HTMLElement,
  options: DownloadPaymentSlipOptions = {}
): Promise<void> {
  const { filename = "PlayTurf-Invoice", scale = 2.5, quality = 0.92 } = options;

  try {
    /* Lazy-load the heavy libraries */
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 20000,
      /* Ensure the element is visible and sized correctly for capture */
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.body.querySelector("[data-payment-slip-capture]");
        if (clonedEl) {
          (clonedEl as HTMLElement).style.display = "block";
          (clonedEl as HTMLElement).style.position = "relative";
          (clonedEl as HTMLElement).style.width = "800px";
          (clonedEl as HTMLElement).style.maxWidth = "800px";
          (clonedEl as HTMLElement).style.margin = "0 auto";
        }
      },
    });

    const imgData = canvas.toDataURL("image/jpeg", quality);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();  /* 210 mm */
    const pageHeight = pdf.internal.pageSize.getHeight(); /* 297 mm */
    const margin = 8; /* mm */

    const img = new Image();
    img.src = imgData;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });

    const imgWidth = img.width;
    const imgHeight = img.height;
    const availableWidth = pageWidth - margin * 2;
    const scaleFactor = availableWidth / imgWidth;
    const scaledHeight = imgHeight * scaleFactor;

    /* Single page — if taller than A4, scale down to fit */
    if (scaledHeight <= pageHeight - margin * 2) {
      pdf.addImage(imgData, "JPEG", margin, margin, availableWidth, scaledHeight);
    } else {
      /* Scale down the entire image so it fits on one page */
      const fitScale = (pageHeight - margin * 2) / scaledHeight;
      const finalWidth = availableWidth * fitScale;
      const finalHeight = (pageHeight - margin * 2);
      const xOffset = (pageWidth - finalWidth) / 2;
      pdf.addImage(imgData, "JPEG", xOffset, margin, finalWidth, finalHeight);
    }

    const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, "_");
    pdf.save(`${safeName}.pdf`);
    toast.success("Invoice downloaded successfully!");
  } catch (err) {
    console.error("PDF download failed:", err);
    toast.error("Failed to download PDF. Please try again.");
    throw err;
  }
}

/**
 * Generate a PDF Blob (useful for sharing via navigator.share).
 *
 * @param element — The DOM node to capture
 * @param options — Same as downloadPaymentSlip
 * @returns PDF Blob
 */
export async function generatePaymentSlipPDF(
  element: HTMLElement,
  options: DownloadPaymentSlipOptions = {}
): Promise<Blob> {
  const { scale = 2.5, quality = 0.92 } = options;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    imageTimeout: 20000,
  });

  const imgData = canvas.toDataURL("image/jpeg", quality);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;

  const img = new Image();
  img.src = imgData;
  await new Promise<void>((resolve) => { img.onload = () => resolve(); });

  const imgWidth = img.width;
  const imgHeight = img.height;
  const availableWidth = pageWidth - margin * 2;
  const scaleFactor = availableWidth / imgWidth;
  const scaledHeight = imgHeight * scaleFactor;

  if (scaledHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, "JPEG", margin, margin, availableWidth, scaledHeight);
  } else {
    const fitScale = (pageHeight - margin * 2) / scaledHeight;
    const finalWidth = availableWidth * fitScale;
    const finalHeight = pageHeight - margin * 2;
    const xOffset = (pageWidth - finalWidth) / 2;
    pdf.addImage(imgData, "JPEG", xOffset, margin, finalWidth, finalHeight);
  }

  return pdf.output("blob");
}
