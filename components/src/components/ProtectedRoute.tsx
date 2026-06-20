import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = await getSupabase();
        if (!supabase) {
          // If Supabase is not configured, we might fallback to mock, but in this
          // plan we expect Supabase to be used strictly. So we block access.
          toast.error("Supabase not configured");
          navigate("/login", { state: { from: location.pathname + location.search } });
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          navigate("/login", { state: { from: location.pathname + location.search } });
        } else {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error(err);
        navigate("/login", { state: { from: location.pathname + location.search } });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, location.pathname, location.search]);

  if (loading) {
    return (
      <MobileShell>
        <div className="px-5 pt-6 relative z-10"><BackButton /></div>
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </MobileShell>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
};
