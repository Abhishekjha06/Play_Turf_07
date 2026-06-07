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
            // Let's create profile if it's a first time OAuth login
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("id", data.session.user.id)
              .single();

            if (!profile) {
              const fullName = data.session.user.user_metadata?.full_name || "User";
              const phone = data.session.user.user_metadata?.phone || "0000000000";

              await supabase.from("profiles").insert({
                id: data.session.user.id,
                full_name: fullName,
                phone: phone,
              });
            }
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
      } finally {
        navigate("/", { replace: true });
      }
    };
    
    processAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
