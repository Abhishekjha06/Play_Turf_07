/**
 * /admin/open-games — moderation view for hosted games.
 * Uses the real games/game_players data (api.listOpenGames). Removal goes
 * through the admin_cancel_game RPC (migration) so the server validates the
 * caller is an administrator before cancelling anyone's game.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { AdminPageHeader, ConfirmationDialog, DataTable, StatusBadge } from "../ui";
import { PermissionGuard } from "../AdminLayout";
import { adminCancelGame, isMissingSchemaError } from "../admin-api";
import type { AdminRole } from "../admin-rbac";
import type { OpenGame } from "@/types/openGames";

export default function AdminOpenGames() {
  const { user } = useAuth();
  const myRole = (user?.role || "") as AdminRole;
  const [games, setGames] = useState<OpenGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<OpenGame | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<OpenGame | null>(null);

  const load = () => {
    setLoading(true);
    api.listOpenGames()
      .then(setGames)
      .catch((e) => toast.error(e?.message || "Failed to load games"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const today = new Date().toLocaleDateString("en-CA");
  const classify = (g: OpenGame): "upcoming" | "completed" | "expired" => {
    if (g.status === "cancelled") return "expired";
    if (g.date > today) return "upcoming";
    if (g.date < today) return "completed";
    return "upcoming";
  };

  const filtered = games.filter((g) => statusFilter === "all" || classify(g) === statusFilter);

  const doCancel = async (reason: string) => {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await adminCancelGame(cancelTarget.id, reason, myRole);
      toast.success("Game cancelled and recorded in the audit log");
      setCancelTarget(null);
      load();
    } catch (e) {
      if (isMissingSchemaError(e) || /function/i.test((e as Error).message || "")) {
        toast.error("admin_cancel_game RPC missing — run supabase_admin_rbac.sql first.");
      } else {
        toast.error((e as Error).message || "Cancellation failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <PermissionGuard role={myRole} permission="games.view">
      <AdminPageHeader
        title="Open Games Management"
        subtitle="All hosted games with hosts and participants. Cancelled and expired games leave the public listing automatically; records are kept for reporting."
        actions={
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-xs text-zinc-100 outline-none focus:border-teal-400/40">
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="expired">Cancelled</option>
          </select>
        }
      />

      <DataTable
        loading={loading}
        rowKey={(g: OpenGame) => g.id}
        rows={filtered}
        onRowClick={setDetail}
        columns={[
          {
            key: "game", header: "Game",
            render: (g) => (
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-zinc-100">{g.sport} · {g.venue}</p>
                <p className="text-[10px] text-zinc-500">{g.date} · {g.time}</p>
              </div>
            ),
          },
          { key: "host", header: "Host", render: (g) => <span className="text-xs text-zinc-300">{g.host_name}</span> },
          { key: "players", header: "Players", render: (g) => <span className="text-xs tabular-nums text-zinc-300">{g.slots_filled}/{g.slots_total}</span> },
          { key: "privacy", header: "Type", render: (g) => <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{g.is_private ? "Private" : "Public"}</span> },
          { key: "status", header: "Status", render: (g) => <StatusBadge status={g.status === "full" ? "full" : classify(g) === "expired" ? "cancelled" : "open"} /> },
          {
            key: "actions", header: "", className: "text-right",
            render: (g) => (
              hasPermissionCancel(myRole) && classify(g) === "upcoming" ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setCancelTarget(g); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-300"
                >
                  <Ban className="h-3 w-3" /> Remove
                </button>
              ) : null
            ),
          },
        ]}
        emptyLabel="No games match this filter."
      />

      {/* Participants drawer */}
      {detail && (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0c0e0d] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-white">{detail.sport} · {detail.venue}</h3>
                <p className="mt-0.5 text-xs text-zinc-500">{detail.date} · {detail.time} · host {detail.host_name}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white">✕</button>
            </div>
            <h4 className="mb-2 mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              Participants ({detail.players.length}/{detail.slots_total})
            </h4>
            <ul className="space-y-2">
              {detail.players.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#0d0f0e] p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <img src={p.avatar} alt="" className="h-8 w-8 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-zinc-100">
                        {p.name} {p.is_host && <span className="ml-1 rounded bg-teal-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-teal-300">host</span>}
                      </p>
                      <p className="text-[10px] text-zinc-500">joined {(p.joined_at || "").slice(0, 10) || "—"}</p>
                    </div>
                  </div>
                  <StatusBadge status={p.payment_status || "unpaid"} />
                </li>
              ))}
              {detail.players.length === 0 && <p className="py-6 text-center text-xs text-zinc-500">No players yet.</p>}
            </ul>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!cancelTarget}
        title={`Remove "${cancelTarget?.sport} at ${cancelTarget?.venue}"?`}
        body="The game is cancelled for all participants, who keep their payment records for support. The removal reason is stored in the audit log. This action is validated server-side against your administrator role."
        confirmLabel="Cancel game"
        danger
        requireReason
        busy={busy}
        onConfirm={doCancel}
        onClose={() => setCancelTarget(null)}
      />
    </PermissionGuard>
  );
}

function hasPermissionCancel(role: AdminRole): boolean {
  return role === "super_admin" || role === "admin";
}
