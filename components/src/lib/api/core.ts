export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
