/**
 * /client/facilities — real facility management for the owner's venues:
 * edit operational fields (name/location/contact/price/hours/sports/
 * amenities/description). Lifecycle (publish/archive) and ownership stay
 * admin-controlled by design.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SquarePen } from "lucide-react";
import { AdminPageHeader, DataTable, MigrationBanner } from "@/admin/ui";
import { myFacilities, updateMyFacility } from "@/lib/api/clientPanel";
import type { Turf } from "@/data/seed";
import { StatusBadge } from "@/admin/ui";

export default function ClientFacilities() {
  const [rows, setRows] = useState<Turf[]>([]);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Turf | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, missingSchema } = await myFacilities();
      setRows(rows);
      setMissing(missingSchema);
    } catch (e) {
      toast.error((e as Error).message || "Failed to load facilities");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    if (String(editing.name || "").trim().length < 2) { toast.error("Facility name is required."); return; }
    setBusy(true);
    try {
      await updateMyFacility(editing.id, {
        name: editing.name, city: editing.city, address: editing.address,
        price_per_hour: Number(editing.price_per_hour) || 0,
        timing: editing.timing, sport_types: editing.sport_types,
        amenities: editing.amenities, description: editing.description,
      });
      toast.success("Facility updated");
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e as Error).message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="My Facilities"
        subtitle="Venues assigned to your business account. You can update location details, pricing, hours and amenities; publishing status and ownership are managed by the platform."
      />
      {missing && <MigrationBanner what="Facility ownership (turfs.owner_id) is not installed yet." />}

      <DataTable
        loading={loading}
        rowKey={(r: Turf) => r.id}
        rows={rows}
        columns={[
          {
            key: "venue", header: "Facility",
            render: (r) => (
              <div className="flex min-w-0 items-center gap-2.5">
                <img src={r.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" loading="lazy" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-zinc-100">{r.name}</p>
                  <p className="truncate text-[10px] text-zinc-500">{r.address || r.city}</p>
                </div>
              </div>
            ),
          },
          { key: "sports", header: "Sports", render: (r) => <span className="text-[11px] text-zinc-400">{(r.sport_types || []).join(", ") || "—"}</span> },
          { key: "price", header: "Hourly rate", render: (r) => <span className="text-xs font-black text-teal-300">₹{r.price_per_hour}/h</span> },
          { key: "hours", header: "Hours", render: (r) => <span className="text-[11px] text-zinc-400">{r.timing}</span> },
          {
            key: "actions", header: "", className: "text-right",
            render: (r) => (
              <button
                onClick={() => setEditing(r)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-200 hover:bg-white/5"
              >
                <SquarePen className="h-3 w-3" /> Edit
              </button>
            ),
          },
        ]}
        emptyLabel="No facilities assigned to your account yet. Contact the platform to list your venues."
      />

      {editing && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101312] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white">Edit {editing.name}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([
                ["name", "Facility name", "text"],
                ["city", "City", "text"],
                ["address", "Address", "text"],
                ["price_per_hour", "Hourly rate (₹)", "number"],
                ["timing", "Operating hours", "text"],
                ["sport_types", "Sports (comma separated)", "text"],
                ["amenities", "Facilities (comma separated)", "text"],
              ] as const).map(([key, label, type]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span>
                  <input
                    type={type}
                    value={String((editing as unknown as Record<string, unknown>)[key] ?? "")}
                    onChange={(e) =>
                      setEditing({ ...editing, [key]: type === "number" ? Number(e.target.value) : e.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                  />
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Description</span>
                <textarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0c0b] p-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                />
              </label>
            </div>
            <p className="mt-3 text-[10px] text-zinc-600">
              Price changes apply to future bookings only — historical bookings keep the amount they were made at.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5">Cancel</button>
              <button onClick={save} disabled={busy} className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400 disabled:opacity-50">
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
