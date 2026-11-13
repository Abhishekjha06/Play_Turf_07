/**
 * /admin — Overview dashboard. Every number is a live aggregate from the
 * bookings/profiles/turfs/games tables. No hardcoded statistics.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck, CalendarClock, CalendarX2, CheckCircle2, IndianRupee,
  MapPin, TrendingUp, UserCheck, Users, Volleyball,
} from "lucide-react";
import {
  AdminPageHeader, BarChart, DashboardStatCard, DonutStat, SimulatedDataBanner,
} from "../ui";
import { getOverviewStats } from "../admin-api";
import { useAuth } from "@/hooks/use-auth";
import { PermissionGuard } from "../AdminLayout";
import type { AdminRole } from "../admin-rbac";

type Stats = Awaited<ReturnType<typeof getOverviewStats>>;

export default function AdminOverview() {
  const { user } = useAuth();
  const role = (user?.role || "") as AdminRole;
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOverviewStats()
      .then(setStats)
      .catch((e) => setError(e?.message || "Could not load platform statistics."));
  }, []);

  // Last 14 days of booking volume from real rows
  const daily = (() => {
    if (!stats) return [];
    const days: { label: string; value: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const iso = d.toLocaleDateString("en-CA");
      days.push({
        label: String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"),
        value: stats.bookingRows.filter((b) => b.date === iso).length,
      });
    }
    return days;
  })();

  const statusSegments = stats
    ? [
        { label: "Confirmed", value: stats.confirmedBookings, color: "#34d399" },
        { label: "Pending", value: stats.pendingBookings, color: "#fbbf24" },
        { label: "Cancelled", value: stats.cancelledBookings, color: "#fb7185" },
      ].filter((s) => s.value > 0)
    : [];

  const recent = (stats?.bookingRows || []).slice(0, 6);

  return (
    <PermissionGuard role={role} permission="overview.view">
      <AdminPageHeader
        title="Platform Overview"
        subtitle="Live platform totals — every value is queried from the production database on load."
      />

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-400/[0.06] p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {!stats && !error && (
        <div className="grid place-items-center rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" />
        </div>
      )}

      {stats && (
        <>
          <SimulatedDataBanner>
            <b className="font-black">Payments are simulated.</b> "Booking value" sums confirmed bookings from the
            current mock checkout — it is not settled revenue. Finance figures will become real only after a payment
            gateway with server-side verification is integrated.
          </SimulatedDataBanner>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <DashboardStatCard label="Registered users" value={stats.totalUsers} sub={`+${stats.newUsers7d} in last 7 days`} icon={Users} />
            <DashboardStatCard label="Verified turf owners" value={stats.turfOwners} sub="profiles with client role" tone="emerald" icon={UserCheck} />
            <DashboardStatCard label="Active venues" value={stats.totalVenues} sub="listed turfs" tone="teal" icon={MapPin} />
            <DashboardStatCard label="Administrators" value={stats.admins} sub="all admin roles" tone="zinc" icon={UserCheck} />
            <DashboardStatCard label="Total bookings" value={stats.totalBookings} sub="all time" icon={CalendarCheck} />
            <DashboardStatCard label="Today's bookings" value={stats.todayBookings} sub={`next upcoming: ${stats.upcomingBookings}`} tone="emerald" icon={CalendarClock} />
            <DashboardStatCard label="Pending payment" value={stats.pendingBookings} sub="awaiting checkout" tone="amber" icon={CalendarClock} />
            <DashboardStatCard label="Cancelled" value={stats.cancelledBookings} sub="all time" tone="rose" icon={CalendarX2} />
            <DashboardStatCard label="Open games" value={stats.games} sub="open + full" tone="teal" icon={Volleyball} />
            <DashboardStatCard label="Completed sessions" value={stats.completedBookings} tone="zinc" icon={CheckCircle2} />
            <DashboardStatCard label="Booking value (simulated)" value={`₹${stats.bookingValue.toLocaleString("en-IN")}`} sub="confirmed bookings only" tone="amber" icon={IndianRupee} />
            <DashboardStatCard label="Booking conversion" value={`${stats.conversion}%`} sub="confirmed ÷ (confirmed + pending)" tone="teal" icon={TrendingUp} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4 lg:col-span-3">
              <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Bookings — last 14 days
              </h3>
              <BarChart data={daily} />
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4 lg:col-span-2">
              <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Booking status mix
              </h3>
              {statusSegments.length ? (
                <DonutStat segments={statusSegments} />
              ) : (
                <p className="py-8 text-center text-xs text-zinc-500">No bookings yet.</p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Latest bookings</h3>
              <Link to="/admin/bookings" className="text-[11px] font-bold text-teal-300 hover:underline">
                View all →
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">No bookings recorded yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {recent.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-zinc-100">{b.turf_name || b.turf_id}</span>
                      <span className="text-zinc-500">{b.date} · {b.start_time}</span>
                    </span>
                    <span className="shrink-0 font-black text-teal-300">₹{Number(b.amount || 0).toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </PermissionGuard>
  );
}
