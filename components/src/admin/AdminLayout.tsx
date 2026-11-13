/**
 * Admin shell — AMOLED dark sidebar layout with a light variant.
 * Scope class .admin-root isolates the palette from the customer app themes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import * as Lucide from "lucide-react";
import { toast } from "sonner";
import { ADMIN_NAV, hasPermission, ROLE_LABELS, type AdminRole } from "./admin-rbac";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import type { AppNotification } from "@/lib/notifications";
import { listProfiles } from "./admin-api";
import { fetchTurfsAdmin } from "./admin-api";

/** Bridge from the auth context to the layout — used by the /admin route. */
export function AdminShell() {
  const { user } = useAuth();
  return (
    <AdminLayout role={(user?.role || "admin") as AdminRole} adminName={user?.name || "Admin"} />
  );
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard: Lucide.LayoutDashboard,
  Users: Lucide.Users,
  MapPin: Lucide.MapPin,
  CalendarCheck: Lucide.CalendarCheck,
  Volleyball: Lucide.Volleyball,
  IndianRupee: Lucide.IndianRupee,
  Search: Lucide.Search,
  Newspaper: Lucide.Newspaper,
  Trophy: Lucide.Trophy,
  Tag: Lucide.Tag,
  LifeBuoy: Lucide.LifeBuoy,
  BarChart3: Lucide.BarChart3,
  ShieldCheck: Lucide.ShieldCheck,
  Settings: Lucide.Settings,
};

type SearchResult = { type: "User" | "Venue" | "Booking"; label: string; sub: string; path: string };

export function AdminLayout({ role, adminName }: { role: AdminRole; adminName: string }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("playturf:admin-sidebar") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [light, setLight] = useState(() => localStorage.getItem("playturf:admin-light") === "1");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("playturf:admin-sidebar", collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => {
    localStorage.setItem("playturf:admin-light", light ? "1" : "0");
  }, [light]);

  useEffect(() => {
    setNotifs(getNotifications().slice(0, 8));
  }, []);

  // Global search — real lookups across users, venues and booking ids.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const s = query.trim();
        const [profiles, turfs] = await Promise.all([
          listProfiles({ search: s, pageSize: 4 }).catch(() => ({ rows: [], total: 0 })),
          fetchTurfsAdmin().catch(() => ({ rows: [], missingSchema: false })),
        ]);
        const out: SearchResult[] = [
          ...profiles.rows.map((p) => ({
            type: "User" as const, label: p.full_name || p.id, sub: p.phone || p.role, path: `/admin/users?q=${encodeURIComponent(s)}`,
          })),
          ...turfs.rows
            .filter((t) => t.name.toLowerCase().includes(s.toLowerCase()) || (t.city || "").toLowerCase().includes(s.toLowerCase()))
            .slice(0, 4)
            .map((t) => ({ type: "Venue" as const, label: t.name, sub: t.city, path: `/admin/venues?q=${encodeURIComponent(s)}` })),
          ...(/^\w{3,}-\w+$|^bkg/i.test(s) ? [{ type: "Booking" as const, label: s, sub: "Booking ID", path: `/admin/bookings?q=${encodeURIComponent(s)}` }] : []),
        ];
        setResults(out);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setResults([]);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const nav = useMemo(() => ADMIN_NAV.filter((n) => hasPermission(role, n.permission)), [role]);

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out of the admin panel");
    navigate("/admin/login");
  };

  return (
    <div className={`admin-root min-h-dvh ${light ? "admin-light" : ""}`}>
      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-[#070808] transition-[width,transform] duration-200 ${
          collapsed ? "w-[68px]" : "w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className={`flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-4 ${collapsed ? "justify-center px-0" : ""}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
            <Lucide.Zap className="h-5 w-5" />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight text-white">PlayTurf Admin</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400/80">Control Center</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
          {nav.map((item) => {
            const Icon = ICONS[item.icon] || Lucide.Circle;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/admin"}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
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
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden h-11 items-center justify-center gap-2 border-t border-white/[0.06] text-[11px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-200 lg:flex"
        >
          {collapsed ? <Lucide.ChevronRight className="h-4 w-4" /> : <Lucide.ChevronLeft className="h-4 w-4" />}
          {!collapsed && "Collapse"}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Main column ── */}
      <div className={`flex min-h-dvh flex-col transition-[padding] duration-200 ${collapsed ? "lg:pl-[68px]" : "lg:pl-60"}`}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-[#070808]/95 px-4 backdrop-blur">
          <button
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-300 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin menu"
          >
            <Lucide.Menu className="h-4 w-4" />
          </button>

          {/* Global search */}
          <div ref={searchRef} className="relative w-full max-w-md">
            <Lucide.Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users, venues, booking IDs…"
              className="h-9 w-full rounded-xl border border-white/10 bg-[#0a0c0b] pl-9 pr-8 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-teal-400/40"
            />
            {searching && <Lucide.Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-zinc-500" />}
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-11 overflow-hidden rounded-xl border border-white/10 bg-[#0d0f0e] shadow-2xl">
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${i}`}
                    onClick={() => { navigate(r.path); setQuery(""); setResults([]); }}
                    className="flex w-full items-center gap-3 border-b border-white/[0.04] px-3.5 py-2.5 text-left last:border-0 hover:bg-white/[0.04]"
                  >
                    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-teal-300">{r.type}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-zinc-100">{r.label}</span>
                      <span className="block truncate text-[10px] text-zinc-500">{r.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Theme */}
            <button
              onClick={() => setLight((l) => !l)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5"
              title={light ? "Switch to AMOLED dark" : "Switch to light"}
            >
              {light ? <Lucide.Moon className="h-4 w-4" /> : <Lucide.Sun className="h-4 w-4" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5"
                aria-label="Notifications"
              >
                <Lucide.Bell className="h-4 w-4" />
                {notifs.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-teal-500 px-1 text-[9px] font-black text-[#04110e]">
                    {notifs.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#0d0f0e] shadow-2xl">
                  <p className="border-b border-white/[0.06] px-3.5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                    Notifications
                  </p>
                  {notifs.length === 0 && <p className="px-3.5 py-6 text-center text-xs text-zinc-500">Nothing new.</p>}
                  {notifs.map((n) => (
                    <div key={n.id} className="border-b border-white/[0.04] px-3.5 py-2.5 last:border-0">
                      <p className="text-xs font-bold text-zinc-100">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">{n.body}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 py-1.5 pl-1.5 pr-3 hover:bg-white/5"
              >
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-teal-500/15 text-[11px] font-black text-teal-300 ring-1 ring-teal-400/25">
                  {(adminName[0] || "A").toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-[11px] font-bold leading-tight text-zinc-100">{adminName}</span>
                  <span className="block text-[9px] font-bold uppercase tracking-wider leading-tight text-teal-400/80">
                    {ROLE_LABELS[role]}
                  </span>
                </span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-11 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#0d0f0e] py-1 shadow-2xl">
                  <p className="px-3.5 py-2 text-[10px] text-zinc-500">Signed in as <b className="text-zinc-300">{adminName}</b></p>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-bold text-rose-300 hover:bg-rose-400/10"
                  >
                    <Lucide.LogOut className="h-3.5 w-3.5" /> Secure logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>

        <footer className="border-t border-white/[0.06] px-6 py-3 text-center text-[10px] text-zinc-600">
          PlayTurf Control Center · {ROLE_LABELS[role]} session · actions are recorded in the audit log
        </footer>
      </div>
    </div>
  );
}

/** Guard wrapper — render children only when the role holds the permission. */
export function PermissionGuard({
  role, permission, children,
}: { role: AdminRole; permission: Parameters<typeof hasPermission>[1]; children: React.ReactNode }) {
  if (!hasPermission(role, permission)) {
    return (
      <div className="grid place-items-center rounded-2xl border border-rose-400/20 bg-rose-400/[0.04] p-12 text-center">
        <Lucide.ShieldAlert className="mb-3 h-8 w-8 text-rose-400" />
        <h3 className="text-sm font-black text-white">Permission required</h3>
        <p className="mt-1 max-w-sm text-xs text-zinc-400">
          Your role ({ROLE_LABELS[role]}) does not include <code className="text-teal-300">{permission}</code>. Ask a
          Super Admin to adjust your permissions.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
