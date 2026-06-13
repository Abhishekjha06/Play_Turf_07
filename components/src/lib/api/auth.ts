import {
  type User,
} from "@/data/seed";
import { USE_MOCK, lsGet, lsSet, LS_USER, delay, http, uid, setAccessToken, TokenOut, ADMIN_EMAIL, ADMIN_PASSWORD } from "./core";

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
  await delay(250);
  const normalizedEmail = email.trim().toLowerCase();
  if (
    (normalizedEmail === "jabhishek0606@gmail.com" && password === "9765075127@Aj") ||
    (normalizedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD)
  ) {
    const u: User = {
      user_id: normalizedEmail === "jabhishek0606@gmail.com" ? "admin_abhishek" : "admin_001",
      email: normalizedEmail,
      name: normalizedEmail === "jabhishek0606@gmail.com" ? "Abhishek Jha" : "Admin",
      picture: "",
      is_admin: true,
      role: "admin",
    };
    setMockUser(u);
    return u;
  }
  throw new Error("Invalid admin ID or password");
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
  await delay(250);
  const normalizedClient = clientId.trim().toLowerCase();
  
  if (normalizedClient === "mokomoms456@gmail.com") {
    const u: User = {
      user_id: "client_mokomoms",
      email: "mokomoms456@gmail.com",
      name: "Mokomoms Client",
      picture: "",
      is_admin: false,
      role: "client",
    };
    setMockUser(u);
    localStorage.setItem("client_token", "mock_client_token_mokomoms");
    localStorage.setItem("client_id", "mokomoms456@gmail.com");
    return u;
  }
  
  if (normalizedClient === "abhishek1018@" || normalizedClient === "abhishek1018@example.com") {
    if (password === "123456789") {
      const u: User = {
        user_id: "client_abhishek",
        email: "abhishek1018@example.com",
        name: "Abhishek",
        picture: "",
        is_admin: false,
        role: "client",
      };
      setMockUser(u);
      localStorage.setItem("client_token", "mock_client_token_abhishek");
      localStorage.setItem("client_id", normalizedClient);
      return u;
    }
  }
  
  if (normalizedClient === "jabhishek0606@" || normalizedClient === "jabhishek0606@example.com" || normalizedClient === "jabhishek0606@gmail.com") {
    if (password === "9765075127@Aj") {
      const u: User = {
        user_id: "client_jabhishek",
        email: "jabhishek0606@gmail.com",
        name: "Abhishek Jha",
        picture: "",
        is_admin: false,
        role: "client",
      };
      setMockUser(u);
      localStorage.setItem("client_token", "mock_client_token_jabhishek");
      localStorage.setItem("client_id", normalizedClient);
      return u;
    }
  }
  
  if (normalizedClient === "demo_client" || normalizedClient === "client@playturf.app") {
    if (password === "demo123") {
      const u: User = {
        user_id: "client_demo",
        email: "client@playturf.app",
        name: "Demo Client",
        picture: "",
        is_admin: false,
        role: "client",
      };
      setMockUser(u);
      localStorage.setItem("client_token", "mock_client_token");
      localStorage.setItem("client_id", normalizedClient);
      return u;
    }
  }
  throw new Error("Invalid client ID or password");
}

export async function logout(): Promise<void> {
  if (USE_MOCK) { setMockUser(null); return; }
  await http<void>("/auth/logout", { method: "POST" });
  setAccessToken(null);
}
