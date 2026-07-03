import { Document, Page, View } from "@react-pdf/renderer";
import { styles } from "./styles";
import { InvoiceHeader } from "./InvoiceHeader";
import { InvoiceFooter } from "./InvoiceFooter";
import { CustomerSection } from "./CustomerSection";
import { BookingSection } from "./BookingSection";
import { PaymentSection } from "./PaymentSection";
import { QRCodeSection } from "./QRCodeSection";
import { InvoiceTable } from "./InvoiceTable";
import type { InvoiceData } from "./types";

/**
 * InvoiceDocument — Native PDF Invoice
 *
 * Composes all invoice sections into a single A4 page using
 * @react-pdf/renderer primitives. Every element renders as real
 * PDF text / vector graphics — not screenshots.
 */
export function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document
      title={`PlayTurf Invoice — ${data.invoiceNumber}`}
      author="PlayTurf Technologies"
      subject="Payment Receipt"
      keywords="invoice, receipt, playturf, booking"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <InvoiceHeader data={data} />

        {/* ── Customer + Booking ── */}
        <View style={styles.row}>
          <View style={styles.col}>
            <CustomerSection data={data} />
          </View>
          <View style={styles.col}>
            <BookingSection data={data} />
          </View>
        </View>

        {/* ── Payment Summary Table ── */}
        <InvoiceTable data={data} />

        {/* ── Payment Details + QR ── */}
        <View style={styles.row}>
          <View style={styles.col2}>
            <PaymentSection data={data} />
          </View>
          <View style={{ justifyContent: "flex-start", paddingTop: 12 }}>
            <QRCodeSection data={data} />
          </View>
        </View>

        {/* ── Footer ── */}
        <InvoiceFooter data={data} />
      </Page>
    </Document>
  );
}
