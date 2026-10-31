import type { User } from "@/data/seed";
import { getSupabase, withTimeout } from "../supabase";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";

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
    avatar_id: raw.avatar_id ?? DEFAULT_AVATAR_ID,
    is_admin: raw.is_admin ?? (role === "admin" || role === "super_admin"),
    role: role,
  };
}

export async function requestOtp(phone: string): Promise<void> {
  const supabase = await getSupabase();
  const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
  const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
  if (error) throw error;
}

export async function verifyOtp(payload: OtpVerifyPayload, meGetter: () => Promise<User | null>): Promise<User> {
  const supabase = await getSupabase();
  const formattedPhone = payload.phone.startsWith("+") ? payload.phone : `+91${payload.phone}`;
  const { data, error } = await supabase.auth.verifyOtp({
    phone: formattedPhone,
    token: payload.otp,
    type: "sms",
  });
  if (error) throw error;
  
  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          full_name: payload.name || "Player",
          phone: payload.phone.slice(-10),
        });
      if (profileError) {
        console.error("Failed to create profile during OTP verify:", profileError);
      }
    }
  }

  const me = await meGetter();
  if (!me) throw new Error("Unable to load user profile after OTP verification");
  return me;
}

export async function me(): Promise<User | null> {
  const supabase = await getSupabase();
  try {
    // getUser() validates the JWT against Supabase Auth (signature + expiry).
    // getSession() only reads localStorage and must NOT be used as a fallback
    // here — it would trust a revoked/expired token. On any failure we return
    // null so callers force a re-authentication.
    const { data: { user }, error } = await withTimeout(supabase.auth.getUser());
    if (error || !user) return null;

    const { data: profile } = await withTimeout(
      supabase
        .from("profiles")
        .select("role, full_name, phone, avatar_id")
        .eq("id", user.id)
        .maybeSingle()
    );
    const userRole = profile?.role || "user";
    return {
      user_id: user.id,
      email: user.email || "",
      name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "Player",
      picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
      avatar_id: profile?.avatar_id || DEFAULT_AVATAR_ID,
      is_admin: userRole === "super_admin" || userRole === "admin",
      role: userRole,
    };
  } catch (e) {
    console.warn("Failed to get user from Supabase in me():", e);
    return null;
  }
}

export async function exchangeSession(sessionId: string, meGetter: () => Promise<User | null>): Promise<User> {
  // Not used in native Supabase flow (was emergent OAuth), return current session user
  const current = await meGetter();
  if (current) return current;
  throw new Error("No active Supabase session.");
}

export async function adminPasswordSignIn(email: string, password: string, meGetter: () => Promise<User | null>): Promise<User> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  
  if (data.user) {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
      
    if (profileErr || (profile?.role !== "admin" && profile?.role !== "super_admin")) {
      await supabase.auth.signOut();
      throw new Error("Unauthorized. Only administrators are allowed to sign in here.");
    }
  }
  
  const meUser = await meGetter();
  if (!meUser) throw new Error("Failed to load admin profile");
  return meUser;
}

export async function clientLogin(clientId: string, password: string, meGetter: () => Promise<User | null>): Promise<User> {
  const supabase = await getSupabase();
  const email = clientId.includes("@") ? clientId : `${clientId}@playturf.app`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  
  if (data.user) {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
      
    if (profileErr || profile?.role !== "client") {
      await supabase.auth.signOut();
      throw new Error("Unauthorized. Only clients/venue managers are allowed to sign in here.");
    }
  }
  
  const meUser = await meGetter();
  if (!meUser) throw new Error("Failed to load client profile");
  return meUser;
}

export async function logout(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
}

/**
 * Persists the selected mascot avatar to the caller's own profile row.
 * RLS ("Users can update own profile") scopes the write to the signed-in
 * user — no other profile can be touched.
 */
export async function updateAvatar(avatarId: string): Promise<void> {
  const supabase = await getSupabase();
  const { data: { user }, error: userError } = await withTimeout(supabase.auth.getUser());
  if (userError || !user) throw new Error("You need to be signed in to change your avatar.");

  const { error } = await withTimeout(
    supabase.from("profiles").update({ avatar_id: avatarId }).eq("id", user.id),
  );
  // PostgrestError is a plain object (not an Error instance) — wrap it so the
  // real database message (e.g. a missing column) reaches the UI toast.
  if (error) throw new Error(error.message);
}

/** Profile fields of the signed-in user, straight from Supabase Auth + profiles. */
export type OwnProfile = {
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
};

/** Loads the signed-in user's own profile (auth email + profiles row). */
export async function getOwnProfile(): Promise<OwnProfile> {
  const supabase = await getSupabase();
  const { data: { user }, error: userError } = await withTimeout(supabase.auth.getUser());
  if (userError || !user) throw new Error("You need to be signed in.");

  const { data: profile, error } = await withTimeout(
    supabase.from("profiles").select("full_name, phone, role").eq("id", user.id).maybeSingle(),
  );
  if (error) throw new Error(error.message);

  return {
    user_id: user.id,
    email: user.email || "",
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? "Player",
    phone: profile?.phone ?? "",
    role: profile?.role ?? "user",
  };
}

/**
 * Updates the signed-in user's own profile fields (full_name/phone).
 * RLS ("Users can update own profile") scopes the write to the caller.
 */
export async function updateOwnProfile(fields: { full_name?: string; phone?: string }): Promise<void> {
  const supabase = await getSupabase();
  const { data: { user }, error: userError } = await withTimeout(supabase.auth.getUser());
  if (userError || !user) throw new Error("You need to be signed in to update your profile.");

  const { error } = await withTimeout(
    supabase.from("profiles").update(fields).eq("id", user.id),
  );
  if (error) throw new Error(error.message);
}

/** Changes the signed-in user's password via Supabase Auth. */
export async function changePassword(newPassword: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
