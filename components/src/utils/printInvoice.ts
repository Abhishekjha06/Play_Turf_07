import { toast } from "sonner";

/**
 * Print a PDF Blob by opening it in a hidden iframe
 * and triggering the browser print dialog.
 *
 * @param blob — PDF Blob
 * @param title — Document title (optional)
 */
export function printInvoice(blob: Blob, title = "PlayTurf Invoice"): void {
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.opacity = "0";
  iframe.src = url;
  iframe.title = title;

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch {
        toast.error("Unable to print invoice.");
      }
      // Clean up after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    }, 500);
  };

  document.body.appendChild(iframe);
}
