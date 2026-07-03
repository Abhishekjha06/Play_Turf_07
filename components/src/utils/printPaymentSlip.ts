/**
 * PaymentSlip — Print
 * Opens the browser print dialog scoped to the invoice element only.
 */

import { toast } from "sonner";

const PRINT_STYLE_ID = "pt-invoice-print-styles";

function ensurePrintStyles() {
  if (document.getElementById(PRINT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      @page { size: A4 portrait; margin: 0; }

      body > *:not(.pt-invoice-print-root) { display: none !important; }
      body { background: #fff !important; color: #000 !important; }

      .pt-invoice-print-root {
        position: static !important;
        width: 100% !important;
        height: auto !important;
        overflow: visible !important;
        background: #fff !important;
      }

      .pt-invoice {
        box-shadow: none !important;
        border: 1px solid #e2e8f0 !important;
        max-width: 100% !important;
        width: 210mm !important;
        margin: 0 !important;
        border-radius: 0 !important;
        page-break-inside: avoid;
      }

      .pt-invoice__actions { display: none !important; }
      .pt-invoice__header { background: #0f1115 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .pt-invoice__paid-badge { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .pt-invoice__section-title { color: #00c2a8 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .pt-invoice__total-row td { color: #00c2a8 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .pt-invoice__section { page-break-inside: avoid; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Print only the invoice element.
 *
 * Temporarily wraps the element in a known root class so the
 * print CSS can isolate it, then restores the DOM afterwards.
 *
 * @param element — The invoice DOM node to print
 */
export function printPaymentSlip(element: HTMLElement): void {
  try {
    ensurePrintStyles();

    /* Mark the closest scrollable container so CSS can hide siblings */
    const root = element.closest(".pt-invoice-print-root") as HTMLElement | null;
    if (root) {
      root.classList.add("pt-invoice-print-root");
    }

    /* Mark the element itself for capture */
    element.setAttribute("data-printing", "true");

    window.print();

    /* Cleanup */
    element.removeAttribute("data-printing");
    if (root) {
      root.classList.remove("pt-invoice-print-root");
    }
  } catch (err) {
    console.error("Print failed:", err);
    toast.error("Failed to print invoice.");
  }
}

/**
 * Programmatically trigger print after a short delay (useful for
 * ensuring DOM is fully rendered before print dialog opens).
 */
export function printPaymentSlipAsync(element: HTMLElement, delayMs = 300): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      printPaymentSlip(element);
      resolve();
    }, delayMs);
  });
}
