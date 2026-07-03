import { View, Text } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { InvoiceData } from "./types";

export function CustomerSection({ data }: { data: InvoiceData }) {
  return (
    <View>
      <Text style={styles.sectionTitleFirst}>Billed To</Text>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Name</Text>
        <Text style={styles.infoValue}>{data.customerName}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Phone</Text>
        <Text style={styles.infoValue}>{data.customerPhone}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Email</Text>
        <Text style={styles.infoValue}>{data.customerEmail}</Text>
      </View>
    </View>
  );
}
