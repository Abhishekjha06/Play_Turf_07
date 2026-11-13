/**
 * /admin/security — administrators, MFA enrollment, login attempts and the
 * audit log. Only Super Admins see other administrators; every admin manages
 * their own MFA. Audit rows are insert-only (RLS) — nobody edits history.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, ShieldOff, Trash2 } from "lucide-react";
import {
  AdminPageHeader, DataTable, MigrationBanner, StatusBadge,
} from "../ui";
import { PermissionGuard } from "../AdminLayout";
import {
  getAalStatus, enrollTotpStart, enrollTotpVerify, listFactors, unenrollFactor,
  type AalStatus,
} from "../admin-mfa";
import { listAuditLog, listProfiles, type AuditEntry } from "../admin-api";
import { PERMISSIONS, ROLE_LABELS, type AdminRole } from "../admin-rbac";

type Tab = "mfa" | "admins" | "audit" | "attempts";

export default function AdminSecurity() {
  const { user } = useAuth();
  const myRole = (user?.role || "") as AdminRole;
  const isSuper = myRole === "super_admin";
  const [tab, setTab] = useState<Tab>("mfa");

  return (
    <PermissionGuard role={myRole} permission="security.view">
      <AdminPageHeader
        title="Security & Permissions"
        subtitle="Your MFA, administrator accounts (Super Admin view), the append-only audit log, and login-attempt telemetry."
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {([["mfa", "My MFA"], ...(isSuper ? [["admins", "Administrators"] as const] : []), ...(isSuper ? [["audit", "Audit Log"] as const] : []), ["attempts", "Login Attempts"] as const] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`rounded-xl px-3.5 py-2 text-[11px] font-black uppercase tracking-wider ${tab === key ? "bg-teal-400/10 text-teal-200 ring-1 ring-teal-400/25" : "border border-white/10 text-zinc-400 hover:bg-white/5"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "mfa" && <MfaPanel />}
      {tab === "admins" && isSuper && <AdminsPanel myRole={myRole} />}
      {tab === "audit" && isSuper && <AuditPanel />}
      {tab === "attempts" && <AttemptsPanel />}
    </PermissionGuard>
  );
}

// ── MFA (self-service, real Supabase TOTP) ─────────────────────────────────

function MfaPanel() {
  const [aal, setAal] = useState<AalStatus | null>(null);
  const [factors, setFactors] = useState<Awaited<ReturnType<typeof listFactors>>>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ id: string; totp?: { qr_code?: string; secret?: string } } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setAal(await getAalStatus().catch(() => null));
    setFactors(await listFactors().catch(() => []));
  };
  useEffect(() => { load(); }, []);

  const startEnroll = async () => {
    setBusy(true);
    try {
      const data = await enrollTotpStart("PlayTurf Admin");
      setEnrollData(data);
      setEnrolling(true);
    } catch (e) {
      toast.error((e as Error).message || "Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async () => {
    if (!enrollData) return;
    setBusy(true);
    try {
      const ok = await enrollTotpVerify(enrollData.id, code);
      if (!ok) { toast.error("Invalid code — try the next one from your app."); return; }
      toast.success("Authenticator enrolled. Future admin sign-ins will require a code.");
      setEnrolling(false); setEnrollData(null); setCode("");
      load();
    } catch (e) {
      toast.error((e as Error).message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async (id: string) => {
    if (!confirm("Remove this authenticator? Admin sign-in will no longer require MFA until a new one is enrolled.")) return;
    try {
      await unenrollFactor(id);
      toast.success("Authenticator removed");
      load();
    } catch (e) {
      toast.error((e as Error).message || "Removal failed");
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-white">Authenticator app (TOTP)</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Session assurance: <b className={aal?.current === "aal2" ? "text-emerald-300" : "text-amber-300"}>{aal?.current || "…"}</b>
              {factors.length > 0 && aal?.current !== "aal2" && " — re-verify at /admin/login to reach AAL2"}
            </p>
          </div>
          {aal?.current === "aal2" ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <ShieldOff className="h-6 w-6 text-amber-400" />}
        </div>

        {factors.length > 0 && (
          <ul className="mt-4 space-y-2">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0a0c0b] p-3">
                <div>
                  <p className="text-xs font-bold text-zinc-100">{f.friendly_name || "Authenticator"}</p>
                  <p className="text-[10px] text-zinc-500">{f.type} · {f.status}</p>
                </div>
                <button onClick={() => removeFactor(f.id)} className="grid h-7 w-7 place-items-center rounded-lg border border-rose-400/25 text-rose-300 hover:bg-rose-400/10">
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!enrolling && (
          <button onClick={startEnroll} disabled={busy} className="mt-4 flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            {factors.length ? "Add another authenticator" : "Enroll authenticator"}
          </button>
        )}

        {enrolling && enrollData && (
          <div className="mt-4 rounded-xl border border-teal-400/20 bg-teal-400/[0.04] p-4">
            <p className="text-xs text-zinc-300">1. Add this secret to Google Authenticator / 1Password / Authy:</p>
            <code className="mt-2 block break-all rounded-lg bg-black/50 p-2.5 text-[11px] text-teal-200">{enrollData.totp?.secret}</code>
            {enrollData.totp?.qr_code && (
              <img src={enrollData.totp.qr_code} alt="TOTP QR code" className="mt-3 h-36 w-36 rounded-lg bg-white p-1.5" />
            )}
            <p className="mt-3 text-xs text-zinc-300">2. Enter the 6-digit code to confirm:</p>
            <div className="mt-2 flex gap-2">
              <input
                inputMode="numeric" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-11 flex-1 rounded-xl border border-white/10 bg-[#0a0c0b] text-center text-lg font-black tracking-[0.3em] text-zinc-100 outline-none focus:border-teal-400/40"
                placeholder="000000"
              />
              <button onClick={confirmEnroll} disabled={busy || code.length !== 6} className="rounded-xl bg-teal-500 px-4 text-[11px] font-black uppercase tracking-wider text-[#04110e] disabled:opacity-40">
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-zinc-600">
        Once enrolled, admin sign-in requires a valid code (AAL2) and RLS policies may require it for privileged
        tables (template in supabase_admin_rbac.sql). Phone-OTP as a second factor is not offered because Supabase
        Auth supports TOTP as the only second factor — SMS OTP remains a sign-in method, not an MFA factor.
      </p>
    </div>
  );
}

// ── Administrators (Super Admin only) ──────────────────────────────────────

function AdminsPanel(_props: { myRole: AdminRole }) {
  const [rows, setRows] = useState<import("../admin-api").ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProfiles({ pageSize: 200 })
      .then(({ rows }) => setRows(rows.filter((r) => ["admin", "super_admin", "finance_admin", "content_admin", "support_admin"].includes(r.role))))
      .catch((e) => toast.error((e as Error).message || "Failed to load administrators"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Permission matrix</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[10px]">
            <thead>
              <tr className="text-zinc-500">
                <th className="py-1.5 pr-3 font-black uppercase tracking-wider">Permission</th>
                {(Object.keys(PERMISSIONS) as AdminRole[]).map((r) => (
                  <th key={r} className="px-2 py-1.5 text-center font-black uppercase tracking-wider">{ROLE_LABELS[r].split(" ")[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["overview.view", "users.view", "users.moderate", "venues.manage", "bookings.view", "games.moderate", "finance.manage", "seo.manage", "cms.manage", "support.manage", "security.manage", "settings.manage", "audit.view"] as const).map((p) => (
                <tr key={p} className="border-t border-white/[0.04]">
                  <td className="py-1.5 pr-3 font-mono text-zinc-400">{p}</td>
                  {(Object.keys(PERMISSIONS) as AdminRole[]).map((r) => (
                    <td key={r} className="px-2 py-1.5 text-center">
                      {PERMISSIONS[r].includes(p) ? <span className="text-emerald-400">●</span> : <span className="text-zinc-700">○</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DataTable
        loading={loading}
        rowKey={(r: import("../admin-api").ProfileRow) => r.id}
        rows={rows}
        columns={[
          { key: "name", header: "Administrator", render: (r) => <span className="text-xs font-bold text-zinc-100">{r.full_name || r.id.slice(0, 8)}</span> },
          { key: "role", header: "Role", render: (r) => <span className="text-[10px] font-black uppercase tracking-wider text-teal-300">{ROLE_LABELS[r.role as AdminRole] || r.role}</span> },
          { key: "phone", header: "Phone", render: (r) => <span className="text-xs text-zinc-400">{r.phone || "—"}</span> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.is_suspended ? "suspended" : "active"} /> },
          { key: "joined", header: "Since", render: (r) => <span className="text-[11px] text-zinc-500">{(r.created_at || "").slice(0, 10)}</span> },
        ]}
        emptyLabel="No administrators found."
      />
      <p className="text-[10px] leading-relaxed text-zinc-600">
        Provisioning a new administrator: create the auth user in Supabase Dashboard → Authentication, then set their
        profiles.role. The role-guard trigger (migration) prevents anyone from granting these roles to themselves.
        UI-only role editing is intentionally not provided.
      </p>
    </div>
  );
}

// ── Audit log (append-only) ────────────────────────────────────────────────

function AuditPanel() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAuditLog(200)
      .then(({ rows, missingSchema }) => { setRows(rows); setMissing(missingSchema); })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, []);

  if (missing) return <MigrationBanner what="admin_audit_log is not installed — privileged actions are currently NOT recorded." />;

  return (
    <DataTable
      loading={loading}
      rowKey={(r: AuditEntry) => r.id}
      rows={rows}
      columns={[
        { key: "when", header: "When", render: (r) => <span className="whitespace-nowrap text-[11px] text-zinc-400">{(r.created_at || "").replace("T", " ").slice(0, 19)}</span> },
        { key: "actor", header: "Actor", render: (r) => <span className="font-mono text-[10px] text-zinc-400">{(r.actor_id || "—").slice(0, 8)}…</span> },
        { key: "action", header: "Action", render: (r) => <span className="text-[11px] font-black uppercase tracking-wider text-teal-300">{r.action}</span> },
        { key: "record", header: "Record", render: (r) => <span className="font-mono text-[10px] text-zinc-500">{r.record_id || "—"}</span> },
        {
          key: "changes", header: "Change",
          render: (r) => (
            <span className="block max-w-[320px] truncate text-[10px] text-zinc-400" title={JSON.stringify({ old: r.old_value, new: r.new_value })}>
              {r.old_value ? "updated" : "created"} {r.new_value && typeof r.new_value === "object" ? `· keys: ${Object.keys(r.new_value as object).slice(0, 4).join(", ")}` : ""}
            </span>
          ),
        },
        { key: "reason", header: "Reason", render: (r) => <span className="block max-w-[200px] truncate text-[11px] text-zinc-300">{r.reason || "—"}</span> },
      ]}
      emptyLabel="No privileged actions recorded yet."
    />
  );
}

// ── Login attempts (rate_limits table) ─────────────────────────────────────

function AttemptsPanel() {
  const [rows, setRows] = useState<{ id: string; identifier: string; action: string; created_at: string }[]>([]);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { getSupabase } = await import("@/lib/supabase");
        const supabase = await getSupabase();
        const { data, error } = await supabase
          .from("rate_limits")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        setRows((data || []) as typeof rows);
      } catch (e) {
        if (/rate_limits|schema/i.test((e as Error).message)) setMissing(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (missing) return <MigrationBanner what="rate_limits is not readable by administrators under current policies — run the RBAC migration's admin-read grant." />;

  return (
    <div>
      <p className="mb-3 rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-3.5 text-xs leading-relaxed text-sky-200/90">
        Client-side rate-limit records (rate_limits table). These are <b className="font-black">bypassable telemetry</b>,
        not enforcement — real server-side throttling is on the deployment checklist.
      </p>
      <DataTable
        loading={loading}
        rowKey={(r) => r.id}
        rows={rows}
        columns={[
          { key: "when", header: "When", render: (r) => <span className="whitespace-nowrap text-[11px] text-zinc-400">{(r.created_at || "").replace("T", " ").slice(0, 19)}</span> },
          { key: "identifier", header: "Identifier", render: (r) => <span className="text-xs text-zinc-200">{r.identifier}</span> },
          { key: "action", header: "Action", render: (r) => <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">{r.action}</span> },
        ]}
        emptyLabel="No login attempts recorded."
      />
    </div>
  );
}
