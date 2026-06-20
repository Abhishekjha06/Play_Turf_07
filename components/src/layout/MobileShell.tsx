import { ReactNode } from "react";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";

interface MobileShellProps {
  children: ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";

  return (
    <div
      className="flex min-h-dvh w-full min-w-0 justify-center"
      style={{ background: isPremium ? "#F1F5F9" : undefined }}
    >
      <div
        className="
          relative
          w-full
          min-w-0
          max-w-[480px]
          min-h-dvh

          md:my-4
          md:rounded-[2rem]
          md:shadow-2xl
        "
        style={{
          background: isPremium ? "#F1F5F9" : undefined,
          border: isPremium ? "none" : undefined,
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        data-testid="mobile-shell"
      >
        {children}
      </div>
    </div>
  );
}
