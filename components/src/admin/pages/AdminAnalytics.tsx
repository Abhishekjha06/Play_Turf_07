/**
 * /admin/analytics — real aggregates computed from the bookings, profiles and
 * turfs tables, with date-range filtering and CSV export. Metrics that need
 * client-side tracking history (retention, SEO traffic) are labelled as
 * unavailable rather than estimated.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Download } from "lucide-react";
import { AdminPageHeader, BarChart, DashboardStatCard, DataTable, SimulatedDataBanner } from "../ui";
import { PermissionGuard } from "../AdminLayout";
import { downloadCsv, fetchBookingRows, fetchTurfsAdmin, type BookingRow } from "../admin-api";
import type { AdminRole } from "../admin-rbac";

type Range = 7 | 30 | 90;

export default function AdminAnalytics() {
  const { user } = useAuth();
  const myRole = (user?.role || "") as AdminRole;
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [turfs, setTurfs] = useState<{ id: string; city: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>(30);

  useEffect(() => {
    Promise.all([
      fetchBookingRows().catch(() => []),
      fetchTurfsAdmin().then((t) => t.rows.map((r) => ({ id: r.id, city: r.city, name: r.name }))).catch(() => []),
    ])
      .then(([b, t]) => { setRows(b); setTurfs(t); })
      .finally(() => setLoading(false));
  }, []);

  const sinceIso = new Date(Date.now() - range * 86400000).toISOString().slice(0, 10);
  const inRange = rows.filter((b) => (b.created_at || "").slice(0, 10) >= sinceIso || (b.date || "") >= sinceIso);

  const byCity = useMemo(() => {
    const turfCity = new Map(turfs.map((t) => [t.id, t.city]));
    const map = new Map<string, number>();
    inRange.forEach((b) => {
      const city = turfCity.get(b.turf_id || "") || b.turf_name || "Unknown";
      map.set(city, (map.get(city) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
  }, [inRange, turfs]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    inRange.forEach((b) => {
      const d = (b.date || (b.created_at || "").slice(0, 10));
      if (d) map.set(d, (map.get(d) || 0) + 1);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([label, value]) => ({ label: label.slice(5), value }));
  }, [inRange]);

  const topVenues = useMemo(() => {
    const map = new Map<string, { name: string; count: number; value: number }>();
    inRange.forEach((b) => {
      const key = b.turf_id || b.turf_name || "unknown";
      const cur = map.get(key) || { name: b.turf_name || key, count: 0, value: 0 };
      cur.count += 1;
      cur.value += Number(b.amount) || 0;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [inRange]);

  const statusMix = useMemo(() => {
    const c = { confirmed: 0, pending: 0, cancelled: 0 };
    inRange.forEach((b) => {
      const s = (b.status || "").toLowerCase();
      if (s === "confirmed") c.confirmed++;
      else if (s === "pending") c.pending++;
      else if (s === "cancelled") c.cancelled++;
    });
    return c;
  }, [inRange]);

  return (
    <PermissionGuard role={myRole} permission="analytics.view">
      <AdminPageHeader
        title="Analytics & Reporting"
        subtitle="Aggregates computed live from platform tables. Estimates are labelled; unavailable metrics are never faked."
        actions={
          <div className="flex items-center gap-2">
            <select value={range} onChange={(e) => setRange(Number(e.target.value) as Range)} className="h-9 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-xs text-zinc-100 outline-none">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={() => downloadCsv(`playturf-analytics-${range}d.csv`, topVenues.map((v) => ({ venue: v.name, bookings: v.count, booking_value: v.value })))}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3.5 text-[11px] font-black uppercase tracking-wider text-zinc-200 hover:bg-white/5"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        }
      />

      <SimulatedDataBanner>
        Booking values derive from the <b className="font-black">simulated checkout</b>. User retention, SEO traffic and
        organic bookings require the GA4/Search Console authorization and client-side tracking history — those panels
        stay empty until then instead of showing estimates.
      </SimulatedDataBanner>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DashboardStatCard label={`Bookings (${range}d)`} value={inRange.length} />
        <DashboardStatCard label="Confirmed" value={statusMix.confirmed} tone="emerald" />
        <DashboardStatCard label="Pending" value={statusMix.pending} tone="amber" />
        <DashboardStatCard label="Cancelled" value={statusMix.cancelled} tone="rose" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
          <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Booking volume by day</h3>
          {byDay.length ? <BarChart data={byDay} /> : <p className="py-10 text-center text-xs text-zinc-500">No bookings in this range.</p>}
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
          <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">City-wise bookings</h3>
          {byCity.length ? <BarChart data={byCity} /> : <p className="py-10 text-center text-xs text-zinc-500">No data in this range.</p>}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Venue performance</h3>
        <DataTable
          loading={loading}
          rowKey={(v: { name: string }) => v.name}
          rows={topVenues}
          columns={[
            { key: "venue", header: "Venue", render: (v) => <span className="text-xs font-bold text-zinc-100">{v.name}</span> },
            { key: "count", header: "Bookings", render: (v) => <span className="text-xs tabular-nums text-zinc-300">{v.count}</span> },
            { key: "value", header: "Booking value", render: (v) => <span className="text-xs font-black text-teal-300">₹{v.value.toLocaleString("en-IN")}</span> },
          ]}
          emptyLabel="No venue activity in this range."
        />
      </div>
    </PermissionGuard>
  );
}
