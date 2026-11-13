/**
 * /admin/seo — SEO Control Center.
 * Global SEO defaults, location/sport landing-page overrides (seo_pages —
 * migration), venue metadata preview, sitemap/robots status and structured
 * data preview. Anti-thin-content controls live here: pages can be noindexed
 * or disabled without deleting anything.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { SITE_ORIGIN, absoluteUrl } from "@/lib/seo";
import { toast } from "sonner";
import { ExternalLink, Globe, MapPin, Save, Trash2, Trophy } from "lucide-react";
import {
  AdminPageHeader, DataTable, MigrationBanner, StatusBadge,
} from "../ui";
import { PermissionGuard } from "../AdminLayout";
import {
  deleteSeoPage, fetchTurfsAdmin, isMissingSchemaError, listSeoPages, upsertSeoPage,
  type SeoPageRow,
} from "../admin-api";
import type { AdminRole } from "../admin-rbac";

type Tab = "global" | "pages" | "venues" | "technical";

export default function AdminSeo() {
  const { user } = useAuth();
  const myRole = (user?.role || "") as AdminRole;
  const canManage = myRole === "super_admin" || myRole === "content_admin";

  const [tab, setTab] = useState<Tab>("global");
  const [pages, setPages] = useState<SeoPageRow[]>([]);
  const [pagesMissing, setPagesMissing] = useState(false);
  const [turfs, setTurfs] = useState<{ rows: import("../admin-api").TurfRow[] }>({ rows: [] });

  // Global SEO draft (site_settings)
  const [global, setGlobal] = useState({ site_title_tagline: "", default_meta_description: "", canonical_domain: SITE_ORIGIN, robots_extra: "" });
  const [globalMissing, setGlobalMissing] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);

  // Page editor
  const [editing, setEditing] = useState<Partial<SeoPageRow> | null>(null);

  const load = () => {
    import("../admin-api").then(async ({ listSeoPages, fetchTurfsAdmin, getSiteSettings }) => {
      const p = await listSeoPages().catch(() => ({ rows: [], missingSchema: true }));
      setPages(p.rows);
      setPagesMissing(p.missingSchema);
      const t = await fetchTurfsAdmin().catch(() => ({ rows: [], missingSchema: false }));
      setTurfs({ rows: t.rows });
      const s = await getSiteSettings().catch(() => ({ settings: {}, missingSchema: true }));
      setGlobalMissing(s.missingSchema);
      setGlobal((g) => ({
        ...g,
        site_title_tagline: String(s.settings.seo_title_tagline ?? ""),
        default_meta_description: String(s.settings.seo_default_description ?? ""),
        canonical_domain: String(s.settings.seo_canonical_domain ?? SITE_ORIGIN),
        robots_extra: String(s.settings.seo_robots_extra ?? ""),
      }));
    });
  };
  useEffect(() => { load(); }, []);

  const saveGlobal = async () => {
    setSavingGlobal(true);
    try {
      const { updateSiteSetting } = await import("../admin-api");
      await updateSiteSetting("seo_title_tagline", global.site_title_tagline, myRole);
      await updateSiteSetting("seo_default_description", global.default_meta_description, myRole);
      await updateSiteSetting("seo_canonical_domain", global.canonical_domain, myRole);
      await updateSiteSetting("seo_robots_extra", global.robots_extra, myRole);
      toast.success("Global SEO settings saved (audit-logged). Applying them to the live site requires a deploy that reads site_settings.");
    } catch (e) {
      if (isMissingSchemaError(e)) toast.error("Run supabase_admin_rbac.sql first (site_settings missing).");
      else toast.error((e as Error).message || "Save failed");
    } finally {
      setSavingGlobal(false);
    }
  };

  const savePage = async () => {
    if (!editing) return;
    if (!editing.slug?.trim() || !editing.page_type) {
      toast.error("Page type and slug are required.");
      return;
    }
    try {
      await upsertSeoPage(
        {
          page_type: editing.page_type,
          slug: editing.slug.trim().toLowerCase(),
          title: editing.title || "",
          description: editing.description || "",
          h1: editing.h1 || "",
          content: editing.content || "",
          robots: editing.robots || "index",
          enabled: editing.enabled ?? true,
        },
        myRole
      );
      toast.success("SEO page saved (audit-logged)");
      setEditing(null);
      load();
    } catch (e) {
      if (isMissingSchemaError(e)) toast.error("Run supabase_admin_rbac.sql first (seo_pages missing).");
      else toast.error((e as Error).message || "Save failed");
    }
  };

  return (
    <PermissionGuard role={myRole} permission="seo.view">
      <AdminPageHeader
        title="SEO Management"
        subtitle={`Canonical origin: ${SITE_ORIGIN} — global defaults, landing-page overrides, venue metadata and technical status. Anti-doorway: pages without real data are noindexed automatically by the SEO system.`}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {([["global", "Global SEO", Globe], ["pages", "Location & Sport pages", MapPin], ["venues", "Venue SEO", MapPin], ["technical", "Technical SEO", Globe]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-black uppercase tracking-wider ${tab === key ? "bg-teal-400/10 text-teal-200 ring-1 ring-teal-400/25" : "border border-white/10 text-zinc-400 hover:bg-white/5"}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "global" && (
        <div className="max-w-2xl space-y-3 rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-5">
          {globalMissing && <MigrationBanner what="site_settings table is not installed — global SEO overrides cannot be stored." />}
          <p className="text-xs leading-relaxed text-zinc-400">
            These overrides are stored in <code className="text-teal-300">site_settings</code>. The shipped defaults
            (in <code className="text-zinc-500">src/lib/seo.ts</code> + index.html) apply until a deploy reads the
            overrides — nothing silently changes the live site.
          </p>
          {[
            { key: "site_title_tagline" as const, label: "Site title (index.html <title> override)", placeholder: "PlayTurf — Book Sports Turfs & Tournaments Near You" },
            { key: "default_meta_description" as const, label: "Default meta description", placeholder: "Book sports turfs, football grounds…" },
            { key: "canonical_domain" as const, label: "Canonical domain", placeholder: SITE_ORIGIN },
            { key: "robots_extra" as const, label: "Extra robots.txt rules", placeholder: "Disallow: /tmp/" },
          ].map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">{f.label}</span>
              <input
                value={String(global[f.key])}
                onChange={(e) => setGlobal({ ...global, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                disabled={globalMissing || !canManage}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40 disabled:opacity-40"
              />
            </label>
          ))}
          <button
            onClick={saveGlobal}
            disabled={globalMissing || !canManage || savingGlobal}
            className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" /> {savingGlobal ? "Saving…" : "Save global SEO"}
          </button>
        </div>
      )}

      {tab === "pages" && (
        <>
          {pagesMissing && <MigrationBanner what="seo_pages table is not installed — landing-page overrides cannot be stored." />}
          <div className="mb-3 flex justify-end">
            <button
              disabled={!canManage || pagesMissing}
              onClick={() => setEditing({ page_type: "location", slug: "", robots: "index", enabled: true })}
              className="rounded-xl bg-teal-500 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400 disabled:opacity-40"
            >
              New page override
            </button>
          </div>
          <DataTable
            rowKey={(r: SeoPageRow) => r.id}
            rows={pages}
            loading={false}
            columns={[
              { key: "type", header: "Type", render: (r) => <span className="text-[10px] font-black uppercase tracking-wider text-teal-300">{r.page_type}</span> },
              { key: "slug", header: "Slug", render: (r) => <span className="font-mono text-[11px] text-zinc-300">/{r.slug}</span> },
              { key: "title", header: "Title", render: (r) => <span className="block max-w-[240px] truncate text-xs text-zinc-200">{r.title || "—"}</span> },
              { key: "robots", header: "Indexing", render: (r) => <StatusBadge status={r.robots === "noindex" ? "draft" : "published"} /> },
              { key: "enabled", header: "Enabled", render: (r) => <span className="text-xs text-zinc-300">{r.enabled ? "Yes" : "No"}</span> },
              {
                key: "actions", header: "", className: "text-right",
                render: (r) => (
                  <div className="flex justify-end gap-1.5">
                    <button disabled={!canManage} onClick={() => setEditing(r)} className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-black uppercase text-zinc-300 hover:bg-white/5 disabled:opacity-40">Edit</button>
                    <button
                      disabled={!canManage}
                      onClick={async () => { try { await deleteSeoPage(r.id, myRole); toast.success("Override deleted"); load(); } catch (e) { toast.error((e as Error).message); } }}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-rose-400/25 text-rose-300 hover:bg-rose-400/10 disabled:opacity-40"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ),
              },
            ]}
            emptyLabel={pagesMissing ? "seo_pages table not installed yet." : "No landing-page overrides — the automatic data-driven pages are live."}
          />
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
            Overrides layer on top of the automatic pages built from real venue data (see /turfs, /sports). Overrides
            never create pages for cities or sports without venues — the anti-doorway guard always wins.
          </p>
        </>
      )}

      {tab === "venues" && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            Venue metadata is generated from real venue fields (name, city, sports, price, facilities). Edit the
            underlying venue data in Venue Management; the schema and meta tags update automatically.
          </p>
          <DataTable
            rowKey={(r: import("../admin-api").TurfRow) => r.id}
            rows={turfs.rows.slice(0, 50)}
            columns={[
              { key: "venue", header: "Venue", render: (r) => <span className="text-xs font-bold text-zinc-100">{r.name}</span> },
              { key: "url", header: "Canonical URL", render: (r) => <span className="font-mono text-[10px] text-zinc-400">{absoluteUrl(`/turf/${r.id}`).replace(/^https?:\/\//, "")}/…</span> },
              { key: "schema", header: "Schema", render: () => <span className="text-[10px] font-bold text-emerald-300">SportsActivityLocation</span> },
              {
                key: "link", header: "", className: "text-right",
                render: (r) => (
                  <a href={`/turf/${r.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-300 hover:underline">
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                ),
              },
            ]}
            emptyLabel="No venues."
          />
        </div>
      )}

      {tab === "technical" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Sitemap</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Regenerated on every deploy from live venue data by <code className="text-teal-300">scripts/generate-sitemap.mjs</code>.
              Cities, sport×city pages and venue slugs are included only when real data exists.
            </p>
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-300 hover:underline">
              Open sitemap.xml <ExternalLink className="h-3 w-3" />
            </a>
            <h3 className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">robots.txt</h3>
            <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-300 hover:underline">
              Open robots.txt <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Structured data (live preview)</h3>
            <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-black/40 p-3 text-[10px] leading-relaxed text-teal-200/80">{JSON.stringify({
              "@context": "https://schema.org",
              Organization: "in index.html (site-wide)",
              WebSite: "in index.html (site-wide)",
              BreadcrumbList: "per page via useSeo",
              SportsActivityLocation: "per venue with real data only",
              Article: "blog guides",
            }, null, 2)}</pre>
            <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
              Search Console reporting hooks in only after the property is verified (VITE_GSC_VERIFICATION) — no
              traffic numbers are shown here until that authorization exists.
            </p>
          </div>
        </div>
      )}

      {/* Page override editor */}
      {editing && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101312] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white">Landing page override</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Page type</span>
                <select value={editing.page_type} onChange={(e) => setEditing({ ...editing, page_type: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none">
                  <option value="location">Location (city/locality)</option>
                  <option value="sport">Sport</option>
                  <option value="location_sport">Location × Sport</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Slug (e.g. bangalore)</span>
                <input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">SEO title</span>
                <input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Meta description</span>
                <input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">H1</span>
                <input value={editing.h1 || ""} onChange={(e) => setEditing({ ...editing, h1: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Indexing</span>
                <select value={editing.robots || "index"} onChange={(e) => setEditing({ ...editing, robots: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none">
                  <option value="index">index, follow</option>
                  <option value="noindex">noindex, follow</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Unique page content (factual only — no generated filler)</span>
                <textarea value={editing.content || ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} rows={4} className="w-full rounded-xl border border-white/10 bg-[#0a0c0b] p-3 text-sm text-zinc-100 outline-none" />
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={editing.enabled ?? true} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} className="h-4 w-4 accent-teal-500" />
                Enabled
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5">Cancel</button>
              <button onClick={savePage} className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400">
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
}
