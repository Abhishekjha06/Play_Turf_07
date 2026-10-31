import { ReactNode } from "react";

interface MobileShellProps {
  children: ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  return (
    <div
      className="flex min-h-dvh w-full min-w-0 justify-center"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* Skip to main content link for screen readers / keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:font-semibold focus:text-sm"
      >
        Skip to main content
      </a>
      <div
        className="
          relative
          w-full
          min-w-0
          max-w-[480px]
          md:max-w-[640px]
          lg:max-w-[768px]
          min-h-dvh

          md:my-4
          md:rounded-[2rem]
          md:shadow-2xl
        "
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        data-testid="mobile-shell"
      >
        <main id="main-content" className="min-h-dvh">
          {children}
        </main>
      </div>
    </div>
  );
}
