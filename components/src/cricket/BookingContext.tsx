import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { calculateOdds, generateBookingId } from "./mockApi";
import { createTeam, defaultTeams } from "./data";
import type { BookingState, BookingStep, PaymentMethod, Team } from "./types";

type BookingContextValue = {
  state: BookingState;
  teamA?: Team;
  teamB?: Team;
  potentialWin: number;
  setStep: (step: BookingStep) => void;
  setTeamA: (teamId: string) => void;
  setTeamB: (teamId: string) => void;
  setAmount: (amount: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  addTeam: (name: string) => void;
  updateTeam: (teamId: string, name: string) => void;
  removeTeam: (teamId: string) => void;
  resetFlow: () => void;
  completeBooking: () => void;
};

const storageKey = "play-turf-cricket-booking";

const initialState: BookingState = {
  step: 1,
  teams: defaultTeams,
  teamAId: defaultTeams[0].id,
  teamBId: defaultTeams[1].id,
  amount: 500,
  paymentMethod: "UPI",
  odds: calculateOdds(defaultTeams[0], defaultTeams[1]),
  bookingId: generateBookingId(),
  placedAt: "",
};

const BookingContext = createContext<BookingContextValue | null>(null);

const loadInitialState = () => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialState;
    const saved = JSON.parse(raw) as BookingState;
    return { ...initialState, ...saved, teams: saved.teams?.length ? saved.teams : defaultTeams };
  } catch {
    return initialState;
  }
};

export function CricketBookingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BookingState>(loadInitialState);

  const teamA = state.teams.find((team) => team.id === state.teamAId);
  const teamB = state.teams.find((team) => team.id === state.teamBId);
  const odds = calculateOdds(teamA, teamB);
  const potentialWin = Math.round(state.amount * odds);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ ...state, odds }));
  }, [state, odds]);

  const value = useMemo<BookingContextValue>(
    () => ({
      state: { ...state, odds },
      teamA,
      teamB,
      potentialWin,
      setStep: (step) => setState((current) => ({ ...current, step })),
      setTeamA: (teamAId) =>
        setState((current) => ({
          ...current,
          teamAId,
          teamBId: teamAId === current.teamBId ? current.teams.find((team) => team.id !== teamAId)?.id ?? current.teamBId : current.teamBId,
        })),
      setTeamB: (teamBId) =>
        setState((current) => ({
          ...current,
          teamBId,
          teamAId: teamBId === current.teamAId ? current.teams.find((team) => team.id !== teamBId)?.id ?? current.teamAId : current.teamAId,
        })),
      setAmount: (amount) => setState((current) => ({ ...current, amount: Math.max(0, amount) })),
      setPaymentMethod: (paymentMethod) => setState((current) => ({ ...current, paymentMethod })),
      addTeam: (name) =>
        setState((current) => {
          const clean = name.trim();
          if (!clean) return current;
          return { ...current, teams: [...current.teams, createTeam(clean, current.teams.length)] };
        }),
      updateTeam: (teamId, name) =>
        setState((current) => ({
          ...current,
          teams: current.teams.map((team) => (team.id === teamId ? { ...team, name: name.trim() || team.name, shortName: name.trim().slice(0, 2).toUpperCase() || team.shortName } : team)),
        })),
      removeTeam: (teamId) =>
        setState((current) => {
          if (current.teams.length <= 2) return current;
          const teams = current.teams.filter((team) => team.id !== teamId);
          return {
            ...current,
            teams,
            teamAId: current.teamAId === teamId ? teams[0].id : current.teamAId,
            teamBId: current.teamBId === teamId ? teams.find((team) => team.id !== current.teamAId)?.id ?? teams[0].id : current.teamBId,
          };
        }),
      resetFlow: () => setState({ ...initialState, bookingId: generateBookingId() }),
      completeBooking: () =>
        setState((current) => ({
          ...current,
          step: 3,
          bookingId: current.bookingId || generateBookingId(),
          placedAt: new Date().toISOString(),
        })),
    }),
    [state, odds, teamA, teamB, potentialWin],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export const useCricketBooking = () => {
  const context = useContext(BookingContext);
  if (!context) throw new Error("useCricketBooking must be used inside CricketBookingProvider");
  return context;
};
