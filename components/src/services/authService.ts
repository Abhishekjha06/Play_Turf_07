/**
 * Google Authentication Service
 *
 * Architecture: UI → authService → check Supabase → fall back to mock
 *
 * When Supabase is configured and @supabase/supabase-js is installed,
 * uncomment the Supabase OAuth blocks. Until then, all Google sign-ins
 * use the mock flow via api.mockGoogleSignIn().
 */

import { api, isMockMode } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { User } from "@/data/seed";

/**
 * Sign in with Google.
 *
 * 1. If Supabase is configured → use Supabase OAuth (`signInWithOAuth`)
 * 2. Else if real backend is wired → redirect to Emergent OAuth endpoint
 * 3. Else (mock mode) → use api.mockGoogleSignIn()
 */
export async function signInWithGoogle(role: "user" | "admin" | "client" = "user"): Promise<User> {
    // ── Try Supabase OAuth first ──────────────────────────────────────
    const supabase = await getSupabase();
    if (supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            data: {
              role: role,
            }
          },
        });
        if (error) throw new Error(error.message);
        // OAuth redirect happens here — this line won't be reached
        // The AuthCallback component will handle the session after redirect
        return new Promise<User>(() => {});
    }

    // ── Real backend (Emergent OAuth) ─────────────────────────────────
    if (!isMockMode) {
        const redirectURL = `${window.location.origin}/auth/callback`;
        window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirectURL)}`;
        // Redirecting — return a never-resolving promise so callers can await safely
        return new Promise<User>(() => { });
    }

    // ── Mock mode ─────────────────────────────────────────────────────
    const user = await api.mockGoogleSignIn(role);
    return user;
}

/**
 * Check whether Google login is available.
 * In mock mode it's always available; in production it depends on
 * either Supabase or the backend OAuth endpoint being configured.
 */
export function isGoogleLoginAvailable(): boolean {
    return true; // Always available — mock handles the fallback
}
