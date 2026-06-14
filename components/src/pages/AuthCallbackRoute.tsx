import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";

export default function AuthCallbackRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    const processAuth = async () => {
      try {
        const supabase = await getSupabase();
        if (supabase) {
          const { data, error } = await supabase.auth.getSession();
          if (data.session) {
            // Fetch profile and check role
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", data.session.user.id)
              .single();

            if (profile?.role === "super_admin") {
              navigate("/admin", { replace: true });
              return;
            }
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
      }
      navigate("/", { replace: true });
    };
    
    processAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
