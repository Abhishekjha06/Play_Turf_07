import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Banner } from "@/data/seed";

type BannerManagerProps = {
  banners: Banner[];
  refresh: () => Promise<void>;
};

/**
 * Admin manager for the homepage hero banner slides:
 * add, edit (incl. image upload), delete and drag-to-reorder.
 */
export function BannerManager({ banners, refresh }: BannerManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [order, setOrder] = useState<Banner[]>(banners);
  const orderRef = useRef(order);
  orderRef.current = order;

  useEffect(() => {
    setOrder(banners);
  }, [banners]);

  const addSlide = async () => {
    try {
      const banner = await api.admin.addBanner({
        title: "New Slide",
        highlight: "Slide",
        subtitle: "",
        badge: "NEW",
        cta_text: "Explore",
        cta_link: "/",
        order: banners.length,
      });
      toast.success("Slide added");
      await refresh();
      setEditingId(banner.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the slide");
    }
  };

  const commitOrder = async () => {
    try {
      await api.admin.reorderBanners(orderRef.current.map((b) => b.id));
      toast.success("Slide order updated");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the new slide order");
      await refresh(); // resync the list with the stored order
    }
  };

  const removeSlide = async (id: string) => {
    if (!confirm("Delete this banner slide?")) return;
    try {
      await api.admin.deleteBanner(id);
      if (editingId === id) setEditingId(null);
      toast.success("Slide deleted");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the slide");
    }
  };

  const editing = banners.find((b) => b.id === editingId);

  return (
    <div className="space-y-3">
      <button onClick={addSlide} className="pressable inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-neon">
        <Plus className="h-4 w-4" /> Add Slide
      </button>

      {editing && <BannerEditor banner={editing} onDone={() => setEditingId(null)} />}

      {order.length === 0 && (
        <p className="py-10 text-center text-sm text-muted2">No slides yet. Add the first banner slide.</p>
      )}

      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-3">
        {order.map((banner, idx) => (
          <BannerRow
            key={banner.id}
            banner={banner}
            index={idx}
            onEdit={() => setEditingId(banner.id)}
            onDelete={() => removeSlide(banner.id)}
            onDragEnd={commitOrder}
          />
        ))}
      </Reorder.Group>
    </div>
  );
}

function BannerRow({
  banner,
  index,
  onEdit,
  onDelete,
  onDragEnd,
}: {
  banner: Banner;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={banner}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className="card-panel flex items-center gap-3 rounded-2xl p-3"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        onPointerDown={(e) => controls.start(e)}
        className="pressable grid h-9 w-9 shrink-0 cursor-grab touch-none place-items-center rounded-full bg-white/5 text-muted2"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-4 shrink-0 text-center text-xs font-bold text-muted2">{index + 1}</span>
      <img src={banner.image} alt="" loading="lazy" decoding="async" draggable={false} className="h-12 w-12 rounded-xl object-cover" />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="line-clamp-1 text-sm font-semibold">
          {banner.badge} · {banner.title}
        </p>
        <p className="line-clamp-1 text-[11px] text-muted2">{banner.subtitle || banner.cta_link}</p>
      </button>
      <button type="button" onClick={onDelete} aria-label="Delete slide" className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </Reorder.Item>
  );
}

function BannerEditor({ banner, onDone }: { banner: Banner; onDone: () => void }) {
  const [form, setForm] = useState({
    badge: banner.badge,
    title: banner.title,
    highlight: banner.highlight,
    subtitle: banner.subtitle,
    cta_text: banner.cta_text,
    cta_link: banner.cta_link,
  });
  const [image, setImage] = useState(banner.image);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await api.admin.uploadBannerImage(file);
      setImage(url);
      toast.success("Image uploaded");
    } catch {
      // Storage bucket not provisioned yet — keep the feature usable with an inline data URL.
      const dataUrl = await fileToDataUrl(file);
      setImage(dataUrl);
      toast.warning("Stored inline. Run supabase_banner_admin.sql to enable proper image uploads.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      await api.admin.updateBanner(banner.id, {
        badge: form.badge.trim() || "NEW",
        title: form.title.trim(),
        highlight: form.highlight.trim(),
        subtitle: form.subtitle,
        cta_text: form.cta_text.trim() || "Explore",
        cta_link: form.cta_link.trim() || "/",
        image,
      });
      toast.success("Slide updated");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the slide");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-panel space-y-3 rounded-3xl p-4">
      <div>
        <p className="font-semibold">Edit Slide</p>
        <p className="text-xs text-muted2">Shown in the homepage hero carousel.</p>
      </div>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Image</span>
        {image ? (
          <div className="relative mt-1 h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <img src={image} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setImage("")}
              aria-label="Remove image"
              className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white cursor-pointer border-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-1 grid h-32 w-full place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20 text-xs text-muted2">
            No image — a placeholder is used until one is set
          </div>
        )}
        <label className="pressable mt-2 block cursor-pointer rounded-2xl border border-white/10 bg-panel-2 py-3 text-center text-xs font-semibold">
          {uploading ? "Uploading…" : "Upload Image"}
          <input type="file" accept="image/*" className="hidden" onChange={handleImage} disabled={uploading} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Badge" value={form.badge} onChange={(v) => update("badge", v)} placeholder="NEW" />
        <Field label="CTA Text" value={form.cta_text} onChange={(v) => update("cta_text", v)} placeholder="Explore" />
      </div>
      <Field label="Title" value={form.title} onChange={(v) => update("title", v)} />
      <Field label="Highlight" value={form.highlight} onChange={(v) => update("highlight", v)} placeholder="A word inside the title to colorize" />
      <Field label="Subtitle" value={form.subtitle} onChange={(v) => update("subtitle", v)} multiline />
      <Field label="CTA Link" value={form.cta_link} onChange={(v) => update("cta_link", v)} placeholder="/tournaments" />

      <div className="flex gap-2">
        <button onClick={save} disabled={saving || uploading} className="pressable inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-neon disabled:opacity-60">
          <Save className="h-4 w-4" /> Save
        </button>
        <button onClick={onDone} className="pressable flex-1 rounded-full border border-white/10 bg-panel-2 py-3 font-semibold">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="mt-1 w-full rounded-2xl border border-white/10 bg-background px-3 py-3 text-sm outline-none focus:border-primary" />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-background px-3 text-sm outline-none focus:border-primary" />
      )}
    </label>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
