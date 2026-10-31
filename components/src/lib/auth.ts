import { api } from "@/lib/api";
import type { User } from "@/data/seed";
import {
  isLocked,
  trackFailedAttempt,
  clearAttempts,
  getRemainingAttempts,
  getTimeUntilUnlocked,
  formatTimeRemaining,
  resetLockout,
} from "@/lib/admin-attempt-tracker";
import { signInWithGoogle as authServiceGoogle } from "@/services/authService";
import { getSupabase, withTimeout, clearSupabaseCache } from "@/lib/supabase";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";

// minimal store using plain event emitter pattern
type Listener = () => void;
let _user: User | null = null;
let _loading = true;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export function getUser() { return _user; }
export function isLoading() { return _loading; }

/**
 * Fetch the profile role + mascot avatar for a user id. Falls back to
 * "user"/the default mascot if the row or the request is unavailable — the
 * real authorization decision is enforced by the database (RLS) and by
 * Supabase Auth (JWT), so a missing profile never grants privilege, it only
 * degrades gracefully.
 */
async function fetchProfile(supabase: SupabaseClient, userId: string): Promise<{ role: string; avatarId: string }> {
  const { data: profile, error } = await withTimeout(
    supabase.from("profiles").select("role, avatar_id").eq("id", userId).maybeSingle(),
    8000
  );
  if (error) console.warn("Profile fetch error:", error);
  return {
    role: profile?.role || "user",
    avatarId: profile?.avatar_id || DEFAULT_AVATAR_ID,
  };
}

/**
 * Build the app-level `User` object from a validated Supabase user + its
 * profile. Centralized so every code path (refresh, listener, OAuth)
 * constructs it the same way — no drift, no privilege miscalculation.
 */
function mapAuthUser(user: SupabaseUser, role: string, avatarId: string): User {
  return {
    user_id: user.id,
    email: user.email || "",
    name: user.user_metadata?.full_name || user.user_metadata?.name || "Player",
    picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
    avatar_id: avatarId,
    is_admin: role === "super_admin" || role === "admin",
    role,
  };
}

// ── Session revalidation scheduling ──────────────────────────────────────────
// When getUser() fails transiently (network blip / timeout) we keep the locally
// cached session but never trust it indefinitely: a one-shot timer re-validates
// it. `validationEpoch` makes stale timers harmless — every refreshUser() and
// signOut() bumps the epoch, so a timer that fires after a logout or account
// switch becomes a no-op instead of validating the NEW user's session.
let revalidateTimer: ReturnType<typeof setTimeout> | null = null;
let validationEpoch = 0;

function clearRevalidation() {
  if (revalidateTimer) {
    clearTimeout(revalidateTimer);
    revalidateTimer = null;
  }
}

function scheduleRevalidation(delayMs = 30_000) {
  clearRevalidation();
  const epoch = validationEpoch;
  revalidateTimer = setTimeout(() => {
    revalidateTimer = null;
    if (epoch === validationEpoch) void refreshUser();
  }, delayMs);
}

export async function refreshUser() {
  validationEpoch++; // any newer call supersedes pending timers
  clearRevalidation();
  _loading = true; emit();
  initSupabaseListener(); // lazy init on first use

  try {
    const supabase = await getSupabase();

    // ── STEP 1: Optimistic restore from the persisted session (UI only) ──
    // getSession() reads from localStorage without hitting the server, so the
    // token has NOT been validated yet. We render it to avoid a flicker, then
    // immediately validate below.
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await fetchProfile(supabase, session.user.id);
      _user = mapAuthUser(session.user, profile.role, profile.avatarId);
      _loading = false; emit();
    }

    // ── STEP 2: Server-side validation — the REAL security check ──
    // getUser() sends the access token to Supabase Auth, which verifies the
    // JWT signature and expiry. Retry once first — a single failure can be a
    // transient network blip, which must not log the user out.
    let { data: { user: validatedUser }, error: authError } = await withTimeout(
      supabase.auth.getUser(), 8000
    );
    if (authError || !validatedUser) {
      ({ data: { user: validatedUser }, error: authError } = await withTimeout(
        supabase.auth.getUser(), 8000
      ));
    }

    if (authError || !validatedUser) {
      const status = (authError as { status?: number } | null)?.status;
      const isRejectedByServer = status === 401 || status === 403; // revoked / invalid token
      if (isRejectedByServer || !session?.user) {
        console.warn("getUser() validation failed — session is invalid, revoked, or expired:", authError);
        await supabase.auth.signOut();
        _user = null;
      } else {
        // Network/timeout/5xx while a local session exists: keep the
        // session-derived user TEMPORARILY (signing out here used to bounce
        // users who had JUST signed in straight back to /login) and
        // re-validate shortly — the session is never trusted indefinitely.
        console.warn("getUser() failed transiently — keeping session user, re-validating shortly:", authError);
        scheduleRevalidation();
      }
    } else {
      const profile = await fetchProfile(supabase, validatedUser.id);
      _user = mapAuthUser(validatedUser, profile.role, profile.avatarId);
    }
  } catch (err) {
    // withTimeout() throws on timeout — same transient-failure policy: keep an
    // existing session-derived user and re-validate, otherwise stay signed out.
    console.error("Supabase refreshUser error:", err);
    if (getUser()) scheduleRevalidation();
    else _user = null;
  }

  _loading = false; emit();
}

export let _supabaseInit = false;
export function initSupabaseListener() {
  if (_supabaseInit) return;
  _supabaseInit = true;
  getSupabase().then(supabase => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      _loading = true; emit();
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const user = session?.user;
          if (user) {
            const profile = await fetchProfile(supabase, user.id);
            _user = mapAuthUser(user, profile.role, profile.avatarId);
          }
        } else if (event === 'INITIAL_SESSION') {
          const user = session?.user;
          if (user) {
            const profile = await fetchProfile(supabase, user.id);
            _user = mapAuthUser(user, profile.role, profile.avatarId);
            supabase.auth.getUser().then(({ data: { user: validated }, error }) => {
              if (error || !validated) {
                console.warn("INITIAL_SESSION validation failed — signing out");
                void supabase.auth.signOut().then(() => { _user = null; emit(); });
              }
            });
          }
        } else if (event === 'SIGNED_OUT') {
          _user = null;
        }
      } catch (err) {
        console.error("onAuthStateChange error:", err);
      } finally {
        _loading = false;
        emit();
      }
    });
  }).catch(err => {
    console.error("Failed to setup Supabase auth state listener:", err);
    _loading = false; emit();
  });
}

// Lazy init happens via refreshUser() or useAuth() — never at module load

/**
 * Persists the selected mascot avatar to the user's own profile (Supabase)
 * and updates the in-memory store so every mounted component re-renders.
 */
export async function updateUserAvatar(avatarId: string) {
  await api.updateAvatar(avatarId);
  if (_user) {
    _user = { ..._user, avatar_id: avatarId };
    emit();
  }
}

/**
 * Sign in with Google.
 * Uses authService which checks Supabase → real backend → mock fallback.
 * Updates the auth store and notifies subscribers.
 */
export async function signInWithGoogle(role: "user" | "admin" | "client" = "user"): Promise<User> {
  _user = await authServiceGoogle(role);
  emit();
  return _user;
}

export async function requestOtp(phone: string) {
  await api.requestOtp(phone);
}

export async function signInWithOtp(phone: string, otp: string, name?: string) {
  _user = await api.verifyOtp({ phone, otp, name });
  emit();
}

export async function signInAdmin(email: string, password: string): Promise<User> {
  // Check if account is locked
  if (isLocked(email)) {
    const timeRemaining = getTimeUntilUnlocked(email);
    throw new Error(
      `Account locked. Try again in ${formatTimeRemaining(timeRemaining)}`
    );
  }

  try {
    _user = await api.adminPasswordSignIn(email, password);
    // Clear attempts on successful login
    clearAttempts(email);
    emit();
    return _user;
  } catch (error) {
    // Track failed attempt
    trackFailedAttempt(email);
    const remaining = getRemainingAttempts(email);

    if (remaining === 0) {
      const timeRemaining = getTimeUntilUnlocked(email);
      throw new Error(
        `Invalid password. Account locked for ${formatTimeRemaining(timeRemaining)}`
      );
    } else if (remaining === 1) {
      throw new Error(
        `Invalid password. 1 attempt remaining before lockout`
      );
    } else {
      throw new Error(
        `Invalid password. ${remaining} attempts remaining`
      );
    }
  }
}

/**
 * Remove any leftover auth artifacts from superseded/mock flows so that no
 * stale credentials survive a sign-out. Idempotent and safe to call anytime.
 */
function clearStaleAuthArtifacts() {
  try {
    localStorage.removeItem("client_token");
    localStorage.removeItem("client_id");
    localStorage.removeItem("access_token");
  } catch {
    /* localStorage may be unavailable (private mode) — ignore */
  }
}

export async function signOut() {
  validationEpoch++; // any pending revalidation timer must not fire for the next session
  clearRevalidation();
  await api.logout();
  clearStaleAuthArtifacts();
  clearSupabaseCache();
  _user = null;
  emit();
}

export async function signInUser(email: string, password: string): Promise<User> {
  // Check if account is locked
  if (isLocked(email)) {
    const timeRemaining = getTimeUntilUnlocked(email);
    throw new Error(
      `Account locked. Try again in ${formatTimeRemaining(timeRemaining)}`
    );
  }

  try {
    // First try admin login
    _user = await api.adminPasswordSignIn(email, password);
    // Clear attempts on successful login
    clearAttempts(email);
    emit();
    return _user;
  } catch (adminError) {
    // If admin login fails, try client login
    try {
      _user = await api.clientLogin(email, password);
      // Clear attempts on successful login
      clearAttempts(email);
      emit();
      return _user;
    } catch (clientError) {
      // Track failed attempt
      trackFailedAttempt(email);
      const remaining = getRemainingAttempts(email);

      if (remaining === 0) {
        const timeRemaining = getTimeUntilUnlocked(email);
        throw new Error(
          `Invalid credentials. Account locked for ${formatTimeRemaining(timeRemaining)}`
        );
      } else if (remaining === 1) {
        throw new Error(
          `Invalid credentials. 1 attempt remaining before lockout`
        );
      } else {
        throw new Error(
          `Invalid credentials. ${remaining} attempts remaining`
        );
      }
    }
  }
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Export attempt tracking functions for use in components
export { getRemainingAttempts, getTimeUntilUnlocked, resetLockout } from "@/lib/admin-attempt-tracker";
