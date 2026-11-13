/**
 * /admin/venues — venue lifecycle management.
 * Company-owned vs partner venues are explicitly distinguished via the
 * `ownership` column (migration). Status lifecycle: pending_approval →
 * published → archived (migration). Before the migration runs, venues behave
 * as published partners and the editor shows a setup banner.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Building2, Handshake, Plus, SquarePen } from "lucide-react";
import {
  AdminPageHeader, ConfirmationDialog, DataTable, MigrationBanner, Pagination,
  SearchInput, StatusBadge,
} from "../ui";
import { PermissionGuard } from "../AdminLayout";
import { createVenueAdmin, fetchTurfsAdmin, isMissingSchemaError, updateVenueAdmin, type TurfRow } from "../admin-api";
import type { AdminRole } from "../admin-rbac";

const PAGE_SIZE = 20;

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; row: TurfRow };

const emptyForm = {
  name: "", city: "", address: "", image: "", price_per_hour: 1000,
  timing: "06:00 AM – 11:00 PM", sport_types: "Football", amenities: "Floodlights",
  description: "", ownership: "partner", status: "published", is_popular: false,
};

export default function AdminVenues() {
  const { user } = useAuth();
  const myRole = (user?.role || "") as AdminRole;
  const [params] = useSearchParams();

  const [rows, setRows] = useState<TurfRow[]>([]);
  const [missingSchema, setMissingSchema] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get("q") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState<string>('');
  const [archiveTarget, setArchiveTarget] = useState<TurfRow | null>(null);
  const [clients, setClients] = useState<ProfileRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, missingSchema } = await fetchTurfsAdmin();
      setRows(rows);
      setMissingSchema(missingSchema);
    } catch (e) {
      toast.error((e as Error).message || "Failed to load venues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client-role profiles for owner assignment
  useEffect(() => {
    listProfiles({ pageSize: 200 })
      .then(({ rows }) => setClients(rows.filter((r) => r.role === 'client')))
      .catch(() => {});
  }, []);

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all") {
      const s = r.status || "published";
      if (s !== statusFilter) return false;
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      return r.name.toLowerCase().includes(s) || (r.city || "").toLowerCase().includes(s) || (r.address || "").toLowerCase().includes(s);
    }
    return true;
  });
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const openCreate = () => {
    setForm(emptyForm);
    setEditor({ mode: "create" });
  };
  const openEdit = (row: TurfRow) => {
    setForm({
      name: row.name, city: row.city, address: row.address, image: row.image,
      price_per_hour: row.price_per_hour, timing: row.timing,
      sport_types: (row.sport_types || []).join(", "),
      amenities: (row.amenities || []).join(", "),
      description: row.description || "",
      ownership: row.ownership || "partner",
      status: row.status || "published",
      is_popular: !!row.is_popular,
    });
    setOwnerDraft(row.owner_id || '');
    setEditor({ mode: "edit", row });
  };

  const save = async () => {
    if (form.name.trim().length < 2 || !form.city.trim()) {
      toast.error("Name and city are required.");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        image: form.image.trim() || undefined,
        price_per_hour: Number(form.price_per_hour) || 0,
        timing: form.timing.trim(),
        sport_types: form.sport_types.split(",").map((s) => s.trim()).filter(Boolean),
        amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
        description: form.description.trim(),
        ownership: form.ownership,
        status: form.status,
        is_popular: form.is_popular,
        owner_id: ownerDraft === "" ? null : ownerDraft,
      };
      if (editor.mode === "create") {
        await createVenueAdmin(payload, myRole);
        toast.success("Venue created");
      } else {
        await updateVenueAdmin(editor.row.id, payload, myRole, editor.row);
        toast.success("Venue updated — change recorded in the audit log");
      }
      setEditor({ mode: "closed" });
      load();
    } catch (e) {
      if (isMissingSchemaError(e)) {
        toast.error("Run supabase_admin_rbac.sql first (status/ownership columns missing).");
      } else {
        toast.error((e as Error).message || "Save failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const doArchive = async () => {
    if (!archiveTarget) return;
    setBusy(true);
    try {
      await updateVenueAdmin(archiveTarget.id, { status: "archived" }, myRole, archiveTarget);
      toast.success(`${archiveTarget.name} archived`);
      setArchiveTarget(null);
      load();
    } catch (e) {
      if (isMissingSchemaError(e)) toast.error("Run supabase_admin_rbac.sql first.");
      else toast.error((e as Error).message || "Archive failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PermissionGuard role={myRole} permission="venues.view">
      <AdminPageHeader
        title="Venue Management"
        subtitle="Company-owned and partner venues. Ownership is stored per venue and shown everywhere — partner venues are never presented as PlayTurf-owned."
        actions={
          myRole === "super_admin" || myRole === "admin" ? (
            <button onClick={openCreate} className="flex h-9 items-center gap-1.5 rounded-xl bg-teal-500 px-3.5 text-[11px] font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400">
              <Plus className="h-3.5 w-3.5" /> Add venue
            </button>
          ) : null
        }
      />

      {missingSchema && <MigrationBanner what="Venue lifecycle (status) and ownership columns are not installed yet." />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search name, city, address…" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-xs text-zinc-100 outline-none focus:border-teal-400/40"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="pending_approval">Pending approval</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <DataTable
        loading={loading}
        rowKey={(r: TurfRow) => r.id}
        rows={pageRows}
        columns={[
          {
            key: "venue", header: "Venue",
            render: (r) => (
              <div className="flex min-w-0 items-center gap-2.5">
                <img src={r.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" loading="lazy" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-zinc-100">{r.name}</p>
                  <p className="truncate text-[10px] text-zinc-500">{r.city}</p>
                </div>
              </div>
            ),
          },
          {
            key: "ownership", header: "Ownership",
            render: (r) =>
              r.ownership === "company" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-teal-300"><Building2 className="h-3 w-3" /> PlayTurf</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-400"><Handshake className="h-3 w-3" /> Partner</span>
              ),
          },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status || "published"} /> },
          { key: "price", header: "Rate", render: (r) => <span className="text-xs font-bold text-teal-300">₹{r.price_per_hour}/h</span> },
          { key: "sports", header: "Sports", render: (r) => <span className="text-[11px] text-zinc-400">{(r.sport_types || []).join(", ") || "—"}</span> },
          {
            key: "actions", header: "", className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={(e) => { e.preventDefault(); openEdit(r); }}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5"
                  title="Edit"
                >
                  <SquarePen className="h-3 w-3" />
                </button>
                {r.status !== "archived" && (
                  <button
                    onClick={(e) => { e.preventDefault(); setArchiveTarget(r); }}
                    className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-[10px] font-black uppercase text-rose-300"
                  >
                    Archive
                  </button>
                )}
              </div>
            ),
          },
        ]}
        footer={<Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />}
      />

      {/* Editor dialog */}
      {editor.mode !== "closed" && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setEditor({ mode: "closed" })}>
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101312] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white">
              {editor.mode === "create" ? "Add venue" : `Edit ${editor.row.name}`}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { key: "name", label: "Venue name", type: "text" },
                { key: "city", label: "City", type: "text" },
                { key: "address", label: "Address", type: "text" },
                { key: "image", label: "Main image URL", type: "text" },
                { key: "price_per_hour", label: "Hourly rate (₹)", type: "number" },
                { key: "timing", label: "Operating hours", type: "text" },
                { key: "sport_types", label: "Sports (comma separated)", type: "text" },
                { key: "amenities", label: "Facilities (comma separated)", type: "text" },
              ].map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">{f.label}</span>
                  <input
                    type={f.type}
                    value={String((form as Record<string, unknown>)[f.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Owner (client account)</span>
                <select
                  value={ownerDraft}
                  onChange={(e) => setOwnerDraft(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                >
                  <option value="">Unassigned (platform-managed)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || c.id.slice(0, 8)}{c.phone ? ` · ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-zinc-600">
                  The owner sees this facility in their Venue Panel: edit details/pricing, block slots, view bookings.
                </p>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Ownership</span>
                <select
                  value={form.ownership}
                  onChange={(e) => setForm({ ...form, ownership: e.target.value })}
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                >
                  <option value="partner">Partner (independent venue)</option>
                  <option value="company">PlayTurf-owned</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Publish status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                >
                  <option value="published">Published</option>
                  <option value="pending_approval">Pending approval</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0c0b] p-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Owner (client account)</span>
                <select
                  value={ownerDraft}
                  onChange={(e) => setOwnerDraft(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                >
                  <option value="">Unassigned (platform-managed)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name || c.id.slice(0, 8)} {c.phone ? '· ' + c.phone : ''}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-zinc-600">The owner sees this facility in their Venue Panel and can edit pricing/details and block slots.</p>
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={form.is_popular} onChange={(e) => setForm({ ...form, is_popular: e.target.checked })} className="h-4 w-4 accent-teal-500" />
                Show in "Popular Turfs"
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditor({ mode: "closed" })} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5">Cancel</button>
              <button onClick={save} disabled={busy} className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400 disabled:opacity-50">
                {busy ? "Saving…" : editor.mode === "create" ? "Create venue" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!archiveTarget}
        title={`Archive ${archiveTarget?.name}?`}
        body="Archived venues are hidden from the public listing and new bookings cannot be started for them. Existing bookings are kept for reporting."
        confirmLabel="Archive venue"
        danger
        busy={busy}
        onConfirm={doArchive}
        onClose={() => setArchiveTarget(null)}
      />
    </PermissionGuard>
  );
}
