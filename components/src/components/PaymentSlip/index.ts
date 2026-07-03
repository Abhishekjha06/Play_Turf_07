/**
 * PaymentSlip — Barrel Export
 * Import everything from the PaymentSlip system from this single entry point.
 *
 * Usage:
 *   import { PaymentSlip, type PaymentSlipData } from "@/components/PaymentSlip";
 */

export { PaymentSlip } from "./PaymentSlip";
export { PaymentSlipHeader } from "./PaymentSlipHeader";
export { PaymentSlipFooter } from "./PaymentSlipFooter";
export { PaymentSummary } from "./PaymentSummary";
export { PaymentDetails } from "./PaymentDetails";
export { CustomerDetails } from "./CustomerDetails";
export { BookingDetails } from "./BookingDetails";
export { QRSection } from "./QRSection";
export { InvoiceTable } from "./InvoiceTable";

export type {
  PaymentSlipData,
  PaymentSlipProps,
  PaymentStatus,
  BookingStatus,
  QRSectionProps,
  InvoiceTableProps,
  InvoiceItem,
  DetailRowProps,
  StatusBadgeProps,
} from "./types";
