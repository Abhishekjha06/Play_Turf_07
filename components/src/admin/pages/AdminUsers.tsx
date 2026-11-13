/**
 * /admin/users — real profiles table with search, pagination, detail drawer,
 * suspension with recorded reason, and booking history per user.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ShieldCheck, UserCheck, UserX } from "lucide-react";
import {
  AdminPageHeader, ConfirmationDialog, DashboardStatCard, DataTable, MigrationBanner,
  Pagination, SearchInput, StatusBadge,
} from "../ui";
import { PermissionGuard } from "../AdminLayout";
import {
  fetchBookingRows, isMissingSchemaError, listProfiles, setUserSuspended,
  type ProfileRow,
} from "../admin-api";
import { ROLE_LABELS, type AdminRole } from "../admin-rbac";

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const { user } = useAuth();
  const myRole = (user?.role || "") as AdminRole;
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState(params.get("q") || "");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);

  const [selected, setSelected] = useState<ProfileRow | null>(null);
  const [userBookings, setUserBookings] = useState<{ id: string; turf_name: string; date: string; status: string; amount: number }[]>([]);
  const [suspendTarget, setSuspendTarget] = useState<ProfileRow | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<ProfileRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, total } = await listProfiles({ search, page, pageSize: PAGE_SIZE });
      const filtered = roleFilter === "all" ? rows : rows.filter((r) => r.role === roleFilter);
      setRows(filtered);
      setTotal(roleFilter === "all" ? total : filtered.length);
    } catch (e) {
      toast.error((e as Error).message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, page, roleFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (search !== (params.get("q") || "")) {
      const next = new URLSearchParams(params);
      if (search) next.set("q", search); else next.delete("q");
      setParams(next, { replace: true });
    }
  }, [search]);

  const openDetails = async (row: ProfileRow) => {
    setSelected(row);
    setUserBookings([]);
    try {
      const all = await fetchBookingRows();
      setUserBookings(
        all
          .filter((b) => b.user_id === row.id)
          .slice(0, 10)
          .map((b) => ({ id: b.id, turf_name: b.turf_name || b.turf_id || "—", date: b.date || "—", status: b.status || "—", amount: Number(b.amount) || 0 }))
      );
    } catch {
      /* details drawer still shows profile data */
    }
  };

  const doSuspend = async (reason: string) => {
    if (!suspendTarget) return;
    setBusy(true);
    try {
      await setUserSuspended(suspendTarget.id, true, reason, myRole);
      toast.success(`${suspendTarget.full_name || "User"} suspended`);
      setSuspendTarget(null);
      load();
    } catch (e) {
      if (isMissingSchemaError(e)) {
        toast.error("Run supabase_admin_rbac.sql first (is_suspended column missing).");
      } else {
        toast.error((e as Error).message || "Suspension failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const doReactivate = async () => {
    if (!reactivateTarget) return;
    setBusy(true);
    try {
      await setUserSuspended(reactivateTarget.id, false, "", myRole);
      toast.success(`${reactivateTarget.full_name || "User"} reactivated`);
      setReactivateTarget(null);
      load();
    } catch (e) {
      if (isMissingSchemaError(e)) {
        toast.error("Run supabase_admin_rbac.sql first (is_suspended column missing).");
      } else {
        toast.error((e as Error).message || "Reactivation failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const roleBadge = (role: string) => {
    if (role === "client") return <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-300"><UserCheck className="h-3 w-3" /> Turf owner</span>;
    if (role !== "user") return <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-teal-300"><ShieldCheck className="h-3 w-3" /> {ROLE_LABELS[role as AdminRole] || role}</span>;
    return <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Player</span>;
  };

  return (
    <PermissionGuard role={myRole} permission="users.view">
      <AdminPageHeader
        title="User Management"
        subtitle="Registered accounts from the profiles table. Emails live in the auth system and require the future server-side admin API — search works on name and phone."
      />

      {schemaMissing && <MigrationBanner what="Suspension fields (profiles.is_suspended) are not installed yet." />}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <DashboardStatCard label="Users shown" value={total} sub="matching filters" />
        <DashboardStatCard label="Page" value={page + 1} sub={`${PAGE_SIZE} per page`} tone="zinc" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search name or phone…" />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-xs text-zinc-100 outline-none focus:border-teal-400/40"
        >
          <option value="all">All roles</option>
          <option value="user">Players</option>
          <option value="client">Turf owners</option>
          <option value="admin">Operations Admin</option>
          <option value="super_admin">Super Admin</option>
          <option value="finance_admin">Finance Admin</option>
          <option value="content_admin">Content & SEO Admin</option>
          <option value="support_admin">Support Admin</option>
        </select>
      </div>

      <DataTable
        loading={loading}
        rowKey={(r: ProfileRow) => r.id}
        rows={rows}
        onRowClick={openDetails}
        columns={[
          {
            key: "name", header: "User",
            render: (r) => (
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-zinc-100">{r.full_name || "—"} {r.is_suspended && <span className="ml-1 align-middle"><StatusBadge status="suspended" /></span>}</p>
                <p className="text-[10px] text-zinc-500">{r.id.slice(0, 8)}…</p>
              </div>
            ),
          },
          { key: "phone", header: "Phone", render: (r) => <span className="text-xs text-zinc-300">{r.phone || "—"}</span> },
          { key: "role", header: "Role", render: (r) => roleBadge(r.role) },
          {
            key: "joined", header: "Joined",
            render: (r) => <span className="text-[11px] text-zinc-400">{(r.created_at || "").slice(0, 10)}</span>,
          },
          {
            key: "actions", header: "", className: "text-right",
            render: (r) => {
              if (r.id === user?.user_id) return <span className="text-[10px] text-zinc-600">You</span>;
              return r.is_suspended ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setReactivateTarget(r); }}
                  className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300"
                >
                  Reactivate
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setSuspendTarget(r); }}
                  className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-300"
                >
                  Suspend
                </button>
              );
            },
          },
        ]}
        footer={<Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
      />

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0c0e0d] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white">{selected.full_name || "Unnamed user"}</h3>
                <p className="mt-0.5 text-xs text-zinc-500">{selected.phone || "no phone"} · joined {(selected.created_at || "").slice(0, 10)}</p>
                <div className="mt-2">{roleBadge(selected.role)}</div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white">✕</button>
            </div>

            <h4 className="mb-2 mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Recent bookings</h4>
            {userBookings.length === 0 ? (
              <p className="rounded-xl border border-white/[0.06] bg-[#0d0f0e] p-4 text-center text-xs text-zinc-500">No bookings for this user.</p>
            ) : (
              <ul className="space-y-2">
                {userBookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#0d0f0e] p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-zinc-100">{b.turf_name}</p>
                      <p className="text-[10px] text-zinc-500">{b.date}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusBadge status={b.status} />
                      <p className="mt-1 text-[11px] font-black text-teal-300">₹{b.amount.toLocaleString("en-IN")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h4 className="mb-2 mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Account</h4>
            <dl className="space-y-1.5 rounded-xl border border-white/[0.06] bg-[#0d0f0e] p-4 text-xs">
              <div className="flex justify-between"><dt className="text-zinc-500">User ID</dt><dd className="font-mono text-[10px] text-zinc-300">{selected.id}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Avatar</dt><dd className="text-zinc-300">{selected.avatar_id}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Status</dt><dd>{selected.is_suspended ? <StatusBadge status="suspended" /> : <StatusBadge status="active" />}</dd></div>
              {selected.suspension_reason && (
                <div className="flex justify-between gap-4"><dt className="shrink-0 text-zinc-500">Suspend reason</dt><dd className="text-right text-rose-300">{selected.suspension_reason}</dd></div>
              )}
            </dl>
            <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-zinc-600">
              <UserX className="mt-0.5 h-3 w-3 shrink-0" />
              Roles can only be changed by a Super Admin directly in Supabase (or the future server-side admin API) —
              never from a user's own session.
            </p>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!suspendTarget}
        title={`Suspend ${suspendTarget?.full_name || "this user"}?`}
        body="The account will be blocked from the admin-visible platform features. The reason is recorded in the audit log. Hard auth-level blocking requires the deployment checklist's edge-function step."
        confirmLabel="Suspend account"
        danger
        requireReason
        busy={busy}
        onConfirm={doSuspend}
        onClose={() => setSuspendTarget(null)}
      />
      <ConfirmationDialog
        open={!!reactivateTarget}
        title={`Reactivate ${reactivateTarget?.full_name || "this user"}?`}
        body="The suspension flag is cleared and the reason is removed."
        confirmLabel="Reactivate"
        busy={busy}
        onConfirm={doReactivate}
        onClose={() => setReactivateTarget(null)}
      />
    </PermissionGuard>
  );
}
