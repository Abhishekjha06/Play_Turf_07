import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Plus, Save, Trash2, Upload, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import type { Banner, Booking, Offer, Tournament, Turf } from "@/data/seed";
import { cn } from "@/lib/utils";
import { getLockedAccounts, resetLockout, getTimeUntilUnlocked, formatTimeRemaining } from "@/lib/admin-attempt-tracker";

type Tab = "dashboard" | "turfs" | "banners" | "offers" | "tournaments" | "bookings" | "security";
const tabs: Tab[] = ["dashboard", "turfs", "banners", "offers", "tournaments", "bookings", "security"];

const splitList = (value: string) => value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
const joinList = (value?: string[]) => (value || []).join(", ");

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [lockedAccounts, setLockedAccounts] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && (!user || !user.is_admin)) navigate("/");
  }, [user, loading, navigate]);

  const refresh = async () => {
    const [t, b, o, tn, bk] = await Promise.all([
      api.listTurfs(),
      api.listBanners(),
      api.listOffers(),
      api.listTournaments(),
      api.admin.listAllBookings(),
    ]);
    setTurfs(t);
    setBanners(b);
    setOffers(o);
    setTournaments(tn);
    setBookings(bk);
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Update locked accounts when security tab is opened
  useEffect(() => {
    if (tab === "security") {
      setLockedAccounts(getLockedAccounts());
    }
  }, [tab]);

  const addTurf = async () => {
    const turf = await api.admin.addTurf({
      name: "New Turf",
      city: "Bangalore",
      address: "Indiranagar, Bangalore",
      sport_types: ["Cricket"],
      timing: "06:00 AM - 11:00 PM",
      description: "Premium sports turf.",
      amenities: ["Floodlights", "Parking"],
      gallery: [],
      videos: [],
    });
    toast.success("Turf added");
    await refresh();
    setEditingId(turf.id);
  };

  const exportTurfs = () => {
    const headers = ["id", "name", "city", "address", "lat", "lng", "category", "timing", "about", "amenities", "price_per_hour", "gallery", "videos"];
    const rows = turfs.map((turf) => [
      turf.id,
      turf.name,
      turf.city,
      turf.address,
      String(turf.lat ?? ""),
      String(turf.lng ?? ""),
      joinList(turf.sport_types),
      turf.timing,
      turf.description,
      joinList(turf.amenities),
      String(turf.price_per_hour),
      joinList(turf.gallery),
      joinList(turf.videos),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "play-turf-values.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importTurfs = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(headerLine);
    for (const line of lines) {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
      const patch: Partial<Turf> = {
        name: row.name,
        city: row.city,
        address: row.address,
        lat: row.lat ? Number(row.lat) : undefined,
        lng: row.lng ? Number(row.lng) : undefined,
        sport_types: splitList(row.category),
        timing: row.timing,
        description: row.about,
        amenities: splitList(row.amenities),
        price_per_hour: Number(row.price_per_hour || 1000),
        gallery: splitList(row.gallery),
        videos: splitList(row.videos),
      };
      if (row.id && turfs.some((turf) => turf.id === row.id)) {
        await api.admin.updateTurf(row.id, patch);
      } else {
        await api.admin.addTurf(patch);
      }
    }
    event.target.value = "";
    toast.success("Excel/CSV values imported");
    await refresh();
  };

  return (
    <MobileShell>
      <header className="sticky top-0 z-30 glass flex items-center gap-3 px-4 py-3">
        <BackButton />
        <div className="flex-1">
          <h1 className="font-display font-bold">Admin Panel</h1>
          <p className="text-[11px] text-muted2">Signed in: {user?.email}</p>
        </div>
      </header>

      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto px-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold capitalize",
              tab === t ? "border-primary bg-primary text-primary-foreground shadow-neon" : "border-white/5 bg-panel-2 text-soft",
            )}
            data-testid={`admin-tab-${t}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3 px-4 pb-12">
        {tab === "dashboard" && (
          <Dashboard turfs={turfs} bookings={bookings} offers={offers} tournaments={tournaments} />
        )}

        {tab === "turfs" && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <AdminButton label="Add Turf" icon={Plus} onClick={addTurf} />
              <AdminButton label="Export Excel" icon={Download} onClick={exportTurfs} />
              <AdminButton label="Import" icon={Upload} onClick={() => fileInputRef.current?.click()} />
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importTurfs} />
            </div>
            {turfs.map((turf) =>
              editingId === turf.id ? (
                <TurfEditor key={turf.id} turf={turf} onDone={() => { setEditingId(null); void refresh(); }} />
              ) : (
                <Row
                  key={turf.id}
                  img={turf.image}
                  title={turf.name}
                  sub={`${turf.address} · Rs ${turf.price_per_hour}/hr`}
                  onEdit={() => setEditingId(turf.id)}
                  onDelete={async () => {
                    await api.admin.deleteTurf(turf.id);
                    toast.success("Turf deleted");
                    refresh();
                  }}
                />
              ),
            )}
          </>
        )}

        {tab === "banners" && <SimpleList items={banners} kind="banner" refresh={refresh} />}
        {tab === "offers" && <SimpleList items={offers} kind="offer" refresh={refresh} />}
        {tab === "tournaments" && <SimpleList items={tournaments} kind="tournament" refresh={refresh} />}
        {tab === "bookings" && (
          <>
            {bookings.length === 0 && <p className="py-10 text-center text-sm text-muted2">No bookings yet.</p>}
            {bookings.map((b) => (
              <div key={b.id} className="card-panel flex items-center gap-3 rounded-2xl p-3">
                <img src={b.turf_image} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold">{b.turf_name}</p>
                  <p className="text-[11px] text-muted2">{b.date} · {b.start_time} · {b.status}</p>
                </div>
                <p className="neon-text text-sm font-bold">Rs {b.amount}</p>
              </div>
            ))}
          </>
        )}

        {tab === "security" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-panel-2/80 border border-white/10 p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Admin Account Protection
              </h3>
              <p className="text-xs text-muted2 mb-4">
                Admin accounts are protected with 2-attempt password limit. After 2 failed attempts, the account locks for 5 minutes.
              </p>
            </div>

            {lockedAccounts.length === 0 ? (
              <div className="text-center py-8">
                <Unlock className="w-6 h-6 mx-auto mb-2 text-green-400" />
                <p className="text-sm text-muted2">No locked accounts</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted2">Locked Accounts ({lockedAccounts.length})</p>
                {lockedAccounts.map((email) => (
                  <div key={email} className="flex items-center justify-between gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-red-400 truncate">{email}</p>
                      <p className="text-xs text-muted2">
                        Unlocks in {Math.ceil(getTimeUntilUnlocked(email) / 1000)} seconds
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        resetLockout(email);
                        setLockedAccounts(getLockedAccounts());
                        toast.success(`${email} unlocked`);
                      }}
                      className="shrink-0 px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/30 pressable"
                    >
                      Unlock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MobileShell>
  );
};

function TurfEditor({ turf, onDone }: { turf: Turf; onDone: () => void }) {
  const [form, setForm] = useState({
    name: turf.name,
    city: turf.city,
    address: turf.address,
    category: joinList(turf.sport_types),
    timing: turf.timing,
    about: turf.description,
    amenities: joinList(turf.amenities),
    price: String(turf.price_per_hour),
    lat: String(turf.lat ?? ""),
    lng: String(turf.lng ?? ""),
    gallery: joinList(turf.gallery),
    videos: joinList(turf.videos),
  });
  const [image, setImage] = useState(turf.image);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setImage(dataUrl);
  };

  const handleGallery = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const urls = await Promise.all(files.map(fileToDataUrl));
    update("gallery", [...splitList(form.gallery), ...urls].join(", "));
  };

  const save = async () => {
    await api.admin.updateTurf(turf.id, {
      name: form.name,
      city: form.city,
      address: form.address,
      lat: form.lat ? Number(form.lat) : undefined,
      lng: form.lng ? Number(form.lng) : undefined,
      image,
      sport_types: splitList(form.category),
      timing: form.timing,
      description: form.about,
      amenities: splitList(form.amenities),
      price_per_hour: Number(form.price || 1000),
      gallery: splitList(form.gallery),
      videos: splitList(form.videos),
    });
    toast.success("Turf updated");
    onDone();
  };

  return (
    <div className="card-panel space-y-3 rounded-3xl p-4">
      <div className="flex items-center gap-3">
        <img src={image} alt="" loading="lazy" decoding="async" className="h-16 w-16 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Edit Turf</p>
          <p className="text-xs text-muted2">Only admin can change these values.</p>
        </div>
      </div>

      <Field label="Name" value={form.name} onChange={(v) => update("name", v)} />
      <Field label="City" value={form.city} onChange={(v) => update("city", v)} />
      <Field label="Address" value={form.address} onChange={(v) => update("address", v)} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Latitude" value={form.lat} onChange={(v) => update("lat", v)} />
        <Field label="Longitude" value={form.lng} onChange={(v) => update("lng", v)} />
      </div>
      <Field label="Category" value={form.category} onChange={(v) => update("category", v)} placeholder="Cricket, Football" />
      <Field label="Timings" value={form.timing} onChange={(v) => update("timing", v)} />
      <Field label="About" value={form.about} onChange={(v) => update("about", v)} multiline />
      <Field label="Amenities" value={form.amenities} onChange={(v) => update("amenities", v)} multiline placeholder="Floodlights, Parking, Washroom" />
      <Field label="Price per hour" value={form.price} onChange={(v) => update("price", v)} />
      <Field label="Gallery URLs" value={form.gallery} onChange={(v) => update("gallery", v)} multiline />
      <Field label="Video URLs" value={form.videos} onChange={(v) => update("videos", v)} multiline placeholder="https://..." />

      <div className="grid grid-cols-2 gap-2">
        <label className="pressable rounded-2xl border border-white/10 bg-panel-2 px-3 py-3 text-center text-xs font-semibold">
          Main Photo
          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </label>
        <label className="pressable rounded-2xl border border-white/10 bg-panel-2 px-3 py-3 text-center text-xs font-semibold">
          Add Gallery Photos
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleGallery} />
        </label>
      </div>

      <div className="flex gap-2">
        <button onClick={save} className="pressable inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-neon">
          <Save className="h-4 w-4" /> Save
        </button>
        <button onClick={onDone} className="pressable flex-1 rounded-full border border-white/10 bg-panel-2 py-3 font-semibold">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Dashboard({ turfs, bookings, offers, tournaments }: { turfs: Turf[]; bookings: Booking[]; offers: Offer[]; tournaments: Tournament[] }) {
  const confirmed = bookings.filter((booking) => booking.status === "CONFIRMED");
  const revenue = confirmed.reduce((sum, booking) => sum + booking.amount, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = bookings.filter((booking) => booking.date === today).length;
  const popular = [...turfs].sort((a, b) => b.rating - a.rating)[0];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 px-4 md:px-8 lg:px-10 ml-3 md:ml-6">
        <StatCard label="Turfs" value={String(turfs.length)} />
        <StatCard label="Revenue" value={`Rs ${revenue}`} />
        <StatCard label="Today" value={`${todayBookings} bookings`} />
        <StatCard label="Offers" value={String(offers.length)} />
      </div>
      <div className="card-panel rounded-3xl p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Top Rated Turf</p>
        <p className="mt-1 text-lg font-bold">{popular?.name ?? "No turfs"}</p>
        <p className="text-sm text-soft">{popular ? `${popular.address} · ${popular.rating} rating` : "Add a turf to get started."}</p>
      </div>
      <div className="card-panel rounded-3xl p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Operations</p>
        <p className="mt-1 text-sm text-soft">{tournaments.length} tournaments live, {confirmed.length} confirmed bookings.</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-panel rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted2">{label}</p>
      <p className="mt-1 text-xl font-black neon-text">{value}</p>
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

function AdminButton({ label, icon: Icon, onClick }: { label: string; icon: typeof Plus; onClick: () => void }) {
  return (
    <button onClick={onClick} className="pressable inline-flex min-h-12 items-center justify-center gap-1 rounded-2xl bg-primary px-2 text-xs font-semibold text-primary-foreground shadow-neon">
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function Row({ img, title, sub, onEdit, onDelete }: { img: string; title: string; sub: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="card-panel flex items-center gap-3 rounded-2xl p-3">
      <img src={img} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-xl object-cover" />
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="line-clamp-1 text-sm font-semibold">{title}</p>
        <p className="line-clamp-1 text-[11px] text-muted2">{sub}</p>
      </button>
      <button onClick={onDelete} className="pressable grid h-9 w-9 place-items-center rounded-full bg-destructive/15 text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function SimpleList({ items, kind, refresh }: { items: Array<Banner | Offer | Tournament>; kind: "banner" | "offer" | "tournament"; refresh: () => Promise<void> }) {
  const add = async () => {
    const title = prompt(`${kind} title?`);
    if (!title) return;
    if (kind === "banner") await api.admin.addBanner({ title, highlight: title.split(" ")[0], subtitle: "New banner" });
    if (kind === "offer") await api.admin.addOffer({ title, badge: "DEAL", subtitle: "" });
    if (kind === "tournament") await api.admin.addTournament({ name: title });
    toast.success(`${kind} added`);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm(`Delete this ${kind}?`)) return;
    if (kind === "banner") await api.admin.deleteBanner(id);
    if (kind === "offer") await api.admin.deleteOffer(id);
    if (kind === "tournament") await api.admin.deleteTournament(id);
    toast.success(`${kind} deleted`);
    refresh();
  };

  return (
    <>
      <button onClick={add} className="pressable inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-neon">
        <Plus className="h-4 w-4" /> Add {kind}
      </button>
      {items.map((item) => (
        <div key={item.id} className="card-panel flex items-center gap-3 rounded-2xl p-3">
          <img src={item.image} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-semibold">{"title" in item ? item.title : item.name}</p>
            <p className="line-clamp-1 text-[11px] text-muted2">{"subtitle" in item ? item.subtitle : item.date}</p>
          </div>
          <button onClick={() => remove(String(item.id))} className="pressable h-8 w-8 rounded-full grid place-items-center text-red-400 hover:bg-red-400/10 transition-colors" aria-label={`Delete ${kind}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </>
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

function csvCell(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function parseCsvLine(line: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

export default Admin;
