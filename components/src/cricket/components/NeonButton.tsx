import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function NeonButton({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "pressable inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-black tracking-wide transition-all duration-300 disabled:pointer-events-none disabled:opacity-40 cursor-pointer border-none",
        variant === "primary" && "bg-gradient-neon text-primary-foreground shadow-neon hover:shadow-neon-lg hover:brightness-105 active:scale-95",
        variant === "ghost" && "border border-border bg-panel hover:bg-panel-2 text-foreground hover:border-primary/40 active:scale-95",
        variant === "danger" && "border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/25 active:scale-95",
        className,
      )}
      {...props}
    />
  );
}
