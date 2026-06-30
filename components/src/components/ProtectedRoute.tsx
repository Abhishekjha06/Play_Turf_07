import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { state: { from: location.pathname + location.search } });
    }
  }, [loading, user, navigate, location.pathname, location.search]);

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

  return user ? <>{children}</> : null;
};
