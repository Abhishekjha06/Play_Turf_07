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
import { Skeleton } from "@/ui/skeleton";

type Tab = "all" | "upcoming" | "past" | "cancelled";

export function groupBookings(bookings: Booking[]): (Booking & { durationHours: number; end_time: string })[] {
  // A main booking has amount > 0, OR has a payment_id that does not start with "parent_"
  const mainBookings = bookings.filter(b => b.amount > 0 || !b.payment_id || !b.payment_id.startsWith("parent_"));
  
  return mainBookings.map(main => {
    // Secondary bookings have payment_id === `parent_${main.id}` or match main's payment_id (when paid) with amount 0
    const secondaries = bookings.filter(b => 
      b.id !== main.id && 
      (b.payment_id === `parent_${main.id}` || (main.payment_id && b.payment_id === main.payment_id && !b.payment_id.startsWith("parent_") && b.amount === 0))
    );
    
    const durationHours = 1 + secondaries.length;
    
    // Sort slots by start_time to find correct end_time
    const allSlots = [main, ...secondaries].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const start_time = allSlots[0].start_time;
    const lastSlot = allSlots[allSlots.length - 1];
    
    // Compute end_time using database stored end_time
    const end_time = lastSlot.end_time || lastSlot.start_time;
    
    return {
      ...main,
      start_time,
      end_time,
      durationHours
    };
  });
}

const Bookings = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (user) {
      setLoading(true);
      api.myBookings().then(setList).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  // Check and update local current time every 10 seconds to auto-transition slots from upcoming to past
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = currentTime.toLocaleDateString('en-CA'); // "YYYY-MM-DD"

  const isPast = (date: string, endTime: string) => {
    if (date < todayStr) return true;
    if (date > todayStr) return false;
    
    let endH = 0;
    let endM = 0;
    if (endTime.includes("AM") || endTime.includes("PM")) {
      const match = endTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        endH = parseInt(match[1], 10);
        endM = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && endH < 12) endH += 12;
        if (ampm === "AM" && endH === 12) endH = 0;
      }
    } else {
      const [h, m] = endTime.split(":").map(Number);
      endH = h;
      endM = m;
    }
    
    const currentH = currentTime.getHours();
    const currentM = currentTime.getMinutes();
    return currentH > endH || (currentH === endH && currentM >= endM);
  };

  const groupedList = useMemo(() => {
    return groupBookings(list);
  }, [list]);

  const sortedList = useMemo(() => {
    // Sort by newest booking first: created_at descending. Fallback to date + start_time descending.
    return [...groupedList].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (aTime && bTime && aTime !== bTime) {
        return bTime - aTime;
      }
      const aDateTime = `${a.date}T${a.start_time}`;
      const bDateTime = `${b.date}T${b.start_time}`;
      return bDateTime.localeCompare(aDateTime);
    });
  }, [groupedList]);

  const filtered = useMemo(() => {
    if (tab === "upcoming") {
      return sortedList.filter((b) => b.status !== "CANCELLED" && !isPast(b.date, b.end_time));
    }
    if (tab === "past") {
      return sortedList.filter((b) => b.status !== "CANCELLED" && isPast(b.date, b.end_time));
    }
    if (tab === "cancelled") {
      return sortedList.filter((b) => b.status === "CANCELLED");
    }
    return sortedList; // "all"
  }, [sortedList, tab, currentTime]);

  return (
    <MobileShell>
      <AppHeader />
      <h1 className="px-4 mt-5 font-display font-extrabold text-2xl text-foreground">My Bookings</h1>

      <div className="px-4 mt-4 flex gap-1 bg-panel-2 rounded-full p-1 border border-white/5">
        {(["all", "upcoming", "past", "cancelled"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 text-[10px] font-extrabold rounded-full uppercase tracking-wider pressable min-h-[36px] transition cursor-pointer border-none",
              tab === t ? "bg-primary text-primary-foreground shadow-neon" : "text-soft"
            )}
            data-testid={`tab-${t}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 mt-5 flex flex-col gap-4 pb-24">
        {loading ? (
          <>
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-32 w-full rounded-3xl" />
          </>
        ) : !user ? (
          <EmptyState
            title="Sign in to see your bookings"
            cta={<Link to="/login" className="bg-primary text-primary-foreground rounded-full px-5 py-2 font-semibold shadow-neon">Sign in</Link>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No bookings yet" cta={<Link to="/" className="bg-primary text-primary-foreground rounded-full px-5 py-2 font-semibold shadow-neon">Book a turf</Link>} />
        ) : (
          filtered.map((b) => <BookingRow key={b.id} booking={b} currentTime={currentTime} />)
        )}
      </div>

      <BottomNav />
    </MobileShell>
  );
};

function EmptyState({ title, cta }: { title: string; cta: React.ReactNode }) {
  return (
    <div className="text-center py-16 card-panel rounded-3xl" style={{ backgroundColor: "var(--card-bg)" }}>
      <p className="text-soft font-semibold">{title}</p>
      <div className="mt-4 flex justify-center">{cta}</div>
    </div>
  );
}

export default Bookings;
