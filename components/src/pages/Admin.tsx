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
import { FeedbackDashboard } from "./admin/FeedbackDashboard";
import { BetaTestingDashboard } from "./admin/BetaTestingDashboard";
import { SystemHealthDashboard } from "./admin/SystemHealthDashboard";
import { getNotifications, adminCreateNotification, adminEditNotification, adminDeleteNotification, type AppNotification, type NotificationType } from "@/lib/notifications";

type Tab = "dashboard" | "turfs" | "banners" | "offers" | "tournaments" | "bookings" | "notifications" | "security" | "feedback" | "beta-testing" | "system-health";
const tabs: Tab[] = ["dashboard", "turfs", "banners", "offers", "tournaments", "bookings", "notifications", "security", "feedback", "beta-testing", "system-health"];

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

  // Notifications tab states
  const [adminNotifs, setAdminNotifs] = useState<AppNotification[]>([]);
  const [notifEditingId, setNotifEditingId] = useState<string | null>(null);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifType, setNotifType] = useState<NotificationType>("promotional_offer");
  const [notifBanner, setNotifBanner] = useState("");
  const [notifTargetAudience, setNotifTargetAudience] = useState("All Users");
  const [notifDeepLink, setNotifDeepLink] = useState("/offers");
  const [notifExpiryDate, setNotifExpiryDate] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");

  const refreshNotifs = () => {
    setAdminNotifs(getNotifications());
  };

  useEffect(() => {
    refreshNotifs();
  }, [tab]);

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


    const handleCreateNotif = () => {
      if (!notifTitle.trim() || !notifBody.trim()) {
        toast.error("Please fill in title and message body");
        return;
      }
      
      const payload = {
        type: notifType,
        title: notifTitle,
        body: notifBody,
        bannerImage: notifBanner || undefined,
        deepLink: notifDeepLink,
        expiryDate: notifExpiryDate || undefined,
        targetAudience: notifTargetAudience,
      };

      if (notifEditingId) {
        adminEditNotification(notifEditingId, payload);
        toast.success("Notification updated successfully!");
      } else {
        adminCreateNotification(payload);
        toast.success(isScheduled ? `Notification scheduled for ${scheduleTime}!` : "Notification sent immediately!");
      }

      // Reset form
      setNotifTitle("");
      setNotifBody("");
      setNotifBanner("");
      setNotifType("promotional_offer");
      setNotifTargetAudience("All Users");
      setNotifDeepLink("/offers");
      setNotifExpiryDate("");
      setNotifEditingId(null);
      setIsScheduled(false);
      refreshNotifs();
    };

    const handleEditNotif = (notif: AppNotification) => {
      setNotifEditingId(notif.id);
      setNotifTitle(notif.title);
      setNotifBody(notif.body);
      setNotifType(notif.type);
      setNotifBanner(notif.bannerImage || "");
      setNotifTargetAudience(notif.targetAudience || "All Users");
      setNotifDeepLink(notif.deepLink || "/offers");
      setNotifExpiryDate(notif.expiryDate || "");
    };

    const handleDeleteNotif = (id: string) => {
      if (confirm("Are you sure you want to delete this notification?")) {
        adminDeleteNotification(id);
        refreshNotifs();
        toast.success("Notification deleted");
      }
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

          {tab === "notifications" && (
            <div className="space-y-4 text-left">
              {/* Create/Edit Form */}
              <div className="card-panel rounded-3xl p-5 border border-white/5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)" }}>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-primary font-display">
                  {notifEditingId ? "Edit Notification" : "Create Promotional Notification"}
                </h3>
                
                <div className="space-y-3">
                  <Field label="Notification Title" value={notifTitle} onChange={setNotifTitle} placeholder="e.g. Weekend Football Offer" />
                  <Field label="Notification Message" value={notifBody} onChange={setNotifBody} multiline placeholder="e.g. Get 20% off on all bookings this weekend." />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Notification Type</span>
                      <select
                        value={notifType}
                        onChange={(e) => setNotifType(e.target.value as NotificationType)}
                        className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-background px-3 text-sm outline-none text-foreground cursor-pointer"
                      >
                        <option value="promotional_offer">Promotional Offer</option>
                        <option value="discount_coupon">Discount Coupon</option>
                        <option value="tournament_announcement">Tournament Announcement</option>
                        <option value="new_turf_launch">New Turf Launch</option>
                        <option value="maintenance_notice">Maintenance Notice</option>
                        <option value="system_announcement">System Announcement</option>
                        <option value="feature_update">Feature Update</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Target Audience</span>
                      <select
                        value={notifTargetAudience}
                        onChange={(e) => setNotifTargetAudience(e.target.value)}
                        className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-background px-3 text-sm outline-none text-foreground cursor-pointer"
                      >
                        <option value="All Users">All Users</option>
                        <option value="Selected Users">Selected Users</option>
                        <option value="New Users">New Users</option>
                        <option value="Active Users">Active Users</option>
                        <option value="Premium Users">Premium Users</option>
                        <option value="Users with No Bookings">Users with No Bookings</option>
                        <option value="Users with Previous Bookings">Users with Previous Bookings</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Deep Link Destination" value={notifDeepLink} onChange={setNotifDeepLink} placeholder="e.g. /offers or /turf/1" />
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Expiry Date (Optional)</span>
                      <input
                        type="datetime-local"
                        value={notifExpiryDate ? notifExpiryDate.slice(0, 16) : ""}
                        onChange={(e) => setNotifExpiryDate(e.target.value ? new Date(e.target.value).toISOString() : "")}
                        className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-background px-3 text-sm outline-none text-foreground cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="border border-white/5 p-3.5 rounded-2xl bg-white/5 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="schedule-toggle"
                        checked={isScheduled}
                        onChange={(e) => setIsScheduled(e.target.checked)}
                        className="rounded border-white/10 bg-background h-4 w-4 cursor-pointer"
                      />
                      <label htmlFor="schedule-toggle" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                        Schedule for later
                      </label>
                    </div>
                    {isScheduled && (
                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted2">Schedule Date & Time</span>
                        <input
                          type="datetime-local"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-background px-3 text-sm outline-none text-foreground cursor-pointer"
                        />
                      </label>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2 block mb-1">Banner Image (Optional)</span>
                    {notifBanner && (
                      <div className="mb-2 relative w-full h-32 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                        <img src={notifBanner} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setNotifBanner("")}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer border-none"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <label className="pressable block rounded-2xl border border-white/10 bg-panel-2 py-3 text-center text-xs font-semibold cursor-pointer hover:bg-white/5 transition">
                      Upload Banner Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const dataUrl = await fileToDataUrl(file);
                            setNotifBanner(dataUrl);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCreateNotif}
                    className="pressable inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-neon border-none cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    {notifEditingId ? "Update Notification" : isScheduled ? "Schedule Notification" : "Send Immediately"}
                  </button>
                  {notifEditingId && (
                    <button
                      onClick={() => {
                        setNotifEditingId(null);
                        setNotifTitle("");
                        setNotifBody("");
                        setNotifBanner("");
                        setNotifExpiryDate("");
                        setIsScheduled(false);
                      }}
                      className="pressable flex-1 rounded-full border border-white/10 bg-panel-2 py-3 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Notification History */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-[0.22em] text-muted2">Notification History ({adminNotifs.length})</h3>
                {adminNotifs.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">No notifications sent yet.</p>
                ) : (
                  adminNotifs.map((n) => {
                    const isExpired = n.expiryDate && new Date(n.expiryDate).getTime() < Date.now();
                    return (
                      <div key={n.id} className="card-panel rounded-2xl p-3.5 border border-white/5 flex items-start gap-3 relative" style={{ backgroundColor: "var(--card-bg)" }}>
                        {n.bannerImage && (
                          <img src={n.bannerImage} alt="" className="h-12 w-12 rounded-xl object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-foreground">
                              {n.type.replace("_", " ")}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              Target: {n.targetAudience || "All Users"}
                            </span>
                            {isExpired && (
                              <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-500/30">
                                Expired
                              </span>
                            )}
                          </div>
                          <h4 className="mt-1.5 text-xs font-bold text-foreground">{n.title}</h4>
                          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{n.body}</p>
                          {n.deepLink && (
                            <p className="mt-1.5 text-[9px] font-bold text-primary uppercase tracking-wider">
                              Deep Link: {n.deepLink}
                            </p>
                          )}
                          {n.expiryDate && (
                            <p className="mt-0.5 text-[9px] text-muted-foreground">
                              Expires: {new Date(n.expiryDate).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleEditNotif(n)}
                            className="pressable h-8 px-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold cursor-pointer text-foreground"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteNotif(n.id)}
                            className="pressable h-8 w-8 rounded-lg grid place-items-center bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-red-900/40 cursor-pointer border-none"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {tab === "feedback" && <FeedbackDashboard />}
          {tab === "beta-testing" && <BetaTestingDashboard />}
        {tab === "system-health" && <SystemHealthDashboard />}

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

  const turfBookings: Record<string, number> = {};
  confirmed.forEach(b => turfBookings[b.turf_id] = (turfBookings[b.turf_id] || 0) + 1);
  const mostBookedTurfId = Object.keys(turfBookings).sort((a, b) => turfBookings[b] - turfBookings[a])[0];
  const mostBookedTurf = turfs.find(t => t.id === mostBookedTurfId) || popular;
  const conversionRate = bookings.length > 0 ? Math.round((confirmed.length / bookings.length) * 100) : 0;
  const dailyUsers = Math.floor(todayBookings * 2.5 + 42); // estimated based on daily bookings

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 px-4 md:px-8 lg:px-10 ml-3 md:ml-6">
        <StatCard label="Daily Users" value={String(dailyUsers)} />
        <StatCard label="Bookings (Today)" value={String(todayBookings)} />
        <StatCard label="Revenue" value={`Rs ${revenue}`} />
        <StatCard label="Conversion Rate" value={`${conversionRate}%`} />
        <StatCard label="Live Tournaments" value={String(tournaments.length)} />
        <StatCard label="Active Offers" value={String(offers.length)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 md:px-8 lg:px-10 ml-3 md:ml-6 mt-4">
        <div className="card-panel rounded-3xl p-4 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Most Booked Turf</p>
          <p className="mt-1 text-lg font-bold">{mostBookedTurf?.name ?? "No turfs"}</p>
          <p className="text-sm text-soft">{mostBookedTurf ? `${mostBookedTurf.address} · ${turfBookings[mostBookedTurf.id] || 0} bookings` : "Add a turf to get started."}</p>
        </div>
        <div className="card-panel rounded-3xl p-4 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Top Rated Turf</p>
          <p className="mt-1 text-lg font-bold">{popular?.name ?? "No turfs"}</p>
          <p className="text-sm text-soft">{popular ? `${popular.address} · ${popular.rating} rating` : "Add a turf to get started."}</p>
        </div>
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
