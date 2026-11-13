/**
 * /client/pricing — per-facility hourly pricing (real updates on the turfs
 * table). Sport/peak/off-peak pricing needs the turf_pricing tables — pending
 * backend, labelled in the UI rather than faked.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader, MigrationBanner } from "@/admin/ui";
import { myFacilities, updateMyFacility } from "@/lib/api/clientPanel";
import type { Turf } from "@/data/seed";

export default function ClientPricing() {
  const [rows, setRows] = useState<Turf[]>([]);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, missingSchema } = await myFacilities();
      setRows(rows);
      setMissing(missingSchema);
      setDrafts(Object.fromEntries(rows.map((r) => [r.id, r.price_per_hour])));
    } catch (e) {
      toast.error((e as Error).message || "Failed to load facilities");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (id: string) => {
    const price = Number(drafts[id]);
    if (!price || price < 0) { toast.error("Enter a valid hourly rate."); return; }
    setBusyId(id);
    try {
      await updateMyFacility(id, { price_per_hour: price });
      toast.success("Pricing updated — applies to future bookings only.");
      load();
    } catch (e) {
      toast.error((e as Error).message || "Save failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Pricing Management"
        subtitle="Hourly rates for your facilities. Changes apply to future bookings — historical bookings keep their original amount."
      />
      {missing && <MigrationBanner what="Facility ownership is not installed yet." />}

      <div className="space-y-3">
        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-8 text-center text-sm text-zinc-500">
            No facilities assigned to your account yet.
          </p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-100">{r.name}</p>
                <p className="text-[11px] text-zinc-500">{(r.sport_types || []).join(", ") || "—"} · {r.timing}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Hourly rate (₹)</span>
                  <input
                    type="number"
                    min={0}
                    value={drafts[r.id] ?? r.price_per_hour}
                    onChange={(e) => setDrafts({ ...drafts, [r.id]: Number(e.target.value) })}
                    className="h-10 w-32 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                  />
                </label>
                <button
                  onClick={() => save(r.id)}
                  disabled={busyId === r.id || (drafts[r.id] ?? r.price_per_hour) === r.price_per_hour}
                  className="h-10 rounded-xl bg-teal-500 px-4 text-[11px] font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400 disabled:opacity-40"
                >
                  {busyId === r.id ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-3.5 text-xs leading-relaxed text-sky-200/90">
        <b className="font-black">Pending backend:</b> sport-specific, peak/off-peak and weekend pricing require the
        turf_pricing tables (planned migration) — the panel will show them once the backend supports them rather than
        faking per-hour rules.
      </div>
    </div>
  );
}
