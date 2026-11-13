/**
 * /client — real business dashboard. All metrics computed from the owner's
 * actual bookings (bookings for turfs they own). No simulated values.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, CalendarClock, CalendarX2, CheckCircle2, IndianRupee, MapPin, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardStatCard, SimulatedDataBanner } from "@/admin/ui";
import { myBookings, myFacilities, computeOwnerStats } from "@/lib/api/clientPanel";
import type { OwnerBooking } from "@/lib/api/clientPanel";
import { StatusBadge } from "@/admin/ui";

export default function ClientOverview() {
  const [rows, setRows] = useState<OwnerBooking[]>([]);
  const [facilityCount, setFacilityCount] = useState(0);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"7" | "30" | "all">("30");

  const load = () => {
    setLoading(true);
    Promise.all([myBookings(), myFacilities()])
      .then(([b, f]) => {
        setRows(b.rows);
        setFacilityCount(f.rows.length);
        setMissing(b.missingSchema || f.missingSchema);
      })
      .catch((e) => toast.error(e?.message || "Failed to load your data"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const today = new Date().toLocaleDateString("en-CA");
  const since = range === "all" ? "0000-01-01" : new Date(Date.now() - Number(range) * 86400000).toISOString().slice(0, 10);
  const scoped = rows.filter((b) => (b.created_at || "").slice(0, 10) >= since || (b.date || "") >= since);
  const stats = useMemo(() => computeOwnerStats(scoped, facilityCount, today), [scoped, facilityCount, today]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    scoped.forEach((b) => {
      const d = b.date || (b.created_at || "").slice(0, 10);
      if (d) map.set(d, (map.get(d) || 0) + 1);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-30)
      .map(([label, value]) => ({ label: label.slice(5), value }));
  }, [scoped]);

  const recent = rows.slice(0, 6);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">Business Overview</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Live metrics from bookings at your {facilityCount} {facilityCount === 1 ? "facility" : "facilities"}.
          </p>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className="h-9 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-xs text-zinc-100 outline-none">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {missing && (
        <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3.5 text-xs text-amber-200/90">
          <b className="font-black">Migration required.</b> Run <code>supabase_client_panel.sql</code> in the Supabase
          dashboard, then have a Super Admin assign your facilities (Admin → Venue Management → Owner). Until then this
          dashboard shows no data.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <DashboardStatCard label="Total bookings" value={stats.total} icon={CalendarCheck} />
        <DashboardStatCard label="Today" value={stats.todayCount} tone="emerald" icon={CalendarClock} />
        <DashboardStatCard label="Upcoming" value={stats.upcoming} tone="teal" icon={CalendarClock} />
        <DashboardStatCard label="Completed" value={stats.completed} tone="zinc" icon={CheckCircle2} />
        <DashboardStatCard label="Cancelled" value={stats.cancelled} tone="rose" icon={CalendarX2} />
        <DashboardStatCard label="Booking value" value={`₹${stats.bookingValue.toLocaleString("en-IN")}`} sub="simulated checkout" tone="amber" icon={IndianRupee} />
      </div>

      <SimulatedDataBanner>
        <b className="font-black">Booking value ≠ settled revenue.</b> The checkout is simulated; real payouts begin
        after the payment gateway and settlement backend go live.
      </SimulatedDataBanner>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4 lg:col-span-2">
          <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Bookings over time</h3>
          {byDay.length ? (
            <div className="flex items-end gap-1.5" style={{ height: 120 }}>
              {byDay.map((d) => {
                const max = Math.max(...byDay.map((x) => x.value), 1);
                return (
                  <div key={d.label} className="flex-1" title={`${d.label}: ${d.value}`}>
                    <div className="w-full rounded-t bg-teal-400/70" style={{ height: Math.max(3, (d.value / max) * 96) }} />
                    <p className="mt-1 truncate text-center text-[8px] text-zinc-500">{d.label}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-10 text-center text-xs text-zinc-500">No bookings in this range.</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
          <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Signals</h3>
          <ul className="space-y-2.5 text-xs text-zinc-300">
            <li className="flex justify-between"><span className="text-zinc-500">Facilities</span><b className="text-white">{stats.facilityCount}</b></li>
            <li className="flex justify-between"><span className="text-zinc-500">Conversion</span><b className="text-teal-300">{stats.conversion}%</b></li>
            <li className="flex justify-between gap-2">
              <span className="text-zinc-500 shrink-0">Peak hours</span>
              <span className="text-right font-bold text-white">{stats.peakHours.length ? stats.peakHours.join(", ") : "—"}</span>
            </li>
            <li className="flex items-center justify-between pt-1">
              <span className="text-zinc-500 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Trend</span>
              <span className="text-xs text-zinc-400">{byDay.length > 1 && byDay[byDay.length - 1].value >= byDay[byDay.length - 2].value ? "up" : "steady"}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
        <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Recent bookings</h3>
        {loading ? (
          <p className="py-6 text-center text-xs text-zinc-500">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-500">No bookings yet — share your venue page to get started.</p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {recent.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <span className="min-w-0">
                  <span className="block truncate font-bold text-zinc-100">{b.turf_name || "—"}</span>
                  <span className="text-zinc-500">{b.date} · {b.start_time}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={b.status} />
                  <span className="font-black text-teal-300">₹{Number(b.amount || 0).toLocaleString("en-IN")}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
