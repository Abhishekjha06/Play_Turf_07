import { ReactNode } from "react";
import { Link } from "react-router-dom";

export function SectionHeader({
  title,
  action,
  to,
}: {
  title: string;
  action?: ReactNode;
  to?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 mt-7 mb-3">
      <h2 className="min-w-0 truncate text-lg font-bold tracking-tight leading-tight text-foreground">
        {title}
      </h2>
      {to ? (
        <Link to={to} className="shrink-0 text-xs font-semibold text-primary">
          {action ?? "See all"}
        </Link>
      ) : (
        action
      )}
    </div>
  );
}
