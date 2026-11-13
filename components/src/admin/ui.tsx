/**
 * Shared admin UI primitives — AMOLED dark + teal accent, light variant via
 * the .admin-light scope. Only existing dependencies (lucide, tailwind).
 */
import React, { useState } from "react";
import {
  AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, Search, ShieldAlert, X,
} from "lucide-react";

// ── Page header ────────────────────────────────────────────────────────────

export function AdminPageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-black text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-zinc-400 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

export function DashboardStatCard({
  label, value, sub, tone = "teal", icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "teal" | "amber" | "rose" | "zinc" | "emerald";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const tones: Record<string, string> = {
    teal: "text-teal-300 bg-teal-400/10 border-teal-400/20",
    amber: "text-amber-300 bg-amber-400/10 border-amber-400/20",
    rose: "text-rose-300 bg-rose-400/10 border-rose-400/20",
    emerald: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
    zinc: "text-zinc-300 bg-white/5 border-white/10",
  };
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        {Icon && (
          <span className={`grid h-7 w-7 place-items-center rounded-lg border ${tones[tone]}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-black text-white tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-zinc-500">{sub}</p>}
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────

const BADGE_TONES: Record<string, string> = {
  published: "bg-emerald-400/10 border-emerald-400/30 text-emerald-300",
  confirmed: "bg-emerald-400/10 border-emerald-400/30 text-emerald-300",
  open: "bg-emerald-400/10 border-emerald-400/30 text-emerald-300",
  active: "bg-emerald-400/10 border-emerald-400/30 text-emerald-300",
  paid: "bg-emerald-400/10 border-emerald-400/30 text-emerald-300",
  pending: "bg-amber-400/10 border-amber-400/30 text-amber-300",
  pending_approval: "bg-amber-400/10 border-amber-400/30 text-amber-300",
  requested: "bg-amber-400/10 border-amber-400/30 text-amber-300",
  full: "bg-sky-400/10 border-sky-400/30 text-sky-300",
  completed: "bg-sky-400/10 border-sky-400/30 text-sky-300",
  archived: "bg-zinc-400/10 border-zinc-400/30 text-zinc-400",
  draft: "bg-zinc-400/10 border-zinc-400/30 text-zinc-400",
  cancelled: "bg-rose-400/10 border-rose-400/30 text-rose-300",
  suspended: "bg-rose-400/10 border-rose-400/30 text-rose-300",
  rejected: "bg-rose-400/10 border-rose-400/30 text-rose-300",
  unpaid: "bg-rose-400/10 border-rose-400/30 text-rose-300",
  failed: "bg-rose-400/10 border-rose-400/30 text-rose-300",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = String(status || "unknown").toLowerCase();
  const tone = BADGE_TONES[s] || "bg-zinc-400/10 border-zinc-400/30 text-zinc-400";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${tone}`}>
      {s.replace(/_/g, " ")}
    </span>
  );
}

// ── Data table ─────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns, rows, rowKey, loading, emptyLabel = "No records", onRowClick, footer,
}: {
  columns: { key: string; header: string; render: (row: T) => React.ReactNode; className?: string }[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyLabel?: string;
  onRowClick?: (row: T) => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 ${c.className || ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-teal-300 mx-auto" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-zinc-500">
                  <Inbox className="h-5 w-5 mx-auto mb-2 text-zinc-600" />
                  {emptyLabel}
                </td>
              </tr>
            )}
            {!loading && rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-white/[0.04] last:border-0 transition-colors hover:bg-white/[0.03] ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle text-zinc-200 ${c.className || ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && <div className="border-t border-white/[0.06] px-4 py-3">{footer}</div>}
    </div>
  );
}

export function Pagination({
  page, pageSize, total, onPage,
}: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between text-xs text-zinc-400">
      <span>
        {total === 0 ? "0" : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-zinc-300 disabled:opacity-30 enabled:hover:bg-white/5"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="px-2 tabular-nums">Page {page + 1} / {pages}</span>
        <button
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
          className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-zinc-300 disabled:opacity-30 enabled:hover:bg-white/5"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SearchInput({
  value, onChange, placeholder = "Search…",
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-xl border border-white/10 bg-[#0a0c0b] pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-teal-400/40"
      />
    </div>
  );
}

export function AdminSelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#0a0c0b]">{o.label}</option>
      ))}
    </select>
  );
}

// ── Confirmation dialog ────────────────────────────────────────────────────

export function ConfirmationDialog({
  open, title, body, confirmLabel = "Confirm", danger, requireReason, onConfirm, onClose, busy,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101312] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {danger && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />}
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {requireReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (recorded in the audit log)"
            rows={2}
            className="mt-3 w-full rounded-xl border border-white/10 bg-[#0a0c0b] p-3 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-teal-400/40"
          />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5">
            Cancel
          </button>
          <button
            disabled={busy || (requireReason && reason.trim().length < 3)}
            onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider disabled:opacity-40 ${
              danger ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-teal-500 text-[#04110e] hover:bg-teal-400"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Permission / setup banners ─────────────────────────────────────────────

export function MigrationBanner({ what }: { what: string }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3.5">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <p className="text-xs leading-relaxed text-amber-200/90">
        <b className="font-black">Database migration required.</b> {what} Run{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 text-[11px]">supabase_admin_rbac.sql</code> in the Supabase
        dashboard, then reload. This module hides fabricated values until the real tables exist.
      </p>
    </div>
  );
}

export function SimulatedDataBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-3.5">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
      <p className="text-xs leading-relaxed text-sky-200/90">{children}</p>
    </div>
  );
}

// ── Tiny SVG charts (no chart library) ─────────────────────────────────────

export function BarChart({ data, height = 140 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="group relative flex-1">
          <div
            className="w-full rounded-t bg-teal-400/70 transition-colors group-hover:bg-teal-300"
            style={{ height: Math.max(3, (d.value / max) * (height - 24)) }}
          />
          <p className="mt-1 truncate text-center text-[9px] text-zinc-500">{d.label}</p>
          <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-bold text-teal-200 opacity-0 transition-opacity group-hover:opacity-100">
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DonutStat({ segments, size = 120 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((s) => {
          const frac = s.value / total;
          const el = (
            <circle
              key={s.label}
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={s.color} strokeWidth={12}
              strokeDasharray={`${frac * c} ${c}`}
              strokeDashoffset={-offset * c}
            />
          );
          offset += frac;
          return el;
        })}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-zinc-300">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label} <b className="text-white tabular-nums">{s.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
