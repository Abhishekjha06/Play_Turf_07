import { View, Text } from "@react-pdf/renderer";
import { styles, COLORS } from "./styles";
import type { InvoiceData } from "./types";

function formatDateTime(isoStr?: string) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLOR: Record<string, string> = {
  PAID: COLORS.green,
  PENDING: COLORS.amber,
  FAILED: COLORS.red,
  REFUNDED: COLORS.gray,
};

export function PaymentSection({ data }: { data: InvoiceData }) {
  const statusColor = STATUS_COLOR[data.paymentStatus] || COLORS.gray;

  return (
    <View>
      <Text style={styles.sectionTitle}>Payment Details</Text>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Status</Text>
        <Text style={[styles.infoValue, { color: statusColor }]}>
          {data.paymentStatus}
        </Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Method</Text>
        <Text style={styles.infoValue}>{data.paymentMethod}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Transaction</Text>
        <Text style={styles.infoValue}>{data.transactionId}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Gateway</Text>
        <Text style={styles.infoValue}>{data.paymentGateway}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Paid On</Text>
        <Text style={styles.infoValue}>{formatDateTime(data.createdAt)}</Text>
      </View>
      {data.upiReference && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>UPI Ref</Text>
          <Text style={styles.infoValue}>{data.upiReference}</Text>
        </View>
      )}
    </View>
  );
}
