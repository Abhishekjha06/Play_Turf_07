/**
 * /admin/settings — platform configuration (site_settings migration table),
 * system health and the beta program (existing real dashboards). High-risk
 * keys require password reauthentication before saving.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Save, ShieldCheck } from "lucide-react";
import { AdminPageHeader, MigrationBanner } from "../ui";
import { PermissionGuard } from "../AdminLayout";
import { getSiteSettings, isMissingSchemaError, updateSiteSetting } from "../admin-api";
import { reauthenticateAdmin } from "../admin-mfa";
import { SystemHealthDashboard } from "@/pages/admin/SystemHealthDashboard";
import { BetaTestingDashboard } from "@/pages/admin/BetaTestingDashboard";
import type { AdminRole } from "../admin-rbac";

type Tab = "platform" | "health" | "beta";

/** Keys whose change can alter business behaviour — require reauth + confirm. */
const HIGH_RISK_KEYS = new Set([
  "booking_rules", "cancellation_policy", "commission_percent", "gst_percent",
  "maintenance_mode", "venue_approval_required",
]);

const SETTING_FIELDS: { key: string; label: string; hint?: string; highRisk?: boolean; type?: string }[] = [
  { key: "platform_name", label: "Platform name" },
  { key: "support_email", label: "Support email" },
  { key: "seo_canonical_domain", label: "Canonical domain" },
  { key: "max_booking_hours", label: "Max booking hours", type: "number", highRisk: true, hint: "Displayed limits also exist in validations.ts — applying needs a code release." },
  { key: "cancellation_window_minutes", label: "Cancellation window (minutes)", type: "number", highRisk: true, hint: "Current enforced window: 15 minutes, server trigger." },
  { key: "venue_approval_required", label: "Venue approval required (true/false)", highRisk: true },
  { key: "maintenance_mode", label: "Maintenance mode (true/false)", highRisk: true, hint: "Flag is stored and audit-logged; the app-wide switch ships with the next release." },
];

export default function AdminSettings() {
  const { user } = useAuth();
  const myRole = (user?.role || "") as AdminRole;
  const canManage = myRole === "super_admin";
  const [tab, setTab] = useState<Tab>("platform");

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reauthFor, setReauthFor] = useState<string | null>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSiteSettings()
      .then(({ settings: s, missingSchema }) => {
        setMissing(missingSchema);
        const flat: Record<string, string> = {};
        Object.entries(s).forEach(([k, v]) => { flat[k] = String(v ?? ""); });
        setSettings(flat);
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, []);

  const saveKey = async (key: string, value: string) => {
    setBusy(true);
    try {
      await updateSiteSetting(key, value, myRole, settings[key]);
      setSettings((s) => ({ ...s, [key]: value }));
      toast.success(`"${key}" saved and audit-logged`);
    } catch (e) {
      if (isMissingSchemaError(e)) toast.error("Run supabase_admin_rbac.sql first (site_settings missing).");
      else toast.error((e as Error).message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const attemptSave = (key: string) => {
    const value = settings[key] ?? "";
    if (HIGH_RISK_KEYS.has(key)) {
      setReauthFor(key);
      return;
    }
    saveKey(key, value);
  };

  const confirmReauth = async () => {
    setBusy(true);
    try {
      const ok = await reauthenticateAdmin(reauthPassword);
      if (!ok) {
        toast.error("Reauthentication failed — password did not match.");
        return;
      }
      const key = reauthFor!;
      setReauthFor(null);
      setReauthPassword("");
      await saveKey(key, settings[key] ?? "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PermissionGuard role={myRole} permission="settings.view">
      <AdminPageHeader
        title="System Settings"
        subtitle="Central platform configuration, live system health and the beta program. High-risk changes require password reauthentication and are audit-logged."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {([["platform", "Platform config"], ["health", "System health"], ["beta", "Beta program"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`rounded-xl px-3.5 py-2 text-[11px] font-black uppercase tracking-wider ${tab === key ? "bg-teal-400/10 text-teal-200 ring-1 ring-teal-400/25" : "border border-white/10 text-zinc-400 hover:bg-white/5"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "platform" && (
        <div className="max-w-2xl space-y-3 rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-5">
          {missing && <MigrationBanner what="site_settings is not installed — configuration cannot be stored yet." />}
          {SETTING_FIELDS.map((f) => (
            <div key={f.key} className="rounded-xl border border-white/[0.06] bg-[#0a0c0b] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    {f.label}
                    {f.highRisk && <ShieldCheck className="h-3 w-3 text-amber-300" title="Requires reauthentication" />}
                  </span>
                  <input
                    type={f.type || "text"}
                    value={settings[f.key] ?? ""}
                    onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                    disabled={missing || !canManage || busy}
                    className="h-9 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40 disabled:opacity-40"
                  />
                  {f.hint && <span className="mt-1 block text-[10px] text-zinc-600">{f.hint}</span>}
                </label>
                <button
                  onClick={() => attemptSave(f.key)}
                  disabled={missing || !canManage || busy}
                  className="mt-4 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-500 text-[#04110e] hover:bg-teal-400 disabled:opacity-40"
                  title="Save"
                >
                  <Save className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <p className="text-[10px] leading-relaxed text-zinc-600">
            Settings are stored values, not live switches: booking rules are enforced by DB triggers and validation
            code, so changing a number here never silently alters existing booking behaviour.
          </p>
        </div>
      )}

      {tab === "health" && (
        <div className="admin-legacy-card-host rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
          <SystemHealthDashboard />
        </div>
      )}
      {tab === "beta" && (
        <div className="admin-legacy-card-host rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
          <BetaTestingDashboard />
        </div>
      )}

      {reauthFor && (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => { setReauthFor(null); setReauthPassword(""); }}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#101312] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex items-center gap-2 text-sm font-black text-white"><ShieldCheck className="h-4 w-4 text-teal-300" /> Confirm your password</h3>
            <p className="mt-1 text-xs text-zinc-400">Changing "{reauthFor}" affects platform behaviour. This step is recorded in the audit log.</p>
            <input
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && reauthPassword && confirmReauth()}
              autoFocus
              className="mt-3 h-11 w-full rounded-xl border border-white/10 bg-[#080a09] px-3.5 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
              placeholder="Administrator password"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setReauthFor(null); setReauthPassword(""); }} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5">Cancel</button>
              <button onClick={confirmReauth} disabled={busy || !reauthPassword} className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#04110e] disabled:opacity-40">
                {busy ? "Verifying…" : "Confirm & save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
}
