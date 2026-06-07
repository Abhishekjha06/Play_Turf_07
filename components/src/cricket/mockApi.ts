import type { Team } from "./types";

export const generateBookingId = () => `PT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export const calculateOdds = (teamA?: Team, teamB?: Team) => {
  const seed = (teamA?.seed ?? 4) + (teamB?.seed ?? 7);
  return Number((1.35 + (seed % 9) * 0.17).toFixed(2));
};

export const mockConfirmBooking = () =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, 1200);
  });
