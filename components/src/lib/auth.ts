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
import { getSupabase, withTimeout } from "@/lib/supabase";

// minimal store using plain event emitter pattern
type Listener = () => void;
let _user: User | null = null;
let _loading = true;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export function getUser() { return _user; }
export function isLoading() { return _loading; }

export async function refreshUser() {
  _loading = true; emit();

  try {
    const supabase = await getSupabase();
    if (supabase) {
      // 1. Try getSession() FIRST — reads from localStorage instantly, no network call.
      //    This is the fastest way to recover a persisted session on page refresh.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const user = session.user;
        const { data: profile, error: profileErr } = await withTimeout(
          supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle(),
          8000
        );
        if (profileErr) console.warn("Profile fetch error (session fallback):", profileErr);

        const userRole = profile?.role || "user";

        _user = {
          user_id: user.id,
          email: user.email || "",
          name: user.user_metadata?.full_name || user.user_metadata?.name || "Player",
          picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
          is_admin: userRole === "super_admin" || userRole === "admin" || false,
          role: userRole,
        };
        _loading = false; emit();
        return;
      }

      // 2. No session in localStorage — validate with server via getUser()
      try {
        const { data: { user }, error: authError } = await withTimeout(supabase.auth.getUser(), 8000);
        if (authError) throw authError;

        if (user) {
          const { data: profile, error: profileErr } = await withTimeout(
            supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle(),
            8000
          );
          if (profileErr) console.warn("Profile fetch error (getUser):", profileErr);

          const userRole = profile?.role || "user";

          _user = {
            user_id: user.id,
            email: user.email || "",
            name: user.user_metadata?.full_name || user.user_metadata?.name || "Player",
            picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
            is_admin: userRole === "super_admin" || userRole === "admin" || false,
            role: userRole,
          };
          _loading = false; emit();
          return;
        }
      } catch (e) {
        console.warn("getUser() failed (no session persisted):", e);
      }
    }
  } catch (err) {
    console.error("Supabase refreshUser error:", err);
  }

  _user = null;
  _loading = false; emit();
}

// Setup Supabase auth state listener
getSupabase().then(supabase => {
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      _loading = true; emit();
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          const user = session?.user;
          if (user) {
            const { data: profile, error: profileErr } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle();
            if (profileErr) console.warn("Profile fetch error (onAuthStateChange):", profileErr);

            const userRole = profile?.role || "user";

            _user = {
              user_id: user.id,
              email: user.email || "",
              name: user.user_metadata?.full_name || user.user_metadata?.name || "Player",
              picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
              is_admin: userRole === "super_admin" || userRole === "admin" || false,
              role: userRole,
            };
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
  }
}).catch(err => {
  console.error("Failed to setup Supabase auth state listener:", err);
});

export function updateUserAvatar(avatarUrl: string) {
  if (_user) {
    _user = { ..._user, picture: avatarUrl };
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

export async function signOut() {
  await api.logout();
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
