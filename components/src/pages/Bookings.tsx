import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { AppHeader } from "@/layout/AppHeader";
import { BottomNav } from "@/layout/BottomNav";
import { BookingRow } from "@/booking/BookingRow";
import { api } from "@/lib/api";
import type { Booking } from "@/data/seed";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type Tab = "all" | "upcoming" | "past";

const Bookings = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const [list, setList] = useState<Booking[]>([]);

  useEffect(() => {
    if (user) api.myBookings().then(setList);
  }, [user]);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => {
    if (tab === "upcoming") return list.filter((b) => b.date >= today && b.status === "CONFIRMED");
    if (tab === "past") return list.filter((b) => b.date < today || b.status === "COMPLETED");
    return list;
  }, [list, tab, today]);

  return (
    <MobileShell>
      <AppHeader />
      <h1 className="px-4 mt-5 font-display font-extrabold text-2xl">My Bookings</h1>

      <div className="px-4 mt-4 flex gap-2 bg-panel-2 rounded-full p-1 border border-white/5">
        {(["all", "upcoming", "past"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2.5 text-xs font-semibold rounded-full uppercase tracking-wider pressable min-h-[40px]",
              tab === t ? "bg-primary text-primary-foreground shadow-neon" : "text-soft"
            )}
            data-testid={`tab-${t}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 mt-5 flex flex-col gap-2">
        {!user ? (
          <EmptyState
            title="Sign in to see your bookings"
            cta={<Link to="/login" className="bg-primary text-primary-foreground rounded-full px-5 py-2 font-semibold shadow-neon">Sign in</Link>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No bookings yet" cta={<Link to="/" className="bg-primary text-primary-foreground rounded-full px-5 py-2 font-semibold shadow-neon">Book a turf</Link>} />
        ) : (
          filtered.map((b) => <BookingRow key={b.id} booking={b} />)
        )}
      </div>

      <BottomNav />
    </MobileShell>
  );
};

function EmptyState({ title, cta }: { title: string; cta: React.ReactNode }) {
  return (
    <div className="text-center py-16 card-panel rounded-3xl">
      <p className="text-soft">{title}</p>
      <div className="mt-4 flex justify-center">{cta}</div>
    </div>
  );
}

export default Bookings;
