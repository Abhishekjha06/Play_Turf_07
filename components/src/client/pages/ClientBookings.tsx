/**
 * /client/bookings — REAL booking management for the owner's venues.
 * Read-only: owners inspect bookings; customer data is shown as stored.
 * Ownership scoping is enforced by RLS (supabase_client_panel.sql).
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  AdminPageHeader, DataTable, MigrationBanner, Pagination, SearchInput, SimulatedDataBanner, StatusBadge,
} from "@/admin/ui";
import { downloadCsv } from "@/admin/admin-api";
import { type OwnerBooking, myBookings } from "@/lib/api/clientPanel";
import { myBookings } from "@/lib/api/clientPanel";

const PAGE_SIZE = 20;

export default function ClientBookings() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState<OwnerBooking[]>([]);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get("q") || "");
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    myBookings()
      .then(({ rows, missingSchema }) => { setRows(rows); setMissing(missingSchema); })
      .catch((e) => toast.error(e?.message || "Failed to load bookings"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => rows.filter((b) => {
    const s = String(b.status || "").toLowerCase();
    if (status !== "all" && s !== status) return false;
    if (date && b.date !== date) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return b.id.toLowerCase().includes(q) || (b.turf_name || "").toLowerCase().includes(q);
    }
    return true;
  }), [rows, search, status, date]);

  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <AdminPageHeader
        title="Booking Management"
        subtitle="Bookings at your facilities. Customers see their own booking pages; this list is your operations view."
        actions={
          <button
            onClick={() => downloadCsv(`my-bookings-${new Date().toISOString().slice(0, 10)}.csv`, filtered.map((b) => ({
              id: b.id, facility: b.turf_name, date: b.date, start: b.start_time, end: b.end_time,
              status: b.status, amount: b.amount, payment_id: b.payment_id,
            })))}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3.5 text-[11px] font-black uppercase tracking-wider text-zinc-200 hover:bg-white/5"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      />

      {missing && <MigrationBanner what="Facility ownership is not installed yet." />}
      <SimulatedDataBanner>
        Payment references come from the <b className="font-black">simulated checkout</b> — treat paid rows as
        reservation records until the live gateway is integrated.
      </SimulatedDataBanner>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Booking ID or facility…" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="h-9 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-xs text-zinc-100 outline-none">
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending payment</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(0); }} className="h-9 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-xs text-zinc-100 outline-none" />
      </div>

      <DataTable
        loading={loading}
        rowKey={(b: OwnerBooking) => b.id}
        rows={pageRows}
        columns={[
          {
            key: "id", header: "Booking",
            render: (b) => (
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] text-zinc-400">{b.id}</p>
                <p className="truncate text-xs font-bold text-zinc-100">{b.turf_name || "—"}</p>
              </div>
            ),
          },
          { key: "slot", header: "Slot", render: (b) => <span className="text-xs text-zinc-300">{b.date} · {b.start_time}–{b.end_time || "—"}</span> },
          { key: "sport", header: "Sport", render: (b) => <span className="text-xs text-zinc-400">{b.sport || "—"}</span> },
          { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status} /> },
          { key: "payment", header: "Payment", render: (b) => b.payment_id ? <span className="font-mono text-[10px] text-zinc-400">{b.payment_id}</span> : <StatusBadge status="unpaid" /> },
          { key: "amount", header: "Amount", render: (b) => <span className="text-xs font-black text-teal-300">₹{Number(b.amount || 0).toLocaleString("en-IN")}</span> },
        ]}
        footer={undefined}
        emptyLabel="No bookings match your filters."
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
    </div>
  );
}
