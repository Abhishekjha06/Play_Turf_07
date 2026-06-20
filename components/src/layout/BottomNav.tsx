import { Home, CalendarCheck, Trophy, MoreHorizontal, Goal, Users } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";
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
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";

  if (isPremium) {
    return (
      <>
        <div
          style={{ height: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}
          aria-hidden
        />
        <nav
          className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px] flex items-center justify-between"
          style={{
            height: "auto",
            minHeight: "66px",
            background: "#FFFFFF",
            borderTop: "1px solid #E2E8F0",
            paddingLeft: "12px",
            paddingRight: "12px",
            paddingTop: "10px",
            paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
          }}
          data-testid="bottom-nav"
          aria-label="Main navigation"
        >
          {items.slice(0, 2).map((it) => (
            <PremiumNavItem key={it.to} {...it} active={pathname === it.to} />
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
              background: "#14B8B0",
              boxShadow: "0 10px 30px rgba(20,184,176,0.40)",
            }}
            data-testid="fab-book"
          >
            {/* Glow ring */}
            <span
              className="absolute inset-0 rounded-full animate-glow-pulse pointer-events-none"
              style={{ background: "rgba(20,184,176,0.25)" }}
            />
            <Goal className="h-7 w-7 text-white relative z-10" strokeWidth={2.5} />
          </motion.button>

          {items.slice(2).map((it) => (
            <PremiumNavItem key={it.to} {...it} active={pathname === it.to} />
          ))}
        </nav>
      </>
    );
  }

  // Legacy dark theme nav
  return (
    <>
      <div
        style={{ height: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}
        aria-hidden
      />
      <nav
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[456px] glass-strong rounded-full px-3 py-2 flex items-center justify-between"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
        data-testid="bottom-nav"
        aria-label="Main navigation"
      >
        {items.slice(0, 2).map((it) => (
          <LegacyNavItem key={it.to} {...it} active={pathname === it.to} />
        ))}

        <motion.button
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => {
            localStorage.removeItem("play_turf_selected_city");
            localStorage.removeItem("play_turf_selected_area");
            navigate("/");
          }}
          aria-label="Quick book"
          className="relative -mt-10 h-16 w-16 rounded-full bg-gradient-neon text-primary-foreground grid place-items-center animate-pulse-glow"
          data-testid="fab-book"
        >
          <Goal className="h-7 w-7" strokeWidth={2.5} />
        </motion.button>

        {items.slice(2).map((it) => (
          <LegacyNavItem key={it.to} {...it} active={pathname === it.to} />
        ))}
      </nav>
    </>
  );
}

function PremiumNavItem({
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
            style={{ width: "20px", background: "#14B8B0" }}
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
        <Icon className="h-5 w-5" style={{ color: active ? "#14B8B0" : "#94A3B8" }} />
      </motion.div>

      <span
        style={{
          fontSize: "11px",
          fontWeight: active ? 700 : 500,
          color: active ? "#14B8B0" : "#94A3B8",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </span>
    </Link>
  );
}

function LegacyNavItem({
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
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] w-[18vw] max-w-[72px] min-w-[56px] rounded-2xl",
        active ? "text-primary font-bold" : "text-muted2"
      )}
    >
      {/* Sliding background pill */}
      <AnimatePresence>
        {active && (
          <motion.span
            layoutId="legacy-nav-bg"
            className="absolute inset-0 rounded-2xl bg-primary/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={ease.springGentle}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={active ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
        transition={ease.springBounce}
        className="relative z-10"
      >
        <Icon className="h-5 w-5" />
      </motion.div>
      <span className="relative z-10 text-[11px] font-medium tracking-wide">{label}</span>
    </Link>
  );
}
