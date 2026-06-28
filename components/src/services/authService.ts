import { getSupabase } from "@/lib/supabase";
import type { User } from "@/data/seed";

export async function signInWithGoogle(role: "user" | "admin" | "client" = "user"): Promise<User> {
    const supabase = await getSupabase();
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
    return new Promise<User>(() => {});
}

export function isGoogleLoginAvailable(): boolean {
    return true;
}
