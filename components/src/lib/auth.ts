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

  let restoredUser: User | null = null;

  try {
    const supabase = await getSupabase();
    if (!supabase) {
      _user = null; _loading = false; emit(); return;
    }

    // ── STEP 1: Fast restore from localStorage (UI only, NOT validated) ──
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const user = session.user;
      const { data: profile, error: profileErr } = await withTimeout(
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        8000
      );
      if (profileErr) console.warn("Profile fetch (session restore):", profileErr);

      const userRole = profile?.role || "user";
      restoredUser = {
        user_id: user.id,
        email: user.email || "",
        name: user.user_metadata?.full_name || user.user_metadata?.name || "Player",
        picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
        is_admin: userRole === "super_admin" || userRole === "admin" || false,
        role: userRole,
      };
      // Show user immediately so UI doesn't flicker
      _user = restoredUser;
      _loading = false; emit();
    }

    // ── STEP 2: Server validation — this is the REAL security check ──
    try {
      const { data: { user: validatedUser }, error: authError } = await withTimeout(
        supabase.auth.getUser(), 8000
      );
      if (authError) throw authError;

      if (validatedUser) {
        // Token is valid on the server — user is legit
        const { data: profile, error: profileErr } = await withTimeout(
          supabase.from("profiles").select("role").eq("id", validatedUser.id).maybeSingle(),
          8000
        );
        if (profileErr) console.warn("Profile fetch (getUser):", profileErr);

        const userRole = profile?.role || "user";
        _user = {
          user_id: validatedUser.id,
          email: validatedUser.email || "",
          name: validatedUser.user_metadata?.full_name || validatedUser.user_metadata?.name || "Player",
          picture: validatedUser.user_metadata?.avatar_url || validatedUser.user_metadata?.picture || "",
          is_admin: userRole === "super_admin" || userRole === "admin" || false,
          role: userRole,
        };
        sessionValid = true;
      } else {
        // getUser() returned no user — token is invalid/revoked
        throw new Error("Token validation failed");
      }
    } catch (validationErr) {
      console.warn("getUser() validation failed — session may be revoked or expired:", validationErr);
      // If we restored from getSession() but getUser() failed, the session is INVALID.
      // Clear it so the user isn't falsely shown as authenticated.
      await supabase.auth.signOut();
      _user = null;
    }
  } catch (err) {
    console.error("Supabase refreshUser error:", err);
    _user = null;
  }

  _loading = false; emit();
}

// Setup Supabase auth state listener
getSupabase().then(supabase => {
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      _loading = true; emit();
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
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
        } else if (event === 'INITIAL_SESSION') {
          // INITIAL_SESSION comes from localStorage (unvalidated).
          // Show user immediately, then validate with getUser() in background.
          const user = session?.user;
          if (user) {
            const { data: profile, error: profileErr } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle();
            if (profileErr) console.warn("Profile fetch (INITIAL_SESSION):", profileErr);

            const userRole = profile?.role || "user";

            _user = {
              user_id: user.id,
              email: user.email || "",
              name: user.user_metadata?.full_name || user.user_metadata?.name || "Player",
              picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
              is_admin: userRole === "super_admin" || userRole === "admin" || false,
              role: userRole,
            };

            // Validate in background — if token is invalid, log out
            supabase.auth.getUser().then(({ data: { user: validated }, error }) => {
              if (error || !validated) {
                console.warn("INITIAL_SESSION validation failed — logging out");
                supabase.auth.signOut().then(() => {
                  _user = null; emit();
                });
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
