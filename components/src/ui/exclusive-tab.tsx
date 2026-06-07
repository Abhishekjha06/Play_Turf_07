import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface ExclusiveTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function ExclusiveTabs({ tabs, activeTab, onChange, className }: ExclusiveTabsProps) {
  return (
    <div 
      className={cn(
        "relative flex items-center p-1.5 rounded-full border bg-panel backdrop-blur-xl shadow-inner", 
        className
      )}
      style={{
        borderColor: "var(--border-primary)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 z-10 pressable",
              isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="exclusive-tab-active-bg"
                className="absolute inset-0 rounded-full bg-gradient-neon shadow-neon"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                style={{ zIndex: -1 }}
              />
            )}
            
            {tab.icon && (
              <span className={cn(
                "w-3.5 h-3.5 transition-colors duration-300",
                isActive ? "text-primary-foreground" : "text-muted-foreground"
              )}>
                {tab.icon}
              </span>
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
