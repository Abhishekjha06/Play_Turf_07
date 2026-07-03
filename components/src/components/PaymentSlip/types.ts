/**
 * PaymentSlip — Types
 * Enterprise-level type definitions for the PlayTurf invoice system.
 */

export type PaymentStatus = "PAID" | "PENDING" | "FAILED" | "REFUNDED";
export type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed";

export interface PaymentSlipData {
  /** Unique booking identifier */
  bookingId: string;
  /** Invoice number (e.g. INV000245) */
  invoiceNumber: string;
  /** Payment gateway transaction ID */
  transactionId: string;
  /** Booking date (YYYY-MM-DD) */
  bookingDate: string;
  /** Booking start time (HH:mm) */
  bookingTime: string;
  /** End time (HH:mm) */
  endTime?: string;
  /** Sport type */
  sport: string;
  /** Turf / venue name */
  turfName: string;
  /** Ground / court name */
  groundName?: string;
  /** Duration in hours */
  duration: number;
  /** Full venue address */
  address: string;
  /** Customer full name */
  customerName: string;
  /** Customer email */
  customerEmail: string;
  /** Customer phone */
  customerPhone: string;
  /** Payment method (UPI, Card, Net Banking, Wallet) */
  paymentMethod: string;
  /** Payment gateway name (Razorpay, Stripe, etc.) */
  paymentGateway: string;
  /** UPI reference / UTR number */
  upiReference?: string;
  /** Subtotal before fees & taxes */
  subtotal: number;
  /** Platform convenience fee */
  platformFee: number;
  /** Convenience fee (payment processing) */
  convenienceFee?: number;
  /** Discount applied (negative or positive value) */
  discount: number;
  /** GST amount */
  gst: number;
  /** Final total paid */
  total: number;
  /** Booking status */
  bookingStatus: BookingStatus;
  /** Payment status */
  paymentStatus: PaymentStatus;
  /** Data encoded in the QR code */
  qrCodeValue: string;
  /** When the booking was created (ISO string) */
  createdAt?: string;
  /** Currency symbol (default: ₹) */
  currency?: string;
  /** Optional notes / terms text */
  notes?: string;
}

export interface PaymentSlipProps {
  data: PaymentSlipData;
  /** Ref forwarded for PDF/print capture */
  ref?: React.Ref<HTMLDivElement>;
  /** Optional className */
  className?: string;
  /** Called when download completes */
  onDownload?: () => void;
  /** Called when share completes */
  onShare?: () => void;
  /** Called when print is triggered */
  onPrint?: () => void;
  /** Hide action buttons (for embedded use) */
  hideActions?: boolean;
}

export interface QRSectionProps {
  value: string;
  size?: number;
  label?: string;
  bookingId: string;
  customerName: string;
  amount: number;
  invoiceNumber: string;
}

export interface InvoiceTableProps {
  items: InvoiceItem[];
  total: number;
  currency?: string;
}

export interface InvoiceItem {
  label: string;
  value: number;
  type?: "charge" | "fee" | "discount" | "tax" | "total";
  description?: string;
}

export interface DetailRowProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  accent?: string;
}

export interface StatusBadgeProps {
  status: PaymentStatus;
  size?: "sm" | "md" | "lg";
}
