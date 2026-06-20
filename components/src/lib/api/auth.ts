import {
  type User,
} from "@/data/seed";
import { USE_MOCK, lsGet, lsSet, LS_USER, delay, http, uid, setAccessToken, TokenOut } from "./core";

export function getMockUser(): User | null { return lsGet<User | null>(LS_USER, null); }
export function setMockUser(u: User | null) { lsSet(LS_USER, u); }

export type OtpVerifyPayload = {
  phone: string;
  otp: string;
  name?: string;
  email?: string;
};

export function normalizeUser(raw: Partial<User> & { role?: string; user_id?: string | number }): User {
  const userId = raw.user_id ?? "";
  const role = raw.role ?? "user";
  return {
    user_id: String(userId),
    email: raw.email ?? "",
    name: raw.name ?? "Player",
    picture: raw.picture ?? "",
    is_admin: raw.is_admin ?? role === "admin",
    role: role,
  };
}

export async function requestOtp(phone: string): Promise<void> {
  if (USE_MOCK) {
    await delay(180);
    return;
  }
  await http<{ message: string }>("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) });
}

export async function verifyOtp(payload: OtpVerifyPayload, meGetter: () => Promise<User | null>): Promise<User> {
  if (USE_MOCK) {
    await delay(200);
    const u: User = {
      user_id: uid("user"),
      email: payload.email || "you@playturf.app",
      name: payload.name || "Player One",
      picture: "",
      is_admin: false,
      role: "user",
    };
    setMockUser(u);
    return u;
  }
  const token = await http<TokenOut>("/auth/otp/verify", { method: "POST", body: JSON.stringify(payload) });
  setAccessToken(token.access_token);
  const me = await meGetter();
  if (!me) throw new Error("Unable to load user profile after OTP verification");
  return me;
}

export async function me(): Promise<User | null> {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        const userRole = profile?.role || "user";
        return {
          user_id: user.id,
          email: user.email || "",
          name: user.user_metadata?.full_name || user.user_metadata?.name || "Player",
          picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
          is_admin: userRole === "super_admin" || userRole === "admin",
          role: userRole,
        };
      }
    } catch (e) {
      console.warn("Failed to get user from Supabase in me():", e);
    }
  }

  if (USE_MOCK) { await delay(80); return getMockUser(); }
  try {
    const response = await http<Partial<User> & { role?: string; user_id?: string | number }>("/auth/me");
    return normalizeUser(response);
  } catch {
    return null;
  }
}

export async function exchangeSession(sessionId: string, meGetter: () => Promise<User | null>): Promise<User> {
  if (USE_MOCK) {
    await delay(200);
    const u: User = {
      user_id: uid("user").replace("user_", "user_"),
      email: "you@playturf.app",
      name: "Player One",
      picture: "",
      is_admin: false,
      role: "user",
    };
    setMockUser(u);
    return u;
  }
  const response = await http<User | (Partial<User> & TokenOut & { user?: Partial<User> })>(
    "/auth/google/session",
    { method: "POST", body: JSON.stringify({ session_id: sessionId }) }
  );
  if ("access_token" in response && response.access_token) {
    setAccessToken(response.access_token);
    if (response.user) {
      return normalizeUser(response.user);
    }
    const me = await meGetter();
    if (me) return me;
  }
  return normalizeUser(response as Partial<User>);
}

export async function mockGoogleSignIn(role: "user" | "admin" | "client" = "user"): Promise<User> {
  await delay(250);
  const isAdmin = role === "admin";
  const isClient = role === "client";
  const u: User = {
    user_id: uid("user"),
    email: isAdmin ? "admin@playturf.app" : isClient ? "client@playturf.app" : "you@playturf.app",
    name: isAdmin ? "Admin" : isClient ? "Demo Client" : "Player One",
    picture: "",
    is_admin: isAdmin,
    role,
  };
  setMockUser(u);
  return u;
}

export async function adminPasswordSignIn(email: string, password: string, meGetter: () => Promise<User | null>): Promise<User> {
  if (!USE_MOCK) {
    const response = await http<User | (Partial<User> & TokenOut & { user?: Partial<User> })>(
      "/auth/admin-login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
    if ("access_token" in response && response.access_token) {
      setAccessToken(response.access_token);
      if (response.user) {
        return normalizeUser(response.user);
      }
      const me = await meGetter();
      if (me) return me;
    }
    return normalizeUser(response as Partial<User>);
  }
  // SECURITY: Mock mode uses a single non-secret demo credential.
  // Real authentication always happens server-side via /auth/admin-login.
  await delay(250);
  throw new Error("Admin sign-in is disabled in mock mode. Configure VITE_BACKEND_URL to enable server authentication.");
}

export async function clientLogin(clientId: string, password: string, meGetter: () => Promise<User | null>): Promise<User> {
  if (!USE_MOCK) {
    const response = await http<User | (Partial<User> & TokenOut & { user?: Partial<User> })>(
      "/auth/client/login",
      { method: "POST", body: JSON.stringify({ client_id: clientId, password }) }
    );
    if ("access_token" in response && response.access_token) {
      setAccessToken(response.access_token);
      if (response.user) {
        return normalizeUser(response.user);
      }
      const me = await meGetter();
      if (me) return me;
    }
    return normalizeUser(response as Partial<User>);
  }
  // SECURITY: Mock mode no longer accepts hardcoded credentials.
  // Client authentication must go through the backend.
  await delay(250);
  throw new Error("Client sign-in is disabled in mock mode. Configure VITE_BACKEND_URL to enable server authentication.");
}

export async function logout(): Promise<void> {
  if (USE_MOCK) { setMockUser(null); return; }
  await http<void>("/auth/logout", { method: "POST" });
  setAccessToken(null);
}
