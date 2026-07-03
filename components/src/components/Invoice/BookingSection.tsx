import { View, Text } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { InvoiceData } from "./types";

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

export function BookingSection({ data }: { data: InvoiceData }) {
  const timeSlot = data.endTime
    ? `${formatTime(data.bookingTime)} – ${formatTime(data.endTime)}`
    : formatTime(data.bookingTime);

  return (
    <View>
      <Text style={styles.sectionTitle}>Booking Details</Text>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Turf</Text>
        <Text style={styles.infoValue}>{data.turfName}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Sport</Text>
        <Text style={styles.infoValue}>{data.sport}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Court</Text>
        <Text style={styles.infoValue}>{data.groundName || "Main Court"}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Date</Text>
        <Text style={styles.infoValue}>{formatDate(data.bookingDate)}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Time Slot</Text>
        <Text style={styles.infoValue}>{timeSlot}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Duration</Text>
        <Text style={styles.infoValue}>{data.duration} Hour(s)</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Address</Text>
        <Text style={styles.infoValue}>{data.address}</Text>
      </View>
    </View>
  );
}
