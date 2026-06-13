import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, User, Landmark, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { toast } from "sonner";

export const MultiRoleLoginModal: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      setIsOpen(false);
      return;
    }

    // Role is one of super_admin, admin, client
    const isPrivileged = ["super_admin", "admin", "client"].includes(user.role);
    const selectedMode = sessionStorage.getItem("selected_mode");

    // Show popup if they are privileged and haven't selected a mode yet
    // Exclude login and signup pages from blocking if they are signing out, but normally we force it
    const onAuthPages = ["/login", "/signup"].includes(location.pathname);
    
    if (isPrivileged && !selectedMode && !onAuthPages) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [user, loading, location.pathname]);

  if (!isOpen || !user) return null;

  const handleSelectMode = (mode: "super_admin" | "admin" | "client" | "user", redirectPath: string) => {
    sessionStorage.setItem("selected_mode", mode);
    setIsOpen(false);
    toast.success(`Continuing as ${mode.replace("_", " ")}`);
    navigate(redirectPath);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      sessionStorage.removeItem("selected_mode");
      setIsOpen(false);
      navigate("/login");
      toast.success("Signed out successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to sign out");
    }
  };

  // Define options based on user role
  const getOptions = () => {
    switch (user.role) {
      case "super_admin":
        return [
          {
            mode: "super_admin" as const,
            label: "Continue as Super Admin",
            icon: Shield,
            path: "/admin",
            color: "from-red-500/25 to-orange-500/25 border-red-500/40 hover:border-red-500/80 shadow-red-500/10",
          },
          {
            mode: "admin" as const,
            label: "Continue as Admin",
            icon: Shield,
            path: "/admin",
            color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 hover:border-blue-500/70 shadow-blue-500/10",
          },
          {
            mode: "user" as const,
            label: "Continue as User",
            icon: User,
            path: "/",
            color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 hover:border-emerald-500/70 shadow-emerald-500/10",
          },
        ];
      case "admin":
        return [
          {
            mode: "admin" as const,
            label: "Continue as Admin",
            icon: Shield,
            path: "/admin",
            color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 hover:border-blue-500/70 shadow-blue-500/10",
          },
          {
            mode: "user" as const,
            label: "Continue as User",
            icon: User,
            path: "/",
            color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 hover:border-emerald-500/70 shadow-emerald-500/10",
          },
        ];
      case "client":
        return [
          {
            mode: "client" as const,
            label: "Continue as Client",
            icon: Landmark,
            path: "/client/dashboard",
            color: "from-purple-500/20 to-pink-500/20 border-purple-500/30 hover:border-purple-500/70 shadow-purple-500/10",
          },
          {
            mode: "user" as const,
            label: "Continue as User",
            icon: User,
            path: "/",
            color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 hover:border-emerald-500/70 shadow-emerald-500/10",
          },
        ];
      default:
        return [];
    }
  };

  const options = getOptions();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-panel-2/95 p-6 shadow-2xl backdrop-blur-xl"
        >
          {/* Neon accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-cyan-400 to-indigo-500" />

          <div className="text-center">
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              Welcome Back
            </h2>
            <p className="mt-1 text-sm text-soft">
              Logged in as: <span className="font-semibold text-foreground">{user.email}</span>
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-center text-xs uppercase tracking-wider text-soft/70">
              Select how you want to continue:
            </p>

            {options.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.mode}
                  onClick={() => handleSelectMode(opt.mode, opt.path)}
                  className={`w-full flex items-center justify-between rounded-2xl border bg-gradient-to-r p-4 text-left transition-all duration-300 hover:shadow-lg group ${opt.color}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-foreground transition-colors group-hover:bg-white/10">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-sm font-semibold text-foreground">
                        {opt.label}
                      </span>
                      <span className="text-xs text-soft">
                        Access {opt.mode === "user" ? "customer booking portal" : "management dashboard"}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-white/20 transition-all duration-300 group-hover:bg-primary group-hover:scale-125" />
                </button>
              );
            })}
          </div>

          {/* Logout Action */}
          <div className="mt-6 flex justify-center border-t border-white/5 pt-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-semibold text-destructive hover:text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign in with another account
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
