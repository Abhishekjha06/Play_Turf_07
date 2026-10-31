import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Tag, Trophy, MoreHorizontal, Users } from "lucide-react";
import { motion } from "framer-motion";
import { TossModal } from "./TossModal";
import { LocationPill } from "./LocationFilter";
import { staggerContainer, scaleIn, ease } from "@/lib/motion";
import type { Turf } from "@/data/seed";

const cats = [
  { label: "My Bookings", icon: CalendarCheck, to: "/bookings" },
  { label: "Offers", icon: Tag, to: "/offers" },
  { label: "Open Games", icon: Users, to: "/open-games" },
  { label: "More", icon: MoreHorizontal, to: "/more" },
];

interface CategoryPillsProps {
  turfs?: Turf[];
  city?: string;
  area?: string;
  locating?: boolean;
  onCity?: (city: string) => void;
  onArea?: (area: string) => void;
  onNearMe?: () => void;
}

export function CategoryPills({
  turfs = [],
  city = "",
  area = "",
  locating = false,
  onCity = () => { },
  onArea = () => { },
  onNearMe = () => { },
}: CategoryPillsProps) {
  const [tossOpen, setTossOpen] = useState(false);

  // Token-driven pill surfaces — identical structure in every theme.
  const pillStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    boxShadow: "var(--shadow-card)",
  };

  const labelStyle = {
    color: "hsl(var(--foreground-soft))",
  };

  const iconColor = "hsl(var(--primary))";

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <section className="mt-5" aria-label="Quick actions" data-testid="category-pills">
      <motion.div
        className="flex gap-3 overflow-x-auto no-scrollbar px-4"
        variants={prefersReducedMotion ? {} : staggerContainer(0.07, 0.15)}
        initial="hidden"
        animate="visible"
      >
        {/* ── Location Filter Pill ── */}
        <motion.div variants={prefersReducedMotion ? {} : scaleIn}>
          <LocationPill
            turfs={turfs}
            city={city}
            area={area}
            locating={locating}
            onCity={onCity}
            onArea={onArea}
            onNearMe={onNearMe}
          />
        </motion.div>

        {/* ── Toss Time ── */}
        <motion.button
          variants={prefersReducedMotion ? {} : scaleIn}
          whileTap={prefersReducedMotion ? {} : { scale: 0.88 }}
          whileHover={prefersReducedMotion ? {} : { y: -3 }}
          transition={ease.springBounce}
          onClick={() => setTossOpen(true)}
          aria-label="Open Toss Time coin flip"
          className="shrink-0 flex flex-col items-center bg-transparent border-none outline-none cursor-pointer"
          style={{ width: "72px", minWidth: "64px" }}
        >
          <div className="h-14 w-14 rounded-full grid place-items-center" style={pillStyle}>
            <div
              className="h-10 w-10 rounded-full border-2 flex items-center justify-center"
              style={{ border: "2px solid hsl(var(--primary) / 0.50)", background: "hsl(var(--primary) / 0.08)" }}
            >
              <span className="text-[10px] font-black tracking-tighter leading-none" style={{ color: iconColor }}>
                TOSS
              </span>
            </div>
          </div>
          <span className="mt-1 text-center leading-tight text-xs" style={labelStyle}>Toss Time</span>
        </motion.button>

        {/* ── Other shortcuts ── */}
        {cats.map((c) => (
          <motion.div
            key={c.label}
            variants={prefersReducedMotion ? {} : scaleIn}
          >
            <Link
              to={c.to}
              aria-label={c.label}
              className="shrink-0 flex flex-col items-center"
              style={{ width: "72px", minWidth: "64px" }}
            >
              <motion.div
                whileTap={prefersReducedMotion ? {} : { scale: 0.88 }}
                whileHover={prefersReducedMotion ? {} : { y: -3 }}
                transition={ease.springBounce}
                className="h-14 w-14 rounded-full grid place-items-center"
                style={pillStyle}
              >
                <c.icon className="h-6 w-6" style={{ color: iconColor }} />
              </motion.div>
              <span className="mt-1 text-center leading-tight text-xs" style={labelStyle}>{c.label}</span>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <TossModal open={tossOpen} onClose={() => setTossOpen(false)} />
    </section>
  );
}
