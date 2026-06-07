import { Link, useNavigate } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { AppHeader } from "@/layout/AppHeader";
import { BottomNav } from "@/layout/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { signOut, signInWithGoogle } from "@/lib/auth";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import {
  LogOut,
  Bell,
  FileText,
  ChevronRight,
  UserCircle2,
  Lock,
  Shield,
  Briefcase,
  Zap,
  RefreshCw,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const More = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  const menuItems = [
    { label: "App Appearance", icon: Palette, to: "/theme", toast: "" },
    { label: "Notifications", icon: Bell, to: "", toast: "Notifications coming soon!" },
    { label: "Terms of Service", icon: FileText, to: "", toast: "Terms of Service coming soon!" },
  ];

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
  };

  const handleQuickLogin = async (role: "admin" | "client") => {
    setSwitching(true);
    try {
      await signInWithGoogle(role);
      toast.success(`Signed in as ${role === "admin" ? "Admin" : "Client"}`);
    } catch {
      toast.error("Sign-in failed");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <MobileShell>
      <AppHeader />

      {/* ── Profile card ─────────────────────────────────────────── */}
      <section className="px-4 mt-4">
        <div className="card-panel rounded-3xl p-4 flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-gradient-neon text-primary-foreground grid place-items-center font-bold text-xl">
            {user ? (
              (user.name[0] ?? "U").toUpperCase()
            ) : (
              <UserCircle2 className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{user?.name ?? "Guest"}</p>
            <p className="text-xs text-muted2 truncate">
              {user?.email ?? "Sign in to start booking"}
            </p>
          </div>
          {!user && (
            <Link
              to="/login"
              className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-xs font-semibold shadow-neon"
            >
              Sign in
            </Link>
          )}
        </div>
      </section>

      {/* ── Menu links ───────────────────────────────────────────── */}
      <section className="px-4 mt-5 flex flex-col gap-2">
        {menuItems.map((it) => (
          <button
            key={it.label}
            onClick={() => it.to ? navigate(it.to) : toast.info(it.toast)}
            className="card-panel rounded-2xl px-4 py-3 flex items-center gap-3 pressable text-left w-full"
          >
            <div className="h-9 w-9 rounded-full bg-panel-3 grid place-items-center">
              <it.icon className="h-4 w-4 text-primary" />
            </div>
            <span className="flex-1 text-sm">{it.label}</span>
            <ChevronRight className="h-4 w-4 text-muted2" />
          </button>
        ))}

        {/* Google login (for guests) */}
        {!user && (
          <div className="mt-2">
            <GoogleLoginButton variant="outline" />
          </div>
        )}

        {/* Quick-login buttons for testing (guests only) */}
        {!user && (
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => handleQuickLogin("admin")}
              disabled={switching}
              className="flex-1 card-panel rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2 pressable text-xs font-semibold disabled:opacity-50"
            >
              <Shield className="h-3.5 w-3.5 text-primary" />
              {switching ? "…" : "Sign in as Admin"}
            </button>
            <button
              onClick={() => handleQuickLogin("client")}
              disabled={switching}
              className="flex-1 card-panel rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2 pressable text-xs font-semibold disabled:opacity-50"
            >
              <Briefcase className="h-3.5 w-3.5 text-accent" />
              {switching ? "…" : "Sign in as Client"}
            </button>
          </div>
        )}

        {/* Login link (for guests — email/admin login) */}
        {!user && (
          <Link
            to="/login"
            className="card-panel rounded-2xl px-4 py-3 flex items-center gap-3 pressable"
          >
            <div className="h-9 w-9 rounded-full bg-panel-3 grid place-items-center">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <span className="flex-1 text-sm font-semibold">Login with Email</span>
            <ChevronRight className="h-4 w-4 text-muted2" />
          </Link>
        )}

        {/* Admin Panel & Client Panel (for logged-in users) */}
        {user && (
          <>
            <Link
              to="/admin"
              className="card-panel rounded-2xl px-4 py-3 flex items-center gap-3 pressable"
            >
              <div className="h-9 w-9 rounded-full bg-primary/15 grid place-items-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <span className="flex-1 text-sm font-semibold">Admin Panel</span>
              <ChevronRight className="h-4 w-4 text-muted2" />
            </Link>

            <Link
              to="/client/dashboard"
              className="card-panel rounded-2xl px-4 py-3 flex items-center gap-3 pressable"
            >
              <div className="h-9 w-9 rounded-full bg-accent/15 grid place-items-center">
                <Briefcase className="h-4 w-4 text-accent" />
              </div>
              <span className="flex-1 text-sm font-semibold">Client Panel</span>
              <ChevronRight className="h-4 w-4 text-muted2" />
            </Link>

            {/* Role switcher (for testing — switch between roles without logging out) */}
            {user.role !== "admin" && (
              <button
                onClick={() => handleQuickLogin("admin")}
                disabled={switching}
                className="card-panel rounded-2xl px-4 py-3 flex items-center gap-3 pressable text-left disabled:opacity-50"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center">
                  <RefreshCw className="h-4 w-4 text-primary" />
                </div>
                <span className="flex-1 text-sm">Switch to Admin</span>
                <Zap className="h-3.5 w-3.5 text-primary" />
              </button>
            )}
            {user.role !== "client" && (
              <button
                onClick={() => handleQuickLogin("client")}
                disabled={switching}
                className="card-panel rounded-2xl px-4 py-3 flex items-center gap-3 pressable text-left disabled:opacity-50"
              >
                <div className="h-9 w-9 rounded-full bg-accent/10 grid place-items-center">
                  <RefreshCw className="h-4 w-4 text-accent" />
                </div>
                <span className="flex-1 text-sm">Switch to Client</span>
                <Zap className="h-3.5 w-3.5 text-accent" />
              </button>
            )}
          </>
        )}

        {/* Sign out (for logged-in users) */}
        {user && (
          <button
            onClick={handleSignOut}
            className="card-panel rounded-2xl px-4 py-3 flex items-center gap-3 pressable text-left"
            data-testid="logout-btn"
          >
            <div className="h-9 w-9 rounded-full bg-destructive/15 grid place-items-center">
              <LogOut className="h-4 w-4 text-destructive" />
            </div>
            <span className="flex-1 text-sm">Log out</span>
          </button>
        )}
      </section>

      <div className="h-6" />
      <BottomNav />
    </MobileShell>
  );
};

export default More;
