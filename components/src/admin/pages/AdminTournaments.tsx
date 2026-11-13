/**
 * Shared offers/tournaments manager — used by /admin/tournaments and
 * /admin/offers. Real CRUD through api.admin with audit-logged mutations.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { Offer, Tournament } from "@/data/seed";
import { AdminPageHeader, DataTable } from "../ui";

export function OfferTournamentManager({ kind }: { kind: "offer" | "tournament" }) {
  const { user } = useAuth();
  const myRole = (user?.role || "") as string;
  const canManage = myRole === "super_admin" || myRole === "admin" || myRole === "content_admin";

  const [offers, setOffers] = useState<Offer[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Offer & Tournament> | null>(null);
  const [busy, setBusy] = useState(false);

  const isOffer = kind === "offer";
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, t] = await Promise.all([api.listOffers(), api.listTournaments()]);
      setOffers(o);
      setTournaments(t);
    } catch (e) {
      toast.error((e as Error).message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      if (isOffer) {
        const payload = {
          title: editing.title || "New Offer",
          subtitle: editing.subtitle || "",
          badge: editing.badge || "DEAL",
          image: editing.image || "",
          discount: editing.discount || "10%",
        };
        if (editing.id) throw new Error("Offer edits: delete and re-create (no update API in this release).");
        await api.admin.addOffer(payload);
      } else {
        const payload = {
          name: editing.name || "New Tournament",
          sport: editing.sport || "Football",
          location: editing.location || "",
          image: editing.image || "",
          date: editing.date || new Date().toISOString().slice(0, 10),
          prize_pool: editing.prize_pool || "₹0",
          teams: Number(editing.teams) || 8,
          entry_fee: Number(editing.entry_fee) || 0,
          description: editing.description || "",
        };
        if (editing.id) throw new Error("Tournament edits: delete and re-create (no update API in this release).");
        await api.admin.addTournament(payload);
      }
      toast.success(isOffer ? "Offer created" : "Tournament created");
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e as Error).message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Delete this ${kind}? This is recorded and cannot be undone from the panel.`)) return;
    try {
      if (isOffer) await api.admin.deleteOffer(id);
      else await api.admin.deleteTournament(id);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error((e as Error).message || "Delete failed");
    }
  };

  const rows: (Offer & Partial<Tournament>)[] = isOffer ? offers : (tournaments as unknown as (Offer & Partial<Tournament>)[]);

  return (
    <div>
      <AdminPageHeader
        title={isOffer ? "Offers" : "Tournaments"}
        subtitle={isOffer
          ? "Promotional offers shown on the public Offers page. Content is served live from the offers table."
          : "Tournaments shown on the public Tournaments page, served live from the tournaments table."}
        actions={canManage ? (
          <button
            onClick={() => setEditing(isOffer ? { badge: "DEAL", discount: "10%" } : { sport: "Football", teams: 8, entry_fee: 1000 })}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-teal-500 px-3.5 text-[11px] font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400"
          >
            <Plus className="h-3.5 w-3.5" /> New {kind}
          </button>
        ) : null}
      />

      <DataTable
        loading={loading}
        rowKey={(r) => r.id}
        rows={rows}
        columns={isOffer
          ? [
              { key: "title", header: "Offer", render: (r) => <span className="text-xs font-bold text-zinc-100">{r.title}</span> },
              { key: "badge", header: "Badge", render: (r) => <span className="rounded bg-teal-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-teal-300">{r.badge}</span> },
              { key: "discount", header: "Discount", render: (r) => <span className="text-xs font-black text-teal-300">{r.discount}</span> },
              { key: "subtitle", header: "Subtitle", render: (r) => <span className="block max-w-[280px] truncate text-[11px] text-zinc-400">{r.subtitle}</span> },
              {
                key: "actions", header: "", className: "text-right",
                render: (r) => (
                  <button onClick={() => remove(r.id)} className="grid h-7 w-7 place-items-center rounded-lg border border-rose-400/25 text-rose-300 hover:bg-rose-400/10">
                    <Trash2 className="h-3 w-3" />
                  </button>
                ),
              },
            ]
          : [
              { key: "name", header: "Tournament", render: (r) => <span className="text-xs font-bold text-zinc-100">{r.name}</span> },
              { key: "sport", header: "Sport", render: (r) => <span className="text-xs text-zinc-300">{r.sport}</span> },
              { key: "date", header: "Date", render: (r) => <span className="text-xs text-zinc-300">{r.date}</span> },
              { key: "prize", header: "Prize pool", render: (r) => <span className="text-xs font-black text-teal-300">{r.prize_pool}</span> },
              { key: "location", header: "Location", render: (r) => <span className="text-xs text-zinc-300">{r.location}</span> },
              {
                key: "actions", header: "", className: "text-right",
                render: (r) => (
                  <button onClick={() => remove(r.id)} className="grid h-7 w-7 place-items-center rounded-lg border border-rose-400/25 text-rose-300 hover:bg-rose-400/10">
                    <Trash2 className="h-3 w-3" />
                  </button>
                ),
              },
            ]}
        emptyLabel={`No ${kind}s yet.`}
      />

      {editing && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#101312] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white">New {kind}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(isOffer
                ? [["title", "Title"], ["badge", "Badge"], ["discount", "Discount"], ["image", "Image URL"], ["subtitle", "Subtitle"]]
                : [["name", "Name"], ["sport", "Sport"], ["date", "Date (YYYY-MM-DD)"], ["prize_pool", "Prize pool"], ["location", "Location"], ["image", "Image URL"], ["teams", "Teams"], ["entry_fee", "Entry fee (₹)"]]
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span>
                  <input
                    value={String((editing as Record<string, unknown>)[key] ?? "")}
                    onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5">Cancel</button>
              <button onClick={save} disabled={busy} className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400 disabled:opacity-50">
                {busy ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminTournaments() {
  return <OfferTournamentManager kind="tournament" />;
}
