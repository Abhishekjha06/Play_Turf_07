import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

/**
 * Intercepts URL fragments containing `#session_id=...` (Emergent OAuth flow),
 * exchanges them for a session cookie, then strips the fragment.
 */
export function AuthCallback({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("session_id=")) return;
    const m = hash.match(/session_id=([^&]+)/);
    const sid = m?.[1];
    if (!sid) return;
    (async () => {
      try {
        await api.exchangeSession(sid);
        // strip hash without reload
        history.replaceState(null, "", window.location.pathname + window.location.search);
        navigate("/", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  return <>{children}</>;
}
