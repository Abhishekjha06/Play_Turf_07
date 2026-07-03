import { View, Text } from "@react-pdf/renderer";
import { styles, COLORS } from "./styles";
import type { InvoiceData } from "./types";

export function InvoiceTable({ data }: { data: InvoiceData }) {
  const currency = data.currency || "₹";
  const fmt = (n: number) => `${currency}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const items = [
    { label: "Turf Charges", value: data.subtotal },
    { label: "Platform Fee", value: data.platformFee },
    ...(data.convenienceFee ? [{ label: "Convenience Fee", value: data.convenienceFee }] : []),
    ...(data.discount ? [{ label: "Discount", value: -data.discount }] : []),
    ...(data.gst ? [{ label: `GST (${data.gstRate || 18}%)`, value: data.gst }] : []),
  ];

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.tableHeaderLeft]}>Description</Text>
        <Text style={[styles.tableHeaderCell, styles.tableHeaderRight]}>Amount</Text>
      </View>

      {items.map((item) => (
        <View key={item.label} style={styles.tableRow}>
          <Text style={[styles.tableCell, styles.tableCellLeft]}>{item.label}</Text>
          <Text
            style={[
              styles.tableCell,
              styles.tableCellRight,
              item.value < 0 && styles.tableDiscount,
            ]}
          >
            {item.value < 0 ? "-" : ""}
            {fmt(Math.abs(item.value))}
          </Text>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{fmt(data.total)}</Text>
      </View>
    </View>
  );
}
