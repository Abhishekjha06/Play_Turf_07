/**
 * Client (turf owner) panel shell — same design language as the admin
 * control center, client-scoped navigation. Reuses the .admin-root visual
 * scope for a consistent premium dark/light experience.
 */
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import * as Lucide from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

const NAV = [
  { label: "Overview", path: "/client", icon: Lucide.LayoutDashboard },
  { label: "My Facilities", path: "/client/facilities", icon: Lucide.MapPin },
  { label: "Bookings", path: "/client/bookings", icon: Lucide.CalendarCheck },
  { label: "Slot Management", path: "/client/slots", icon: Lucide.Ban },
  { label: "Pricing", path: "/client/pricing", icon: Lucide.IndianRupee },
  { label: "Revenue", path: "/client/revenue", icon: Lucide.TrendingUp },
  { label: "Profile & Settings", path: "/client/settings", icon: Lucide.Settings },
];

export function ClientLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("playturf:client-sidebar") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("playturf:client-sidebar", collapsed ? "1" : "0");
  }, [collapsed]);

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/client/login");
  };

  return (
    <div className="admin-root min-h-dvh">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-[#070808] transition-[width,transform] duration-200 ${
          collapsed ? "w-[68px]" : "w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className={`flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-4 ${collapsed ? "justify-center px-0" : ""}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
            <Lucide.Building2 className="h-5 w-5" />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight text-white">Venue Panel</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400/80">PlayTurf Partner</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
          {NAV.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/client"}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                  collapsed ? "justify-center px-0" : ""
                } ${
                  isActive
                    ? "bg-teal-400/10 text-teal-200 ring-1 ring-teal-400/25"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden h-11 items-center justify-center gap-2 border-t border-white/[0.06] text-[11px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-200 lg:flex"
        >
          {collapsed ? <Lucide.ChevronRight className="h-4 w-4" /> : <Lucide.ChevronLeft className="h-4 w-4" />}
          {!collapsed && "Collapse"}
        </button>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className={`flex min-h-dvh flex-col transition-[padding] duration-200 ${collapsed ? "lg:pl-[68px]" : "lg:pl-60"}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-[#070808]/95 px-4 backdrop-blur">
          <button
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-300 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Lucide.Menu className="h-4 w-4" />
          </button>
          <p className="text-xs font-bold text-zinc-500">Venue Panel</p>
          <div className="ml-auto flex items-center gap-2">
            <a href="/" className="rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-zinc-300 hover:bg-white/5">
              View site
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-rose-300 hover:bg-rose-400/10"
            >
              <Lucide.LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>

        <footer className="border-t border-white/[0.06] px-6 py-3 text-center text-[10px] text-zinc-600">
          PlayTurf Venue Panel · {user?.name || "Partner"} · data scoped to your facilities
        </footer>
      </div>
    </div>
  );
}
