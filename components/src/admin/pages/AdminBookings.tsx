/**
 * /admin/bookings — read-only booking operations view.
 * Admins can inspect, search and export; they cannot mutate booking records
 * (status changes belong to the booking/owner flows and the DB triggers that
 * protect slot integrity). Disputes are investigated, not edited, here.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Download } from "lucide-react";
import { AdminPageHeader, DataTable, Pagination, SearchInput, SimulatedDataBanner, StatusBadge } from "../ui";
import { PermissionGuard } from "../AdminLayout";
import { downloadCsv, fetchBookingRows, type BookingRow } from "../admin-api";
import type { AdminRole } from "../admin-rbac";

const PAGE_SIZE = 25;

export default function AdminBookings() {
  const { user } = useAuth();
  const myRole = (user?.role || "") as AdminRole;
  const [params] = useSearchParams();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(params.get("q") || "");
  const [status, setStatus] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<BookingRow | null>(null);

  useEffect(() => {
    fetchBookingRows()
      .then(setRows)
      .catch((e) => setError(e?.message || "Failed to load bookings"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((b) => {
      const s = (b.status || "").toLowerCase();
      if (status !== "all" && s !== status) return false;
      if (dateFilter && b.date !== dateFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          b.id.toLowerCase().includes(q) ||
          (b.turf_name || "").toLowerCase().includes(q) ||
          (b.turf_id || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, search, status, dateFilter]);

  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <PermissionGuard role={myRole} permission="bookings.view">
      <AdminPageHeader
        title="Booking Management"
        subtitle="All bookings with slot, payment and status data. Records are read-only here by design — status changes run through the booking flows whose triggers protect double-booking."
        actions={
          <button
            onClick={() =>
              downloadCsv(
                `playturf-bookings-${new Date().toISOString().slice(0, 10)}.csv`,
                filtered.map((b) => ({
                  id: b.id, turf: b.turf_name, date: b.date, start: b.start_time,
                  status: b.status, amount: b.amount, payment_id: b.payment_id, created: b.created_at,
                }))
              )
            }
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3.5 text-[11px] font-black uppercase tracking-wider text-zinc-200 hover:bg-white/5"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      />

      <SimulatedDataBanner>
        Payment statuses reflect the <b className="font-black">simulated checkout</b> (no live gateway). Payment IDs are
        generated at mock-confirmation — treat "paid" rows as reservation records, not captured money.
      </SimulatedDataBanner>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Booking ID or venue…" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="h-9 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-xs text-zinc-100 outline-none focus:border-teal-400/40">
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending payment</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-xs text-zinc-100 outline-none focus:border-teal-400/40"
        />
        {(search || status !== "all" || dateFilter) && (
          <button onClick={() => { setSearch(""); setStatus("all"); setDateFilter(""); }} className="text-[11px] font-bold text-teal-300 hover:underline">Clear</button>
        )}
      </div>

      {error && <p className="mb-3 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-3 text-xs text-rose-300">{error}</p>}

      <DataTable
        loading={loading}
        rowKey={(r: BookingRow) => r.id}
        rows={pageRows}
        onRowClick={setDetail}
        columns={[
          {
            key: "id", header: "Booking",
            render: (b) => (
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] text-zinc-400">{b.id}</p>
                <p className="truncate text-xs font-bold text-zinc-100">{b.turf_name || b.turf_id}</p>
              </div>
            ),
          },
          { key: "slot", header: "Slot", render: (b) => <span className="text-xs text-zinc-300">{b.date} · {b.start_time}</span> },
          { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status} /> },
          { key: "payment", header: "Payment", render: (b) => b.payment_id ? <span className="font-mono text-[10px] text-zinc-400">{b.payment_id}</span> : <StatusBadge status="unpaid" /> },
          { key: "amount", header: "Amount", render: (b) => <span className="text-xs font-black text-teal-300">₹{Number(b.amount || 0).toLocaleString("en-IN")}</span> },
        ]}
        footer={<Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />}
      />

      {detail && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#101312] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-black text-white">Booking {detail.id}</h3>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-white">✕</button>
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              {[
                ["Venue", detail.turf_name || detail.turf_id],
                ["Date", detail.date],
                ["Start time", detail.start_time],
                ["Status", detail.status],
                ["Payment ID", detail.payment_id || "— (not paid)"],
                ["Amount", `₹${Number(detail.amount || 0).toLocaleString("en-IN")}`],
                ["Customer ID", detail.user_id],
                ["Created", detail.created_at?.replace("T", " ").slice(0, 19)],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 border-b border-white/[0.04] pb-2 last:border-0">
                  <dt className="shrink-0 text-zinc-500">{k}</dt>
                  <dd className="break-all text-right text-zinc-200">{String(v ?? "—")}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-zinc-400">
              Dispute handling: verify the slot against the venue's availability, check the payment record above, then
              resolve with the user through Support. Direct edits to confirmed bookings are intentionally not possible
              from this panel.
            </p>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
}
