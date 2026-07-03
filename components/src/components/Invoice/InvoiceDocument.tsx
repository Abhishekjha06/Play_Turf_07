import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import type { InvoiceData } from "./types";

const C = {
  primary: "#00C2A8",
  dark: "#1F2937",
  gray: "#6B7280",
  grayLight: "#9CA3AF",
  grayBg: "#F3F4F6",
  border: "#E5E7EB",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
};

const S = StyleSheet.create({
  page: { padding: 16, fontFamily: "Helvetica", fontSize: 7, color: C.dark, lineHeight: 1.2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.primary },
  brand: { fontSize: 13, fontWeight: "bold", letterSpacing: 1 },
  subtitle: { fontSize: 7, color: C.gray, textTransform: "uppercase", letterSpacing: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 2, marginBottom: 1 },
  badgeText: { fontSize: 8, fontWeight: "bold" },
  metaRow: { flexDirection: "row", marginBottom: 0.5 },
  metaLabel: { fontSize: 6, color: C.grayLight, width: 50, textAlign: "right", marginRight: 3, textTransform: "uppercase" },
  metaValue: { fontSize: 7, fontWeight: "bold", width: 75, textAlign: "right" },
  sectionTitle: { fontSize: 7, fontWeight: "bold", color: C.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 1, marginTop: 4 },
  row: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  infoRow: { flexDirection: "row", marginBottom: 0.5 },
  infoLabel: { fontSize: 6, color: C.grayLight, width: 55, textTransform: "uppercase" },
  infoValue: { fontSize: 7, fontWeight: "bold", flex: 1 },
  accent: { color: C.primary },
  hostBadge: { backgroundColor: C.primary + "15", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2, marginBottom: 1, alignSelf: "flex-start" },
  hostBadgeText: { fontSize: 6, fontWeight: "bold", color: C.primary, textTransform: "uppercase" },
  tableHeader: { flexDirection: "row", backgroundColor: C.grayBg, paddingVertical: 1.5, paddingHorizontal: 4, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: C.border },
  th: { fontSize: 6, fontWeight: "bold", color: C.gray, textTransform: "uppercase" },
  thL: { flex: 3 },
  thR: { flex: 1, textAlign: "right" },
  tr: { flexDirection: "row", paddingVertical: 1, paddingHorizontal: 4, borderBottomWidth: 0.5, borderColor: C.border },
  td: { fontSize: 7 },
  tdL: { flex: 3 },
  tdR: { flex: 1, textAlign: "right", fontWeight: "bold" },
  discount: { color: C.green },
  totalRow: { flexDirection: "row", paddingVertical: 2, paddingHorizontal: 4, backgroundColor: C.primary + "10", borderTopWidth: 1, borderColor: C.primary, marginTop: 0.5 },
  totalLabel: { flex: 3, fontSize: 7, fontWeight: "bold", color: C.primary, textTransform: "uppercase" },
  totalValue: { flex: 1, textAlign: "right", fontSize: 8, fontWeight: "bold", color: C.primary },
  qrWrap: { alignItems: "center", justifyContent: "center", padding: 2, borderWidth: 0.5, borderColor: C.border, borderRadius: 2, width: 50, height: 50 },
  qrImage: { width: 46, height: 46 },
  qrLabel: { fontSize: 5, color: C.grayLight, textAlign: "center", marginTop: 1 },
  footer: { marginTop: 4, paddingTop: 3, borderTopWidth: 0.5, borderColor: C.border, flexDirection: "row", justifyContent: "space-between" },
  footerCo: { fontSize: 6, fontWeight: "bold" },
  footerLine: { fontSize: 6, color: C.gray },
  footerDisc: { fontSize: 5, color: C.grayLight, marginTop: 1, fontStyle: "italic" },
  footerLink: { fontSize: 6, color: C.primary },
});

const STATUS_CFG: Record<string, { bg: string; color: string }> = {
  PAID: { bg: C.green + "18", color: C.green },
  PENDING: { bg: C.amber + "18", color: C.amber },
  FAILED: { bg: C.red + "18", color: C.red },
  REFUNDED: { bg: C.gray + "18", color: C.gray },
};

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(s: string) {
  const [h, m] = s.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function fmtDT(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const cur = data.currency || "₹";
  const fmt = (n: number) => `${cur}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const st = STATUS_CFG[data.paymentStatus] || STATUS_CFG.PENDING;
  const timeSlot = data.endTime ? `${fmtTime(data.bookingTime)} – ${fmtTime(data.endTime)}` : fmtTime(data.bookingTime);

  const items = [
    { label: "Turf Charges", value: data.subtotal },
    { label: "Platform Fee", value: data.platformFee },
    ...(data.convenienceFee ? [{ label: "Convenience Fee", value: data.convenienceFee }] : []),
    ...(data.discount ? [{ label: "Discount", value: -data.discount }] : []),
    ...(data.gst ? [{ label: `GST (${data.gstRate || 18}%)`, value: data.gst }] : []),
  ];

  return (
    <Document title={`PlayTurf Invoice — ${data.invoiceNumber}`} author="PlayTurf Technologies" subject="Payment Receipt">
      <Page size="A4" style={S.page}>
        {/* ── HEADER ── */}
        <View style={S.header}>
          <View>
            <Text style={S.brand}>PLAYTURF</Text>
            <Text style={S.subtitle}>Payment Receipt</Text>
            {data.bookingType === "host" && (
              <View style={S.hostBadge}><Text style={S.hostBadgeText}>Host Booking</Text></View>
            )}
            {data.bookingType === "join" && (
              <View style={S.hostBadge}><Text style={S.hostBadgeText}>You Joined</Text></View>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={[S.badge, { backgroundColor: st.bg }]}>
              <Text style={[S.badgeText, { color: st.color }]}>{data.paymentStatus}</Text>
            </View>
            <View style={S.metaRow}><Text style={S.metaLabel}>Invoice</Text><Text style={S.metaValue}>{data.invoiceNumber}</Text></View>
            <View style={S.metaRow}><Text style={S.metaLabel}>Booking</Text><Text style={S.metaValue}>{data.bookingId}</Text></View>
            <View style={S.metaRow}><Text style={S.metaLabel}>Date</Text><Text style={S.metaValue}>{fmtDate(data.bookingDate)}</Text></View>
          </View>
        </View>

        {/* ── CUSTOMER + BOOKING (2 col) ── */}
        <View style={S.row}>
          <View style={S.col}>
            <Text style={S.sectionTitle}>Billed To</Text>
            <View style={S.infoRow}><Text style={S.infoLabel}>Name</Text><Text style={S.infoValue}>{data.customerName}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Phone</Text><Text style={S.infoValue}>{data.customerPhone}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Email</Text><Text style={S.infoValue}>{data.customerEmail}</Text></View>
            {data.hostName && (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>{data.bookingType === "host" ? "Host" : "Hosted By"}</Text>
                <Text style={[S.infoValue, S.accent]}>{data.hostName}</Text>
              </View>
            )}
          </View>

          <View style={S.col}>
            <Text style={S.sectionTitle}>Booking Details</Text>
            <View style={S.infoRow}><Text style={S.infoLabel}>Turf</Text><Text style={S.infoValue}>{data.turfName}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Sport</Text><Text style={S.infoValue}>{data.sport}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Court</Text><Text style={S.infoValue}>{data.groundName || "Main Court"}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Date</Text><Text style={S.infoValue}>{fmtDate(data.bookingDate)}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Time</Text><Text style={S.infoValue}>{timeSlot}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Duration</Text><Text style={S.infoValue}>{data.duration} Hour(s)</Text></View>
            {data.gameMode && (
              <View style={S.infoRow}><Text style={S.infoLabel}>Format</Text><Text style={S.infoValue}>{data.gameMode}</Text></View>
            )}
            {data.slotsTotal !== undefined && (
              <View style={S.infoRow}><Text style={S.infoLabel}>Players</Text><Text style={S.infoValue}>{data.slotsFilled} / {data.slotsTotal}</Text></View>
            )}
            <View style={S.infoRow}><Text style={S.infoLabel}>Address</Text><Text style={S.infoValue}>{data.address}</Text></View>
          </View>
        </View>

        {/* ── PAYMENT TABLE ── */}
        <Text style={S.sectionTitle}>Payment Summary</Text>
        <View>
          <View style={S.tableHeader}>
            <Text style={[S.th, S.thL]}>Description</Text>
            <Text style={[S.th, S.thR]}>Amount</Text>
          </View>
          {items.map((item) => (
            <View key={item.label} style={S.tr}>
              <Text style={[S.td, S.tdL]}>{item.label}</Text>
              <Text style={[S.td, S.tdR, item.value < 0 ? S.discount : {}]}>
                {item.value < 0 ? "-" : ""}{fmt(Math.abs(item.value))}
              </Text>
            </View>
          ))}
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Total</Text>
            <Text style={S.totalValue}>{fmt(data.total)}</Text>
          </View>
        </View>

        {/* ── PAYMENT DETAILS + QR ── */}
        <View style={[S.row, { marginTop: 3 }]}>
          <View style={[S.col, { flex: 2 }]}>
            <Text style={S.sectionTitle}>Payment Details</Text>
            <View style={S.infoRow}><Text style={S.infoLabel}>Status</Text><Text style={[S.infoValue, { color: st.color }]}>{data.paymentStatus}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Method</Text><Text style={S.infoValue}>{data.paymentMethod}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Transaction</Text><Text style={S.infoValue}>{data.transactionId}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Gateway</Text><Text style={S.infoValue}>{data.paymentGateway}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Paid On</Text><Text style={S.infoValue}>{fmtDT(data.createdAt)}</Text></View>
            {data.upiReference && (
              <View style={S.infoRow}><Text style={S.infoLabel}>UPI Ref</Text><Text style={S.infoValue}>{data.upiReference}</Text></View>
            )}
          </View>
          <View style={{ justifyContent: "flex-start", paddingTop: 10, alignItems: "center" }}>
            {data.qrCodeDataUrl ? (
              <View>
                <View style={S.qrWrap}>
                  <Image src={data.qrCodeDataUrl} style={S.qrImage} />
                </View>
                <Text style={S.qrLabel}>Scan to Verify</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={S.footer}>
          <View style={{ flex: 2 }}>
            <Text style={S.footerCo}>{data.companyName || "PlayTurf Technologies Pvt. Ltd."}</Text>
            <Text style={S.footerLine}>{data.supportEmail || "support@playturf.in"}</Text>
            <Text style={S.footerLine}>{data.website || "www.playturf.in"}</Text>
            <Text style={S.footerDisc}>This is a computer-generated invoice. No signature required.</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={S.footerLink}>Terms & Conditions</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
