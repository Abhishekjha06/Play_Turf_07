import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/lib/supabase";
import { getAalStatus, listFactors } from "@/admin/admin-mfa";
import { isAdminRole } from "@/admin/admin-rbac";

interface AdminRouteProps {
    children: ReactNode;
}

/**
 * Admin access guard.
 *
 * Layers (in order):
 *  1. Authenticated session (Supabase getUser — validated JWT via useAuth).
 *  2. Server-derived role from profiles (useAuth.me reads the DB role; the
 *     login path additionally signs non-admins out server-side).
 *  3. Suspended administrator check (profiles.is_suspended — migration).
 *  4. MFA step-up: when TOTP factors are enrolled, the session must be AAL2.
 *
 * The RLS policies in supabase_admin_rbac.sql remain the real boundary.
 */
export function AdminRoute({ children }: AdminRouteProps) {
    const { user, loading } = useAuth();
    const location = useLocation();
    const [suspended, setSuspended] = useState(false);
    const [mfaMissing, setMfaMissing] = useState(false);
    const [checksDone, setChecksDone] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!user || !isAdminRole(user.role)) {
                setChecksDone(true);
                return;
            }
            const supabase = await getSupabase();
            // Suspension flag — column exists only after the RBAC migration.
            try {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("is_suspended")
                    .eq("id", user.user_id)
                    .maybeSingle();
                if (!cancelled) setSuspended(!!profile?.is_suspended);
            } catch {
                if (!cancelled) setSuspended(false); // migration not run yet
            }
            // MFA: enforce only when the admin has enrolled a factor.
            try {
                const factors = await listFactors();
                if (factors.some((f) => f.status === "verified")) {
                    const aal = await getAalStatus();
                    if (!cancelled) setMfaMissing(aal.current !== "aal2");
                }
            } catch {
                if (!cancelled) setMfaMissing(false);
            }
            if (!cancelled) setChecksDone(true);
        })();
        return () => { cancelled = true; };
    }, [user]);

    if (loading || (user && isAdminRole(user.role) && !checksDone)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!user) {
        return (
            <Navigate
                to={`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`}
                replace
            />
        );
    }

    if (!isAdminRole(user.role)) {
        return (
            <div className="admin-root min-h-screen grid place-items-center bg-[#070808] p-6">
                <div className="text-center">
                    <h1 className="text-xl font-black text-white">Access denied</h1>
                    <p className="mt-2 max-w-sm text-sm text-zinc-400">
                        This account does not hold an administrator role. If you believe this is wrong,
                        contact a Super Admin — roles can only be granted by another Super Admin.
                    </p>
                    <a href="/" className="mt-6 inline-block rounded-xl bg-teal-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#04110e]">
                        Back to PlayTurf
                    </a>
                </div>
            </div>
        );
    }

    if (suspended) {
        return (
            <div className="admin-root min-h-screen grid place-items-center bg-[#070808] p-6">
                <div className="text-center">
                    <h1 className="text-xl font-black text-white">Administrator account suspended</h1>
                    <p className="mt-2 max-w-sm text-sm text-zinc-400">
                        This administrator account has been suspended. Contact a Super Admin.
                    </p>
                </div>
            </div>
        );
    }

    if (mfaMissing) {
        return (
            <div className="admin-root min-h-screen grid place-items-center bg-[#070808] p-6">
                <div className="max-w-sm text-center">
                    <h1 className="text-xl font-black text-white">Two-factor verification required</h1>
                    <p className="mt-2 text-sm text-zinc-400">
                        Your account has an authenticator enrolled, but this session is not MFA-verified.
                        Sign in again through <b className="text-teal-300">/admin/login</b> and complete the code challenge.
                    </p>
                    <a href="/admin/login" className="mt-6 inline-block rounded-xl bg-teal-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#04110e]">
                        Go to secure sign-in
                    </a>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
