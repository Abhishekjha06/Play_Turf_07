/**
 * Invoice — Types
 * Data model for the native PDF invoice system.
 */

export type PaymentStatus = "PAID" | "PENDING" | "FAILED" | "REFUNDED";
export type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed";

export interface InvoiceData {
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
  /** Discount applied */
  discount: number;
  /** GST amount */
  gst: number;
  /** GST percentage (e.g. 18) */
  gstRate?: number;
  /** Final total paid */
  total: number;
  /** Booking status */
  bookingStatus: BookingStatus;
  /** Payment status */
  paymentStatus: PaymentStatus;
  /** When the booking was created (ISO string) */
  createdAt?: string;
  /** Currency symbol (default: ₹) */
  currency?: string;
  /** Company / brand name */
  companyName?: string;
  /** Company support email */
  supportEmail?: string;
  /** Company website */
  website?: string;
  /** Pre-generated QR code base64 data URL */
  qrCodeDataUrl?: string;
}

export interface InvoiceViewerProps {
  data: InvoiceData;
  fileName?: string;
  onDownload?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
}
