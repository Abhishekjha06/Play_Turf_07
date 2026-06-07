import React from "react";
import { cn } from "@/lib/utils";

export const MeteorImpactBorder = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("relative overflow-hidden rounded-xl p-[2px]", className)}>
      <span 
        className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite]" 
        style={{
          background: "conic-gradient(from 90deg at 50% 50%, var(--card-bg) 0%, hsl(var(--primary)) 50%, var(--card-bg) 100%)"
        }}
      />
      <div className="relative flex h-full w-full items-center justify-center rounded-[10px] bg-panel">
        {children}
      </div>
    </div>
  );
};
