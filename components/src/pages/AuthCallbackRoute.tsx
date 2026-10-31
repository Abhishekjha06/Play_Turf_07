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
        const code = new URLSearchParams(window.location.search).get("code");

        // The client consumes the ?code= itself (detectSessionInUrl: true).
        // Await its own session recovery first: getSession() resolves after
        // client initialization, and we give an in-flight URL exchange a brief
        // grace period before considering a manual exchange.
        let session = (await supabase.auth.getSession()).data.session;
        if (!session && code) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          session = (await supabase.auth.getSession()).data.session;
        }

        // Manual exchange only as a fallback, isolated in its own try/catch so
        // an already-consumed code can't abort the rest of the callback.
        if (!session && code) {
          try {
            await supabase.auth.exchangeCodeForSession(code);
          } catch (exchangeErr) {
            console.warn("Manual code exchange failed (likely already consumed):", exchangeErr);
          }
        }

        // Refresh local auth store so every subscriber sees the user
        await refreshUser();

        const { data } = await withTimeout(supabase.auth.getSession());
        if (data.session) {
          // Fetch profile and check role
          const { data: profile } = await withTimeout(
            supabase
              .from("profiles")
              .select("role")
              .eq("id", data.session.user.id)
              .maybeSingle()
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
