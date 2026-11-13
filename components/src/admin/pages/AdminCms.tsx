/**
 * /admin/cms — content & marketing: banners (reuses BannerManager), blog
 * guides (static, read-only until the DB-backed CMS migration), and the push
 * notification composer (ported from the legacy admin, same real
 * lib/notifications pipeline).
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import {
  addNotification, adminCreateNotification, adminDeleteNotification, adminEditNotification,
  getNotifications, type AppNotification, type NotificationType,
} from "@/lib/notifications";
import { blogPosts } from "@/data/blogPosts";
import { toast } from "sonner";
import { Bell, FileText, Image, Loader2, Plus, Trash2 } from "lucide-react";
import { AdminPageHeader, DataTable, StatusBadge } from "../ui";
import { PermissionGuard } from "../AdminLayout";
import { BannerManager } from "@/pages/admin/BannerManager";
import type { Banner } from "@/data/seed";
import type { AdminRole } from "../admin-rbac";

type Tab = "banners" | "blog" | "notifications";

export default function AdminCms() {
  const { user } = useAuth();
  const myRole = (user?.role || "") as AdminRole;
  const [tab, setTab] = useState<Tab>("banners");

  return (
    <PermissionGuard role={myRole} permission="cms.view">
      <AdminPageHeader
        title="Content & Marketing"
        subtitle="Homepage banners, editorial guides and push notifications. All content is served from real storage — previews are shown before publishing."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {([["banners", "Banners", Image], ["blog", "Blog & Guides", FileText], ["notifications", "Push Notifications", Bell]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-black uppercase tracking-wider ${tab === key ? "bg-teal-400/10 text-teal-200 ring-1 ring-teal-400/25" : "border border-white/10 text-zinc-400 hover:bg-white/5"}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "banners" && <BannersTab myRole={myRole} />}
      {tab === "blog" && <BlogTab />}
      {tab === "notifications" && <NotificationsTab />}
    </PermissionGuard>
  );
}

// ── Banners ────────────────────────────────────────────────────────────────

function BannersTab({ myRole }: { myRole: AdminRole }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api
      .listBanners()
      .then(setBanners)
      .catch((e) => toast.error((e as Error).message || "Failed to load banners"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="grid place-items-center rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-16"><Loader2 className="h-6 w-6 animate-spin text-teal-300" /></div>;
  }
  return (
    <div className="admin-legacy-banner-host rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-4">
      <BannerManager banners={banners} refresh={load} />
    </div>
  );
}

// ── Blog (static editorial content) ────────────────────────────────────────

function BlogTab() {
  return (
    <div className="space-y-3">
      <p className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-3.5 text-xs leading-relaxed text-sky-200/90">
        Guides are compiled into the app (<code className="text-[11px]">src/data/blogPosts.ts</code>) so they render
        fully prerendered for crawlers. Editing requires a code release until the DB-backed CMS migration ships — the
        panel will not pretend to edit static content.
      </p>
      <DataTable
        rowKey={(p) => p.slug}
        rows={blogPosts}
        columns={[
          { key: "title", header: "Guide", render: (p) => <span className="text-xs font-bold text-zinc-100">{p.title}</span> },
          { key: "slug", header: "URL", render: (p) => <span className="font-mono text-[10px] text-zinc-400">/blog/{p.slug}</span> },
          { key: "status", header: "Status", render: () => <StatusBadge status="published" /> },
          { key: "updated", header: "Published", render: (p) => <span className="text-[11px] text-zinc-400">{p.datePublished}</span> },
          {
            key: "view", header: "", className: "text-right",
            render: (p) => <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-teal-300 hover:underline">Preview ↗</a>,
          },
        ]}
      />
    </div>
  );
}

// ── Push notifications (real lib/notifications pipeline) ──────────────────

function NotificationsTab() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NotificationType>("promotional_offer");
  const [deepLink, setDeepLink] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = () => setItems(getNotifications().filter((n) => n.type !== "booking_confirmed" && n.type !== "booking_cancelled" && n.type !== "booking_reminder"));
  useEffect(() => { load(); }, []);

  const submit = () => {
    if (title.trim().length < 3 || body.trim().length < 3) {
      toast.error("Title and message are required.");
      return;
    }
    const payload = {
      title: title.trim(),
      body: body.trim(),
      type,
      deepLink: deepLink.trim() || undefined,
      targetAudience: "All Users",
    } as Omit<AppNotification, "id" | "timestamp" | "isRead">;
    if (editingId) {
      adminEditNotification(editingId, payload);
      toast.success("Notification updated");
    } else {
      adminCreateNotification(payload);
      toast.success("Notification published to user devices");
    }
    setTitle(""); setBody(""); setDeepLink(""); setEditingId(null);
    load();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-5">
        <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
          {editingId ? "Edit notification" : "Compose notification"}
        </h3>
        <div className="mt-3 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Weekend Football Offer)"
            className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message shown on user devices" rows={3}
            className="w-full rounded-xl border border-white/10 bg-[#0a0c0b] p-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40" />
          <div className="grid grid-cols-2 gap-3">
            <select value={type} onChange={(e) => setType(e.target.value as NotificationType)} className="h-10 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-xs text-zinc-100 outline-none">
              <option value="promotional_offer">Promotional offer</option>
              <option value="discount_coupon">Discount coupon</option>
              <option value="tournament_announcement">Tournament announcement</option>
              <option value="new_turf_launch">New turf launch</option>
              <option value="maintenance_notice">Maintenance notice</option>
              <option value="system_announcement">System announcement</option>
              <option value="feature_update">Feature update</option>
            </select>
            <input value={deepLink} onChange={(e) => setDeepLink(e.target.value)} placeholder="Deep link (e.g. /offers)"
              className="h-10 rounded-xl border border-white/10 bg-[#0a0c0b] px-3 text-sm text-zinc-100 outline-none focus:border-teal-400/40" />
          </div>

          {/* Live preview */}
          <div className="rounded-2xl border border-teal-400/20 bg-teal-400/[0.04] p-3.5">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-300/70">Preview</p>
            <p className="mt-1.5 text-sm font-black text-white">{title || "Notification title"}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{body || "Message body preview…"}</p>
            {deepLink && <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-teal-300">→ {deepLink}</p>}
          </div>

          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 rounded-xl bg-teal-500 py-2.5 text-[11px] font-black uppercase tracking-wider text-[#04110e] hover:bg-teal-400">
              {editingId ? "Update" : "Publish now"}
            </button>
            {editingId && (
              <button onClick={() => { setEditingId(null); setTitle(""); setBody(""); setDeepLink(""); }}
                className="rounded-xl border border-white/10 px-4 text-xs font-bold text-zinc-300 hover:bg-white/5">
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-[#0d0f0e] p-5">
        <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">History ({items.length})</h3>
        {items.length === 0 && <p className="py-10 text-center text-xs text-zinc-500">No notifications sent yet.</p>}
        <ul className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">
          {items.map((n) => (
            <li key={n.id} className="rounded-xl border border-white/[0.06] bg-[#0a0c0b] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-teal-300">{String(n.type).replace(/_/g, " ")}</span>
                  <p className="mt-1 truncate text-xs font-bold text-zinc-100">{n.title}</p>
                  <p className="line-clamp-2 text-[11px] text-zinc-500">{n.body}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => { setEditingId(n.id); setTitle(n.title); setBody(n.body); setType(n.type as NotificationType); setDeepLink(n.deepLink || ""); }}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-zinc-300 hover:bg-white/5">Edit</button>
                  <button
                    onClick={() => { adminDeleteNotification(n.id); load(); }}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-rose-400/25 text-rose-300 hover:bg-rose-400/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
