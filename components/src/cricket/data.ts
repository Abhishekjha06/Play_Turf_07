import type { Team } from "./types";

const palettes: Array<[string, string]> = [
  ["#22d3ee", "#8b5cf6"],
  ["#34d399", "#06b6d4"],
  ["#a78bfa", "#f472b6"],
  ["#60a5fa", "#22c55e"],
  ["#facc15", "#22d3ee"],
  ["#fb7185", "#8b5cf6"],
  ["#14b8a6", "#a3e635"],
  ["#38bdf8", "#6366f1"],
];

export const teamNames = [
  "Thunder Strikers",
  "Royal Blazers",
  "Power Hitters XI",
  "Shadow Warriors",
  "Cricket Titans",
  "Pitch Predators",
  "Firestorm XI",
  "Boundary Breakers",
  "Iron Grip CC",
  "Night Riders",
  "Elite Challengers",
  "Storm Blades",
  "Victory Vipers",
  "Blue Flame XI",
  "Rising Legends",
  "Cricket Commanders",
];

export const makeShortName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export const createTeam = (name: string, index: number): Team => ({
  id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${index}`,
  name,
  shortName: makeShortName(name),
  colors: palettes[index % palettes.length],
  seed: index + 3,
});

export const defaultTeams = teamNames.map(createTeam);

export const quickAmounts = [100, 500, 1000, 5000];
