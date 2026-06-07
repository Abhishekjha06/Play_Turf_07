import { getSupabase } from "../supabase";

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  (import.meta.env.REACT_APP_BACKEND_URL as string | undefined) ||
  "";

export const USE_MOCK = !BACKEND_URL;

// ---------- mock state (localStorage backed) ----------
export const LS_BOOKINGS = "playturf:bookings";
export const LS_USER = "playturf:user";
export const LS_TURFS = "playturf:turfs";
export const LS_BANNERS = "playturf:banners";
export const LS_OFFERS = "playturf:offers";
export const LS_TOURNAMENTS = "playturf:tournaments";
export const LS_FAVORITES = "playturf:favorites";
export const LS_REVIEWS = "playturf:reviews";
export const LS_ACCESS_TOKEN = "playturf:access_token";
export const ADMIN_EMAIL = "admin@playturf.app";
export const ADMIN_PASSWORD = "admin123";

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function lsSet<T>(key: string, val: T) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* noop */ }
}
export function lsRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export let accessToken = lsGet<string | null>(LS_ACCESS_TOKEN, null);
export let refreshPromise: Promise<string | null> | null = null;

export type TokenOut = {
  access_token: string;
  token_type?: string;
};

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    lsSet(LS_ACCESS_TOKEN, token);
  } else {
    lsRemove(LS_ACCESS_TOKEN);
  }
}

export async function parseError(res: Response): Promise<string> {
  const json = await res.json().catch(() => null) as { detail?: string } | null;
  if (json?.detail) return json.detail;
  const text = await res.text().catch(() => "");
  return text || `Request failed: ${res.status}`;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      setAccessToken(null);
      return null;
    }
    const data = (await res.json()) as TokenOut;
    if (!data.access_token) {
      setAccessToken(null);
      return null;
    }
    setAccessToken(data.access_token);
    return data.access_token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ---------- HTTP helper ----------
export async function http<T>(path: string, init: RequestInit = {}, retryOnUnauthorized = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    credentials: "include",
    headers,
    ...init,
  });
  if (
    !USE_MOCK &&
    res.status === 401 &&
    retryOnUnauthorized &&
    path !== "/auth/refresh" &&
    path !== "/auth/otp/verify" &&
    path !== "/auth/otp/request"
  ) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return http<T>(path, init, false);
    }
  }
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
