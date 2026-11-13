/**
 * /client/revenue — booking-value reporting for the owner's facilities.
 * HONESTY: the checkout is simulated, so every figure is labelled booking
 * value, never settled revenue. Settlements activate after the gateway +
 * ledger backend exist.
 */
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AdminPageHeader, BarChart, DashboardStatCard, DataTable, SimulatedDataBanner } from "@/admin/ui";
import { downloadCsv, myBookings, type OwnerBooking } from "@/lib/api/clientPanel";

export default function ClientRevenue() {
  const [rows, setRows] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    myBookings()
      .then(({ rows }) => setRows(rows))
      .finally(() => setLoading(false));
  }, []);

  const paid = useMemo(() => rows.filter((b) => !!b.payment_id && String(b.status || "").toLowerCase() === "confirmed"), [rows]);
  const total = paid.reduce((s, b) => s + (Number(b.amount) || 0), 0);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    paid.forEach((b) => {
      const d = (b.created_at || "").slice(0, 10);
      if (d) map.set(d, (map.get(d) || 0) + (Number(b.amount) || 0));
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
      .map(([label, value]) => ({ label: label.slice(5), value }));
  }, [paid]);

  return (
    <div>
      <AdminPageHeader
        title="Revenue"
        subtitle="Booking value at your facilities. Settlements, commissions and payouts arrive with the payment backend."
        actions={
          <button
            onClick={() => downloadCsv(`booking-value-${new Date().toISOString().slice(0, 10)}.csv`, paid.map((b) => ({
              booking_id: b.id, facility: b.turf_name, date: b.date, amount: b.amount, gateway: "SIMULATED",
            })))}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3.5 text-[11px] font-black uppercase tracking-wider text-zinc-200 hover:bg-white/5"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        }
      />

      <SimulatedDataBanner>
        <b className="font-black">All figures are booking value from the simulated checkout</b> — not received payments.
        Commission, gateway charges and payouts will appear here only after the live payment gateway and settlement
        backend are deployed.
      </SimulatedDataBanner>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DashboardStatCard label="Confirmed bookings" value={paid.length} />
        <DashboardStatCard label="Booking value" value={`₹${total.toLocaleString("en-IN")}`} tone="amber" />
        <DashboardStatCard label="Platform commission" value="—" sub="requires gateway + rules" tone="zinc" />
        <DashboardStatCard label="Net payout" value="—" sub="requires settlement backend" tone="zinc" />
      </div>

      {byDay.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
          <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Booking value — last 14 active days</h3>
          <BarChart data={byDay} />
        </div>
      )}

      <div className="mt-4">
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Payment records (simulated)</h3>
        <DataTable
          loading={loading}
          rowKey={(b: OwnerBooking) => b.id}
          rows={paid.slice(0, 50)}
          columns={[
            { key: "id", header: "Booking", render: (b) => <span className="font-mono text-[10px] text-zinc-400">{b.id}</span> },
            { key: "date", header: "Date", render: (b) => <span className="text-xs text-zinc-300">{b.date}</span> },
            { key: "pid", header: "Payment ref", render: (b) => <span className="font-mono text-[10px] text-zinc-400">{b.payment_id}</span> },
            { key: "amount", header: "Amount", render: (b) => <span className="text-xs font-black text-teal-300">₹{Number(b.amount).toLocaleString("en-IN")}</span> },
            { key: "gateway", header: "Gateway", render: () => <span className="rounded border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-sky-300">Simulated</span> },
          ]}
          emptyLabel="No confirmed bookings yet."
        />
      </div>
    </div>
  );
}
