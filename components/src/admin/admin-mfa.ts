/**
 * Supabase Auth MFA (TOTP authenticator app) helpers for the admin panel.
 *
 * Real second factor: enrollment creates a TOTP factor; the login flow
 * challenges it and Supabase upgrades the session's AAL to aal2 on success.
 * RLS policies can then require `auth.jwt()->>'aal' = 'aal2'` for privileged
 * tables (template provided in supabase_admin_rbac.sql).
 */
import { getSupabase } from "@/lib/supabase";
import type { AuthenticatorAssuranceLevels, MFAFactor } from "@supabase/supabase-js";

export type AalStatus = {
  current: AuthenticatorAssuranceLevels;
  required: AuthenticatorAssuranceLevels;
  nextFactorMissingAt?: string | null;
  mfaEnabled: boolean;
};

export async function getAalStatus(): Promise<AalStatus> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    current: data?.currentLevel ?? "aal1",
    required: data?.nextLevel ?? "aal1",
    nextFactorMissingAt: data?.nextFactorEmbeddedAt ?? null,
    mfaEnabled: !!data && data.currentLevel === "aal2",
  };
}

export async function listFactors(): Promise<MFAFactor[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.all as MFAFactor[]) || [];
}

/** Begin TOTP enrollment — returns the otpauth URI + secret for the QR. */
export async function enrollTotpStart(friendlyName = "PlayTurf Admin") {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error) throw error;
  return data; // { id, type: 'totp', totp: { qr_code, secret, uri } }
}

/** Challenge + verify a TOTP factor. Returns true on success. */
export async function verifyTotp(factorId: string, code: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError || !challenge) throw challengeError || new Error("Could not start MFA challenge");

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.replace(/\s/g, ""),
  });
  if (verifyError) {
    // Wrong code — caller shows a retry; the challenge stays usable once.
    if (verifyError.message?.toLowerCase().includes("invalid")) return false;
    throw verifyError;
  }
  return true;
}

/** Enroll + immediately verify in one step (Security Center onboarding). */
export async function enrollTotpVerify(factorId: string, code: string): Promise<boolean> {
  return verifyTotp(factorId, code);
}

export async function unenrollFactor(factorId: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/**
 * Re-authenticate the current admin (password step-up for high-risk actions).
 * Returns true when the password matches the signed-in admin's account.
 */
export async function reauthenticateAdmin(password: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  return !error;
}
