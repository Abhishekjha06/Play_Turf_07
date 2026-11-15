import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { EventBanner } from "@/lib/api/eventBanners";

type EventBannerManagerProps = {
  banners: EventBanner[];
  refresh: () => Promise<void>;
};

/**
 * Admin manager for the home-header Events Banner area: upload PNG banners,
 * activate/hide, delete and drag-to-reorder. Active banners appear on Home
 * automatically — no frontend change required.
 */
export function EventBannerManager({ banners, refresh }: EventBannerManagerProps) {
  const [adding, setAdding] = useState(false);
  const [order, setOrder] = useState<EventBanner[]>(banners);
  const orderRef = useRef(order);
  orderRef.current = order;

  useEffect(() => {
    setOrder(banners);
  }, [banners]);

  const commitOrder = async () => {
    try {
      await api.admin.reorderEventBanners(orderRef.current.map((b) => b.id));
      toast.success("Banner order updated");
      await refresh();
    } catch (err) {
      toast.error(bannerError(err, "Could not save the new banner order"));
      await refresh(); // resync the list with the stored order
    }
  };

  const toggleStatus = async (banner: EventBanner) => {
    const next = banner.status === "active" ? "inactive" : "active";
    try {
      await api.admin.updateEventBanner(banner.id, { status: next });
      toast.success(next === "active" ? "Banner is live on Home" : "Banner hidden from Home");
      await refresh();
    } catch (err) {
      toast.error(bannerError(err, "Could not update the banner status"));
    }
  };

  const removeBanner = async (id: string) => {
    if (!confirm("Delete this event banner?")) return;
    try {
      await api.admin.deleteEventBanner(id);
      toast.success("Banner deleted");
      await refresh();
    } catch (err) {
      toast.error(bannerError(err, "Could not delete the banner"));
    }
  };

  return (
    <div className="space-y-3">
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="pressable inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-neon"
        >
          <Plus className="h-4 w-4" /> Add Event Banner
        </button>
      )}

      {adding && (
        <EventBannerEditor
          nextOrder={banners.length}
          onDone={async () => {
            setAdding(false);
            await refresh();
          }}
        />
      )}

      {order.length === 0 && !adding && (
        <p className="py-10 text-center text-sm text-muted2">
          No event banners yet. Upload the first PNG — it goes live on Home instantly.
        </p>
      )}

      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-3">
        {order.map((banner, idx) => (
          <EventBannerRow
            key={banner.id}
            banner={banner}
            index={idx}
            onToggleStatus={() => toggleStatus(banner)}
            onDelete={() => removeBanner(banner.id)}
            onDragEnd={commitOrder}
          />
        ))}
      </Reorder.Group>
    </div>
  );
}

function EventBannerRow({
  banner,
  index,
  onToggleStatus,
  onDelete,
  onDragEnd,
}: {
  banner: EventBanner;
  index: number;
  onToggleStatus: () => void;
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
      <img src={banner.image_url} alt="" loading="lazy" decoding="async" draggable={false} className="h-12 w-20 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold">{banner.title || "Event banner"}</p>
        <button
          type="button"
          onClick={onToggleStatus}
          className={`mt-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider cursor-pointer ${
            banner.status === "active"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-white/10 bg-white/5 text-muted2"
          }`}
        >
          {banner.status === "active" ? "● Live on Home" : "○ Hidden"}
        </button>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete event banner"
        className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </Reorder.Item>
  );
}

function EventBannerEditor({ nextOrder, onDone }: { nextOrder: number; onDone: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      toast.error("Event banners must be PNG images.");
      event.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const url = await api.admin.uploadEventBannerImage(file);
      setImage(url);
      toast.success("Image uploaded");
    } catch {
      // Storage bucket not provisioned yet — keep the feature usable with an inline data URL.
      const dataUrl = await fileToDataUrl(file);
      setImage(dataUrl);
      toast.warning("Stored inline. Run supabase_event_banners.sql to enable proper image uploads.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const save = async () => {
    if (!image) {
      toast.error("Upload a PNG banner first");
      return;
    }
    setSaving(true);
    try {
      await api.admin.addEventBanner({
        title: title.trim() || undefined,
        image_url: image,
        display_order: nextOrder,
      });
      toast.success("Event banner is live on Home");
      await onDone();
    } catch (err) {
      toast.error(bannerError(err, "Could not save the event banner"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-panel space-y-3 rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">New Event Banner</p>
          <p className="text-xs text-muted2">PNG only — shown in the Home header area, auto-rotated. Recommended size 960 × 600 px (16:10); keep text/logo centered, top &amp; bottom ~100 px calm.</p>
        </div>
        <button
          type="button"
          onClick={() => onDone()}
          aria-label="Cancel"
          className="pressable grid h-8 w-8 place-items-center rounded-full bg-white/5 text-muted2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">PNG image</span>
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
            No image uploaded yet
          </div>
        )}
        <label className="pressable mt-2 block cursor-pointer rounded-2xl border border-white/10 bg-panel-2 py-3 text-center text-xs font-semibold">
          {uploading ? "Uploading…" : "Upload PNG"}
          <input type="file" accept="image/png" className="hidden" onChange={handleImage} disabled={uploading} />
        </label>
      </div>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Title (optional, admin label)</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Weekend Football Cup"
          className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </label>

      <button
        onClick={save}
        disabled={saving || uploading || !image}
        className="pressable inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-neon disabled:opacity-60"
      >
        <Save className="h-4 w-4" /> Publish banner
      </button>
    </div>
  );
}

/** Friendlier message when the event_banners table/bucket hasn't been provisioned yet. */
function bannerError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : "";
  if (/event_banners/i.test(msg)) {
    return "Run supabase_event_banners.sql in the Supabase dashboard first.";
  }
  return msg || fallback;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
