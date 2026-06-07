import React from "react";
import { Bell, LogOut, Wifi, WifiOff, MapPin } from "lucide-react";
import { Button } from "@/ui/button";
import { BackButton } from "@/layout/BackButton";
import { motion, useScroll, useTransform } from "framer-motion";

interface DashboardHeaderProps {
    wsConnected: boolean;
    onLogout: () => void;
}

export function DashboardHeader({ wsConnected, onLogout }: DashboardHeaderProps) {
    const { scrollY } = useScroll();

    // Height shrinks from 280px to 80px
    const headerHeight = useTransform(scrollY, [0, 200], [280, 80]);
    // Fade out greeting and subtitle
    const greetingOpacity = useTransform(scrollY, [0, 100], [1, 0]);
    const greetingY = useTransform(scrollY, [0, 100], [0, -50]);

    return (
        <motion.div
            className="sticky top-0 z-50 flex flex-col justify-between overflow-hidden bg-panel border-b border-border px-4 py-3"
            style={{ height: headerHeight }}
        >
            {/* Top row - always sticky */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <BackButton />
                    <div className="min-w-0 flex items-center gap-2">
                        <h1 className="truncate text-base font-bold">Client Dashboard</h1>
                        <div
                            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs"
                            style={wsConnected ? { backgroundColor: "#0d2e1a", color: "#4ade80" } : { backgroundColor: "#3d1a1a", color: "#f87171" }}
                        >
                            {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                            <span>{wsConnected ? 'Live' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                        <Bell className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10" onClick={onLogout}>
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Collapsing section */}
            <motion.div
                style={{ opacity: greetingOpacity, y: greetingY }}
                className="flex flex-col justify-end pb-4 h-full pointer-events-none"
            >
                <p className="text-sm text-muted2 mb-1">Welcome back, Turf Owner 👋</p>
                <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" style={{ color: "#4ade80" }} />
                    <p style={{ color: "white", fontSize: "16px", fontWeight: 600 }}>
                        Manage your turf seamlessly
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}
