/**
 * /client/slots — REAL persistent slot management.
 * Blocks are stored in the blocked_slots table (migration), respected by the
 * player slot grid AND the booking engine, and enforced server-side by the
 * overlap trigger. Blocking never touched React state alone.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { AdminPageHeader, ConfirmationDialog, MigrationBanner } from "@/admin/ui";
import {
  blockSlots, getBlockedSlots, myFacilities, removeBlockedSlot, type BlockedSlot,
} from "@/lib/api/clientPanel";
import { isMissingSchemaError } from "@/admin/admin-api";

export default function ClientSlots() {
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [turfId, setTurfId] = useState("");
  const [missing, setMissing] = useState(false);
  const [blocks, setBlocks] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [toDate, setToDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [startHour, setStartHour] = useState(10);
  const [endHour, setEndHour] = useState(12);
  const [reason, setReason] = useState("Maintenance");
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<BlockedSlot | null>(null);

  const load = useCallback(async () => {
    if (!turfId) return;
    setLoading(true);
    try {
      const list = await getBlockedSlots(turfId);
      setBlocks(list);
    } catch (e) {
      if (isMissingSchemaError(e)) setMissing(true);
      else toast.error((e as Error).message || "Failed to load blocked slots");
    } finally {
      setLoading(false);
    }
  }, [turfId]);

  useEffect(() => {
    myFacilities().then(({ rows, missingSchema }) => {
      setFacilities(rows.map((r) => ({ id: r.id, name: r.name })));
      setMissing(missingSchema);
      if (rows.length && !turfId) setTurfId(rows[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const doBlock = async () => {
    if (startHour >= endHour) { toast.error("End hour must be after start hour."); return; }
    if (toDate < fromDate) { toast.error("End date must be on or after the start date."); return; }
    setBusy(true);
    try {
      const n = await blockSlots({ turfId, fromDate, toDate, startHour, endHour, reason: reason.trim() || "Maintenance" });
      toast.success(`${n} slot${n === 1 ? "" : "s"} blocked — players can no longer book them.`);
      load();
    } catch (e) {
      if (isMissingSchemaError(e)) toast.error("Run supabase_client_panel.sql first (blocked_slots table missing).");
      else toast.error((e as Error).message || "Blocking failed");
    } finally {
      setBusy(false);
    }
  };

  const doRemove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await removeBlockedSlot(removeTarget.id);
      toast.success("Block removed — the slot is bookable again.");
      setRemoveTarget(null);
      load();
    } catch (e) {
      toast.error((e as Error).message || "Failed to remove block");
    } finally {
      setBusy(false);
    }
  };

  const facilityName = (id: string) => facilities.find((f) => f.id === id)?.name || id;

  return (
    <div>
      <AdminPageHeader
        title="Slot Management"
        subtitle="Blocked periods are stored in the database immediately: the player slot grid hides them, new bookings are rejected, and the server trigger enforces it for everyone."
      />

      {missing && <MigrationBanner what="blocked_slots table is not installed yet." />}
      {!missing && facilities.length === 0 && !loading && (
        <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3.5 text-xs text-amber-200/90">
          No facilities are assigned to your account yet. Once a Super Admin assigns your venues (Admin → Venue
          Management → Owner), you can block their slots here.
        </div>
      )}

      {facilities.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Block form */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Block slots</h3>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Facility</span>
                <select value={turfId} onChange={(e) => setTurfId(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none">
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">From date</span>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">To date</span>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Start hour</span>
                  <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none">
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">End hour</span>
                  <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none">
                    {Array.from({ length: 24 }, (_, h) => <option key={h + 1} value={h + 1}>{String(h + 1).padStart(2, "0")}:00</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Reason</span>
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none" />
              </label>
              <button
                onClick={doBlock}
                disabled={busy || missing || !turfId}
                className="h-10 w-full rounded-xl bg-teal-500 text-[11px] font-black uppercase tracking-widest text-[#04110e] hover:bg-teal-400 disabled:opacity-50"
              >
                {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Block slots"}
              </button>
              <p className="text-[10px] leading-relaxed text-zinc-600">
                Blocks apply to every court of the facility. Court-specific blocking and maintenance windows are planned
                once per-court management ships to owners.
              </p>
            </div>
          </div>

          {/* Existing blocks */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4 lg:col-span-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              Blocked periods — {facilityName(turfId)} ({blocks.length})
            </h3>
            {loading ? (
              <Loader2 className="mx-auto mt-10 h-5 w-5 animate-spin text-teal-300" />
            ) : blocks.length === 0 ? (
              <p className="py-10 text-center text-xs text-zinc-500">Nothing blocked — every slot is bookable.</p>
            ) : (
              <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
                {blocks.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0a0c0b] p-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-100">{b.date} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}</p>
                      <p className="truncate text-[10px] text-zinc-500">{b.reason}</p>
                    </div>
                    <button
                      onClick={() => setRemoveTarget(b)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-rose-400/25 text-rose-300 hover:bg-rose-400/10"
                      title="Unblock"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!removeTarget}
        title="Remove this block?"
        body={`${removeTarget?.date} ${removeTarget?.start_time.slice(0, 5)}–${removeTarget?.end_time.slice(0, 5)} becomes bookable again immediately.`}
        confirmLabel="Unblock"
        busy={busy}
        onConfirm={doRemove}
        onClose={() => setRemoveTarget(null)}
      />
    </div>
  );
}
