import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface DashboardStatsProps {
    summaryCards: Array<{
        title: string;
        value: string;
        change: string;
        icon: React.ElementType;
        bg: string;
        labelColor: string;
        valueColor: string;
    }>;
}

export const DashboardStats = React.memo(function DashboardStats({ summaryCards }: DashboardStatsProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-2 gap-3"
        >
            {summaryCards.map((card, idx) => {
                const Icon = card.icon;
                const isPositive = card.change.startsWith("+");
                const isNegative = card.change.startsWith("-");
                const DeltaIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
                const deltaColor = isPositive ? "#4ade80" : isNegative ? "#f87171" : "#888888";
                
                return (
                    <motion.div
                        key={idx}
                        className="relative min-w-0 overflow-hidden rounded-2xl p-3 transition-all duration-300 hover:scale-105 hover:shadow-2xl sm:p-4"
                        style={{
                            backgroundColor: card.bg,
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)"
                        }}
                        whileHover={{
                            boxShadow: `0 20px 25px -5px ${card.labelColor}20, 0 10px 10px -5px ${card.labelColor}10`
                        }}
                    >
                        <Icon
                            className="absolute right-3 top-3 transition-transform duration-300 hover:scale-110"
                            style={{ width: "22px", height: "22px", color: card.labelColor, opacity: 0.3 }}
                        />
                        <p className="min-w-0 pr-7 text-xs font-medium tracking-wide" style={{ color: card.labelColor }}>{card.title}</p>
                        <p className="mt-2 truncate text-xl font-bold tracking-tight" style={{ color: card.valueColor }}>{card.value}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <DeltaIcon className="h-3.5 w-3.5" style={{ color: deltaColor }} />
                            <span className="text-xs font-semibold" style={{ color: deltaColor }}>{card.change}</span>
                        </div>
                    </motion.div>
                );
            })}
        </motion.div>
    );
});
