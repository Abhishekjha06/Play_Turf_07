import { useState, useCallback, useRef, Suspense, lazy, type ReactNode } from "react";
import {
  FileDown,
  Printer,
  Share2,
  Eye,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { InvoiceData, InvoiceViewerProps } from "./types";
import { buildInvoiceWithQR, generateInvoicePDF } from "@/utils/generateInvoice";
import { downloadInvoice } from "@/utils/downloadInvoice";
import { printInvoice } from "@/utils/printInvoice";
import { shareInvoice } from "@/utils/shareInvoice";

/**
 * Lazy-load the PDF viewer from @react-pdf/renderer.
 * This keeps the main bundle small until the user clicks "View".
 */
const PDFViewer = lazy(() =>
  import("@react-pdf/renderer").then((m) => ({ default: m.PDFViewer }))
);

/**
 * InvoiceDocument is also lazy-loaded so the PDF renderer
 * code is only fetched when needed.
 */
const InvoiceDocument = lazy(() =>
  import("./InvoiceDocument").then((m) => ({ default: m.InvoiceDocument }))
);

/* ── Button Component ────────────────────────────────────── */

interface ActionBtnProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

function ActionBtn({ label, icon, onClick, primary, disabled, loading }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none min-h-[44px] ${
        primary
          ? "bg-[#00C2A8] text-[#0F1115] hover:bg-[#00d4b8]"
          : "bg-[#1F2937] text-white hover:bg-[#374151]"
      } ${disabled || loading ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

/* ── InvoiceViewer ───────────────────────────────────────── */

export function InvoiceViewer({ data, fileName, onDownload, onPrint, onShare }: InvoiceViewerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const generatingRef = useRef(false);

  /**
   * Build invoice data with QR code and generate PDF blob.
   * Cached so subsequent actions reuse the same blob.
   */
  const ensurePDF = useCallback(async (): Promise<Blob | null> => {
    if (pdfBlob && invoiceData) return pdfBlob;
    if (generatingRef.current) return null;

    generatingRef.current = true;
    setIsWorking(true);

    try {
      const dataWithQR = await buildInvoiceWithQR(data);
      const blob = await generateInvoicePDF(dataWithQR);
      setInvoiceData(dataWithQR);
      setPdfBlob(blob);
      return blob;
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate invoice PDF.");
      return null;
    } finally {
      generatingRef.current = false;
      setIsWorking(false);
    }
  }, [data, pdfBlob, invoiceData]);

  const handleView = useCallback(async () => {
    const blob = await ensurePDF();
    if (blob) setShowPreview(true);
  }, [ensurePDF]);

  const handleDownload = useCallback(async () => {
    const blob = await ensurePDF();
    if (blob) {
      downloadInvoice(blob, data.invoiceNumber);
      onDownload?.();
    }
  }, [ensurePDF, data.invoiceNumber, onDownload]);

  const handlePrint = useCallback(async () => {
    const blob = await ensurePDF();
    if (blob) {
      printInvoice(blob);
      onPrint?.();
    }
  }, [ensurePDF, onPrint]);

  const handleShare = useCallback(async () => {
    const blob = await ensurePDF();
    if (blob) {
      const safeName = `${data.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      await shareInvoice(blob, invoiceData || data, safeName);
      onShare?.();
    }
  }, [ensurePDF, data, invoiceData, onShare]);

  return (
    <div className="w-full">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <ActionBtn
          label="View Invoice"
          icon={<Eye className="w-4 h-4" />}
          onClick={handleView}
          disabled={isWorking}
        />
        <ActionBtn
          label="Download PDF"
          icon={<FileDown className="w-4 h-4" />}
          onClick={handleDownload}
          primary
          loading={isWorking}
        />
        <ActionBtn
          label="Print"
          icon={<Printer className="w-4 h-4" />}
          onClick={handlePrint}
          disabled={isWorking}
        />
        <ActionBtn
          label="Share"
          icon={<Share2 className="w-4 h-4" />}
          onClick={handleShare}
          disabled={isWorking}
        />
      </div>

      {/* PDF Preview Modal */}
      {showPreview && invoiceData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl h-[85vh] bg-white rounded-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-[#0F1115]">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Invoice Preview — {invoiceData.invoiceNumber}
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 rounded-full hover:bg-white/10 transition cursor-pointer border-none"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden">
              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <Loader2 className="w-8 h-8 animate-spin text-[#00C2A8]" />
                  </div>
                }
              >
                <PDFViewer width="100%" height="100%" showToolbar={false}>
                  <InvoiceDocument data={invoiceData} />
                </PDFViewer>
              </Suspense>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex gap-2 px-5 py-3 border-t border-gray-800 bg-[#0F1115]">
              <ActionBtn
                label="Download"
                icon={<FileDown className="w-4 h-4" />}
                onClick={handleDownload}
                primary
              />
              <ActionBtn
                label="Print"
                icon={<Printer className="w-4 h-4" />}
                onClick={handlePrint}
              />
              <ActionBtn
                label="Share"
                icon={<Share2 className="w-4 h-4" />}
                onClick={handleShare}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
