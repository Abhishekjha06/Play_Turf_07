"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";

interface CoolThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function CoolThemeToggle({ className, size = "md" }: CoolThemeToggleProps) {
  const { themeId, setTheme } = useLuxuryTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const themes = ["premium-teal", "amoled-black"] as const;
  const currentIndex = Math.max(0, themes.indexOf(themeId as any));

  const toggleTheme = () => {
    setTheme(themes[(currentIndex + 1) % themes.length]);
  };

  if (!mounted) return <div className={cn("inline-flex rounded-full bg-muted", size === "sm" ? "h-6 w-12" : size === "md" ? "h-8 w-16" : "h-10 w-20")} />;

  const sizes = {
    sm: { button: "w-12 h-6", thumb: "w-4 h-4", icon: "w-3 h-3", padding: "p-1", travel: 24 },
    md: { button: "w-16 h-8", thumb: "w-6 h-6", icon: "w-4 h-4", padding: "p-1", travel: 32 },
    lg: { button: "w-20 h-10", thumb: "w-8 h-8", icon: "w-5 h-5", padding: "p-1", travel: 40 }
  };

  const currentSize = sizes[size];
  const translateX = currentIndex * currentSize.travel;

  // Background color of the whole pill
  const bgColors = ["bg-[#E2F4F3]", "bg-[#090909]"];

  // Thumb colors
  const thumbColors = ["bg-teal-400", "bg-emerald-400"];

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center rounded-full transition-colors duration-500 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden cursor-pointer",
        bgColors[currentIndex],
        currentSize.button,
        currentSize.padding,
        className
      )}
      aria-label="Toggle theme"
    >
      {/* Background Icons */}
      <div className="absolute inset-0 flex items-center justify-between px-2.5 opacity-20 pointer-events-none">
        <Zap className={cn("text-foreground", currentSize.icon)} />
        <Sparkles className={cn("text-foreground", currentSize.icon)} />
      </div>

      {/* Toggle Thumb */}
      <motion.div
        layout
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        className={cn(
          "relative z-10 flex items-center justify-center rounded-full shadow-md overflow-hidden",
          thumbColors[currentIndex],
          currentSize.thumb
        )}
        animate={{
          x: translateX
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center w-full h-full"
          >
            {currentIndex === 0 && <Zap className={cn("text-teal-900 fill-teal-900/20", currentSize.icon)} />}
            {currentIndex === 1 && <Sparkles className={cn("text-emerald-900 fill-emerald-900/20", currentSize.icon)} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </button>
  );
}
