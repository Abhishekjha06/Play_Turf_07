import { View, Text } from "@react-pdf/renderer";
import { styles, COLORS } from "./styles";
import type { InvoiceData } from "./types";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  PAID: { bg: COLORS.green + "18", color: COLORS.green },
  PENDING: { bg: COLORS.amber + "18", color: COLORS.amber },
  FAILED: { bg: COLORS.red + "18", color: COLORS.red },
  REFUNDED: { bg: COLORS.gray + "18", color: COLORS.gray },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function InvoiceHeader({ data }: { data: InvoiceData }) {
  const cfg = STATUS_STYLES[data.paymentStatus] || STATUS_STYLES.PENDING;

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerBrand}>PLAYTURF</Text>
        <Text style={styles.headerSubtitle}>Payment Receipt</Text>
      </View>

      <View style={styles.headerRight}>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusText, { color: cfg.color }]}>
            {data.paymentStatus}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Invoice</Text>
          <Text style={styles.metaValue}>{data.invoiceNumber}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Booking</Text>
          <Text style={styles.metaValue}>{data.bookingId}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{formatDate(data.bookingDate)}</Text>
        </View>
      </View>
    </View>
  );
}
