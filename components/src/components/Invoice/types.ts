/**
 * Invoice — Types
 * Data model for the native PDF invoice system.
 */

export type PaymentStatus = "PAID" | "PENDING" | "FAILED" | "REFUNDED";
export type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed";
export type BookingType = "standard" | "host" | "join";

export interface InvoiceData {
  bookingId: string;
  invoiceNumber: string;
  transactionId: string;
  bookingDate: string;
  bookingTime: string;
  endTime?: string;
  sport: string;
  turfName: string;
  groundName?: string;
  duration: number;
  address: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: string;
  paymentGateway: string;
  upiReference?: string;
  subtotal: number;
  platformFee: number;
  convenienceFee?: number;
  discount: number;
  gst: number;
  gstRate?: number;
  total: number;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  createdAt?: string;
  currency?: string;
  companyName?: string;
  supportEmail?: string;
  website?: string;
  qrCodeDataUrl?: string;
  /** Host name (for host bookings or joined games) */
  hostName?: string;
  /** Type of booking */
  bookingType?: BookingType;
  /** Slots info for open games */
  slotsFilled?: number;
  slotsTotal?: number;
  /** Game mode e.g. "5-a-side" */
  gameMode?: string;
}

export interface InvoiceViewerProps {
  data: InvoiceData;
  fileName?: string;
  onDownload?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
}
