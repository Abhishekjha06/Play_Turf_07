import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";

export function SectionHeader({
  title,
  action,
  to,
}: {
  title: string;
  action?: ReactNode;
  to?: string;
}) {
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";

  if (isPremium) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 mt-7 mb-3">
        <h2
          className="min-w-0 truncate"
          style={{
            fontSize: "17px",
            fontWeight: 700,
            color: "#0F172A",
            letterSpacing: "-0.01em",
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>
        {to ? (
          <Link
            to={to}
            className="shrink-0"
            style={{ fontSize: "12px", fontWeight: 600, color: "#14B8B0" }}
          >
            {action ?? "See all"}
          </Link>
        ) : (
          action
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 mt-7 mb-3">
      <h2 className="text-base font-display font-bold tracking-tight leading-tight min-w-0 truncate">{title}</h2>
      {to ? (
        <Link to={to} className="text-xs text-primary font-semibold shrink-0">
          {action ?? "See all"}
        </Link>
      ) : (
        action
      )}
    </div>
  );
}
