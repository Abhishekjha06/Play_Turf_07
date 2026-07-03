import { StyleSheet } from "@react-pdf/renderer";

export const COLORS = {
  primary: "#00C2A8",
  dark: "#1F2937",
  gray: "#6B7280",
  grayLight: "#9CA3AF",
  grayBg: "#F3F4F6",
  border: "#E5E7EB",
  white: "#FFFFFF",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
};

export const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLORS.dark,
    lineHeight: 1.3,
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.primary,
  },
  headerLeft: {
    flexDirection: "column",
  },
  headerBrand: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.dark,
    letterSpacing: 1,
    marginBottom: 1,
  },
  headerSubtitle: {
    fontSize: 9,
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 1,
  },
  metaLabel: {
    fontSize: 7,
    color: COLORS.grayLight,
    width: 70,
    textAlign: "right",
    marginRight: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: 8,
    color: COLORS.dark,
    fontWeight: "bold",
    width: 90,
    textAlign: "right",
  },

  /* ── Section Titles ── */
  sectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 8,
  },
  sectionTitleFirst: {
    fontSize: 9,
    fontWeight: "bold",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },

  /* ── Two Column Layout ── */
  row: {
    flexDirection: "row",
    gap: 16,
  },
  col: {
    flex: 1,
  },
  col2: {
    flex: 2,
  },

  /* ── Info Rows ── */
  infoRow: {
    flexDirection: "row",
    marginBottom: 1,
  },
  infoLabel: {
    fontSize: 7,
    color: COLORS.grayLight,
    width: 80,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 8,
    color: COLORS.dark,
    fontWeight: "bold",
    flex: 1,
  },
  infoValueAccent: {
    color: COLORS.primary,
  },
  infoValueGreen: {
    color: COLORS.green,
  },

  /* ── Host / Join Badge ── */
  hostBadge: {
    backgroundColor: COLORS.primary + "18",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 2,
    alignSelf: "flex-start",
  },
  hostBadgeText: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* ── Table ── */
  table: {
    marginTop: 8,
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.grayBg,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableHeaderLeft: {
    flex: 3,
  },
  tableHeaderRight: {
    flex: 1,
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableCell: {
    fontSize: 8,
    color: COLORS.dark,
  },
  tableCellLeft: {
    flex: 3,
  },
  tableCellRight: {
    flex: 1,
    textAlign: "right",
    fontWeight: "bold",
  },
  tableDiscount: {
    color: COLORS.green,
  },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: COLORS.primary + "12",
    borderTopWidth: 1,
    borderTopColor: COLORS.primary,
    marginTop: 1,
  },
  totalLabel: {
    flex: 3,
    fontSize: 9,
    fontWeight: "bold",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  totalValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.primary,
  },

  /* ── QR Code ── */
  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 3,
    width: 72,
    height: 72,
  },
  qrImage: {
    width: 64,
    height: 64,
  },
  qrLabel: {
    fontSize: 6,
    color: COLORS.grayLight,
    textAlign: "center",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  /* ── Footer ── */
  footer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerLeft: {
    flex: 2,
  },
  footerCompany: {
    fontSize: 8,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 1,
  },
  footerLine: {
    fontSize: 7,
    color: COLORS.gray,
    marginBottom: 0.5,
  },
  footerDisclaimer: {
    fontSize: 6,
    color: COLORS.grayLight,
    marginTop: 2,
    fontStyle: "italic",
  },
  footerRight: {
    alignItems: "flex-end",
  },
  footerLink: {
    fontSize: 7,
    color: COLORS.primary,
    marginBottom: 0.5,
  },
});
