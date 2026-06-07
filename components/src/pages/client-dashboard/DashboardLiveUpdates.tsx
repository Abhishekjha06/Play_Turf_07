import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/ui/card";
import { Wifi, WifiOff, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DashboardLiveUpdatesProps {
    wsConnected: boolean;
    realTimeUpdates: Record<string, unknown>[];
}

export const DashboardLiveUpdates = React.memo(function DashboardLiveUpdates({ wsConnected, realTimeUpdates }: DashboardLiveUpdatesProps) {
    return (
        <Card className="bg-gray-800/80 border-gray-700/50 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 sm:px-4">
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg font-bold tracking-tight">Real-time Updates</CardTitle>
                    <motion.div
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300"
                        style={wsConnected ? { backgroundColor: "#0d2e1a", color: "#4ade80", boxShadow: "0 0 12px rgba(74, 222, 128, 0.3)" } : { backgroundColor: "#3d1a1a", color: "#f87171" }}
                        animate={wsConnected ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        {wsConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        <span>{wsConnected ? 'Live Connected' : 'Offline'}</span>
                    </motion.div>
                </div>
                <CardDescription className="text-sm">Instant updates from main panel</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 max-h-52 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    <AnimatePresence mode="popLayout">
                        {realTimeUpdates.length > 0 ? (
                            realTimeUpdates.map((update, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                    className="flex items-start gap-3 p-3 bg-gray-900/40 rounded-xl border border-white/5 hover:bg-gray-900/60 hover:border-white/10 transition-all duration-200"
                                >
                                    <div className="flex-shrink-0 mt-0.5">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-800">
                                            {update.type === "booking" ? (
                                                <span className="text-green-400 text-sm">🎫</span>
                                            ) : (
                                                <Clock className="w-4 h-4 text-blue-400" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-200 leading-tight">
                                            {update.message}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                            {update.timestamp}
                                        </p>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-8 text-center"
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center mb-3">
                                    <Clock className="w-5 h-5 text-gray-500" />
                                </div>
                                <p className="text-sm text-gray-400 font-medium">No recent updates</p>
                                <p className="text-xs text-gray-500 mt-1">Waiting for live events...</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
});
