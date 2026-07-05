import { Home, CalendarCheck, Trophy, MoreHorizontal, Goal, Users } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";

const items = [
  { to: "/", label: "Home", icon: Home, testid: "nav-home" },
  { to: "/bookings", label: "Bookings", icon: CalendarCheck, testid: "nav-bookings" },
  { to: "/open-games", label: "Open Games", icon: Users, testid: "nav-open-games" },
  { to: "/more", label: "More", icon: MoreHorizontal, testid: "nav-more" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();


  return (
      <>
        <div
          style={{ height: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}
          aria-hidden
        />
        <nav
          className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px] md:max-w-[640px] lg:max-w-[768px] flex items-center justify-between"
          style={{
            height: "auto",
            minHeight: "66px",
            background: "hsl(var(--color-surface-elevated))",
            borderTop: "1px solid hsl(var(--color-border-default))",
            paddingLeft: "12px",
            paddingRight: "12px",
            paddingTop: "10px",
            paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
          }}
          data-testid="bottom-nav"
          aria-label="Main navigation"
        >
          {items.slice(0, 2).map((it) => (
            <NavItem key={it.to} {...it} active={pathname === it.to} />
          ))}

          {/* Central FAB */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => {
              localStorage.removeItem("play_turf_selected_city");
              localStorage.removeItem("play_turf_selected_area");
              navigate("/");
            }}
            aria-label="Quick book"
            className="relative -mt-10 grid place-items-center rounded-full"
            style={{
              height: "64px",
              width: "64px",
              background: "hsl(var(--color-primary))",
              boxShadow: "0 10px 30px hsl(var(--color-primary) / 0.40)",
            }}
            data-testid="fab-book"
          >
            {/* Glow ring */}
            <span
              className="absolute inset-0 rounded-full animate-glow-pulse pointer-events-none"
              style={{ background: "hsl(var(--color-primary) / 0.25)" }}
            />
            <Goal className="h-7 w-7 relative z-10" style={{ color: "hsl(var(--color-text-inverse))" }} strokeWidth={2.5} />
          </motion.button>

          {items.slice(2).map((it) => (
            <NavItem key={it.to} {...it} active={pathname === it.to} />
          ))}
        </nav>
      </>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  testid,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  testid: string;
}) {
  return (
    <Link
      to={to}
      onClick={() => {
        if (to === "/") {
          localStorage.removeItem("play_turf_selected_city");
          localStorage.removeItem("play_turf_selected_area");
        }
      }}
      data-testid={testid}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-col items-center justify-center gap-0.5 touch-target"
      style={{ minHeight: "52px", width: "72px", minWidth: "56px" }}
    >
      {/* Active indicator pill */}
      <AnimatePresence>
        {active && (
          <motion.span
            layoutId="premium-nav-indicator"
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-1 rounded-full"
            style={{ width: "20px", background: "hsl(var(--color-primary))" }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={ease.springBounce}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={active ? { scale: 1.18, y: -2 } : { scale: 1, y: 0 }}
        transition={ease.springBounce}
      >
        <Icon className="h-5 w-5" style={{ color: active ? "hsl(var(--color-primary))" : "hsl(var(--color-text-tertiary))" }} />
      </motion.div>

      <span
        className={cn("text-xs tracking-wide", active ? "font-bold" : "font-medium")}
        style={{ color: active ? "hsl(var(--color-primary))" : "hsl(var(--color-text-tertiary))", letterSpacing: "0.03em" }}
      >
        {label}
      </span>
    </Link>
  );
}

