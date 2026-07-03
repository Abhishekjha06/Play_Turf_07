import { StyleSheet } from "@react-pdf/renderer";

/**
 * Invoice — Shared PDF Styles
 * Compact, professional A4 invoice styling.
 */

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
  blue: "#3B82F6",
};

export const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.dark,
    lineHeight: 1.4,
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  headerLeft: {
    flexDirection: "column",
  },
  headerBrand: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.dark,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 8,
    color: COLORS.grayLight,
    width: 80,
    textAlign: "right",
    marginRight: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 9,
    color: COLORS.dark,
    fontWeight: "bold",
    width: 100,
    textAlign: "right",
  },

  /* ── Section Titles ── */
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
  },
  sectionTitleFirst: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },

  /* ── Two Column Layout ── */
  row: {
    flexDirection: "row",
    gap: 24,
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
    marginBottom: 3,
  },
  infoLabel: {
    fontSize: 8,
    color: COLORS.grayLight,
    width: 90,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 9,
    color: COLORS.dark,
    fontWeight: "bold",
    flex: 1,
  },

  /* ── Table ── */
  table: {
    marginTop: 12,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.grayBg,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableCell: {
    fontSize: 9,
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
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: COLORS.primary + "15",
    borderTopWidth: 1.5,
    borderTopColor: COLORS.primary,
    marginTop: 2,
  },
  totalLabel: {
    flex: 3,
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.primary,
  },

  /* ── QR Code ── */
  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    width: 100,
    height: 100,
  },
  qrImage: {
    width: 84,
    height: 84,
  },
  qrLabel: {
    fontSize: 7,
    color: COLORS.grayLight,
    textAlign: "center",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* ── Footer ── */
  footer: {
    marginTop: "auto",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerLeft: {
    flex: 2,
  },
  footerCompany: {
    fontSize: 9,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 2,
  },
  footerLine: {
    fontSize: 8,
    color: COLORS.gray,
    marginBottom: 1,
  },
  footerDisclaimer: {
    fontSize: 7,
    color: COLORS.grayLight,
    marginTop: 4,
    fontStyle: "italic",
  },
  footerRight: {
    alignItems: "flex-end",
  },
  footerLink: {
    fontSize: 8,
    color: COLORS.primary,
    marginBottom: 1,
  },
});
