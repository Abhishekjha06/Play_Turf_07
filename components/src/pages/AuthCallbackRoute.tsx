import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase, withTimeout } from "@/lib/supabase";
import { refreshUser } from "@/lib/auth";

export default function AuthCallbackRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    const processAuth = async () => {
      let redirectUrl = "/";
      try {
        const supabase = await getSupabase();
        if (supabase) {
          // 1. If Supabase returned an auth code in the URL, exchange it first.
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
          }

          // 2. Refresh local auth store so every subscriber sees the user
          await refreshUser();

          const { data, error } = await withTimeout(supabase.auth.getSession());
          if (data.session) {
            // Fetch profile and check role
            const { data: profile } = await withTimeout(
              supabase
                .from("profiles")
                .select("role")
                .eq("id", data.session.user.id)
                .single()
            );

            if (profile?.role === "super_admin") {
              redirectUrl = "/admin";
            } else {
              const savedRedirect = localStorage.getItem("play_turf_post_login_redirect");
              if (savedRedirect) {
                redirectUrl = savedRedirect;
                localStorage.removeItem("play_turf_post_login_redirect");
              }
            }
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
      }
      navigate(redirectUrl, { replace: true });
    };
    
    processAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
