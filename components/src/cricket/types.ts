export type Team = {
  id: string;
  name: string;
  shortName: string;
  colors: [string, string];
  seed: number;
};

export type PaymentMethod = "UPI" | "Card" | "Wallet";

export type BookingStep = 1 | 2 | 3;

export type BookingState = {
  step: BookingStep;
  teams: Team[];
  teamAId: string;
  teamBId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  odds: number;
  bookingId: string;
  placedAt: string;
};
