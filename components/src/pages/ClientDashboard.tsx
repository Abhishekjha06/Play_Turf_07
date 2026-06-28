import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { toast } from "sonner";
import { debounce } from "lodash-es";
import {
    BarChart3,
    CalendarDays,
    DollarSign,
    Users,
    Clock,
    Shield,
    Image,
    Settings,
    TrendingUp,
    PieChart,
} from "lucide-react";
import { websocket, useWebSocket } from "@/lib/websocket";
import { useAuth } from "@/hooks/use-auth";


import { DashboardHeader } from "./client-dashboard/DashboardHeader";
import { DashboardStats } from "./client-dashboard/DashboardStats";
import { DashboardCalendar } from "./client-dashboard/DashboardCalendar";
import { DashboardLiveUpdates } from "./client-dashboard/DashboardLiveUpdates";

const ClientDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const [realTimeUpdates, setRealTimeUpdates] = useState<Record<string, unknown>[]>([]);
    const ws = useWebSocket();

    const summaryCards = [
        { title: "Total Bookings", value: "142", change: "+12%", icon: BarChart3, bg: "#0d2a4a", labelColor: "#7fb8f5", valueColor: "#e8f4ff" },
        { title: "Today's Bookings", value: "8", change: "+2", icon: CalendarDays, bg: "#0d2e1a", labelColor: "#6fcf8a", valueColor: "#e8ffee" },
        { title: "Revenue", value: "₹ 1,24,500", change: "+18%", icon: DollarSign, bg: "#2d1e00", labelColor: "#f5b942", valueColor: "#fff8e6" },
        { title: "Occupancy Rate", value: "78%", change: "+4%", icon: PieChart, bg: "#1e1040", labelColor: "#b39dfa", valueColor: "#ede8ff" },
        { title: "Available Slots", value: "24", change: "-3", icon: Clock, bg: "#062920", labelColor: "#3fd6a8", valueColor: "#e0fff5" },
        { title: "Blocked Slots", value: "6", change: "+1", icon: Shield, bg: "#2d1008", labelColor: "#f5886a", valueColor: "#fff1ee" },
        { title: "Pending Approvals", value: "3", change: "-1", icon: Users, bg: "#2a0a1a", labelColor: "#f07eb8", valueColor: "#ffe8f4" },
        { title: "Total Reviews", value: "89", change: "+5", icon: TrendingUp, bg: "#0e1240", labelColor: "#8a9ff5", valueColor: "#eaedff" },
    ];

    const handleLogout = async () => {
        localStorage.removeItem("client_token");
        localStorage.removeItem("client_id");
        const { signOut } = await import("@/lib/auth");
        await signOut();
        toast.success("Logged out successfully");
        navigate("/more");
    };

    const handleNavigate = useCallback((path: string) => {
        navigate(path);
    }, [navigate]);

    useEffect(() => {


        const token = localStorage.getItem("client_token");
        if (!token) {
            navigate("/client/login");
            return;
        }

        ws.connect(token);

        const unsubscribeConnected = ws.on("connected", () => {
            setWsConnected(true);
            toast.success("Real-time updates connected");
            const turfId = localStorage.getItem("client_turf_id") || "1";
            ws.subscribeToTurf(turfId);
        });

        const unsubscribeDisconnected = ws.on("disconnected", () => {
            setWsConnected(false);
        });

        const debouncedLoadingFlash = debounce(() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1000);
        }, 300);

        const unsubscribeBookingUpdated = ws.on("booking_updated", (data) => {
            React.startTransition(() => {
                setRealTimeUpdates(prev => [...prev.slice(-4), {
                    type: "booking",
                    message: `Booking updated: ${data.booking?.customer_name || "Unknown"}`,
                    timestamp: new Date().toLocaleTimeString(),
                    data
                }]);
            });
            toast.info("New booking update received", {
                description: `Booking status: ${data.booking?.status || "updated"}`
            });
            debouncedLoadingFlash();
        });

        const unsubscribeSlotUpdated = ws.on("slot_updated", (data) => {
            React.startTransition(() => {
                setRealTimeUpdates(prev => [...prev.slice(-4), {
                    type: "slot",
                    message: `Slot ${data.slot?.status || "updated"}: ${data.slot?.time || "Unknown time"}`,
                    timestamp: new Date().toLocaleTimeString(),
                    data
                }]);
            });
            toast.info("Slot availability changed", {
                description: `Slot ${data.slot?.time} is now ${data.slot?.status}`
            });
            debouncedLoadingFlash();
        });

        return () => {
            unsubscribeConnected();
            unsubscribeDisconnected();
            unsubscribeBookingUpdated();
            unsubscribeSlotUpdated();
            ws.disconnect();
        };
    }, [navigate, ws]);

    return (
        <MobileShell>
            <div className="min-h-screen bg-background text-foreground">
                <DashboardHeader wsConnected={wsConnected} onLogout={handleLogout} />

                <div className="space-y-5 p-4">
                    <DashboardStats summaryCards={summaryCards} />

                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 bg-panel-2">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="bookings">Bookings</TabsTrigger>
                            <TabsTrigger value="manage">Manage</TabsTrigger>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-4">
                            <div className="flex flex-col gap-4">
                                <DashboardCalendar />
                                <DashboardLiveUpdates wsConnected={wsConnected} realTimeUpdates={realTimeUpdates} />

                                <Card className="bg-gray-800 border-gray-700">
                                    <CardHeader>
                                        <CardTitle>Quick Actions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                            <Button className="h-auto py-4 flex flex-col gap-2 border-0" style={{ backgroundColor: "#0d2a4a", color: "#7fb8f5" }} onClick={() => handleNavigate("/client/slots")}>
                                                <Clock className="h-6 w-6" />
                                                <span>Manage Slots</span>
                                            </Button>
                                            <Button className="h-auto py-4 flex flex-col gap-2 border-0" style={{ backgroundColor: "#0d2e1a", color: "#4ade80" }} onClick={() => handleNavigate("/client/photos")}>
                                                <Image className="h-6 w-6" />
                                                <span>Upload Photos</span>
                                            </Button>
                                            <Button className="h-auto py-4 flex flex-col gap-2 border-0" style={{ backgroundColor: "#2d1e00", color: "#f5b942" }} onClick={() => handleNavigate("/client/pricing")}>
                                                <DollarSign className="h-6 w-6" />
                                                <span>Update Pricing</span>
                                            </Button>
                                            <Button className="h-auto py-4 flex flex-col gap-2 border-0" style={{ backgroundColor: "#1e1040", color: "#b39dfa" }} onClick={() => handleNavigate("/client/settings")}>
                                                <Settings className="h-6 w-6" />
                                                <span>Turf Settings</span>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="bookings">
                            <Card className="bg-gray-800 border-gray-700">
                                <CardHeader>
                                    <CardTitle>Booking Management</CardTitle>
                                    <CardDescription>View, accept, cancel, and reschedule bookings</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-gray-400">Full booking management interface will be implemented here.</p>
                                    <div className="mt-4 space-y-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <Button>View Booking History</Button>
                                            <Button variant="outline">Customer Details</Button>
                                            <Button variant="outline">Generate Reports</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="manage">
                            <Card className="bg-gray-800 border-gray-700">
                                <CardHeader>
                                    <CardTitle>Turf Management</CardTitle>
                                    <CardDescription>Update turf details, photos, videos, rules, and policies</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Button className="h-auto py-4 flex flex-col gap-2" variant="outline" onClick={() => handleNavigate("/client/turf/edit")}>
                                            <Image className="h-6 w-6" />
                                            <span>Turf Photos & Videos</span>
                                            <span className="text-xs text-gray-400">Upload and manage media</span>
                                        </Button>
                                        <Button className="h-auto py-4 flex flex-col gap-2" variant="outline" onClick={() => handleNavigate("/client/turf/edit")}>
                                            <Settings className="h-6 w-6" />
                                            <span>Turf Details</span>
                                            <span className="text-xs text-gray-400">Name, address, timings, amenities</span>
                                        </Button>
                                        <Button className="h-auto py-4 flex flex-col gap-2" variant="outline" onClick={() => handleNavigate("/client/pricing")}>
                                            <DollarSign className="h-6 w-6" />
                                            <span>Pricing & Offers</span>
                                            <span className="text-xs text-gray-400">Set rates, promo codes, peak hours</span>
                                        </Button>
                                        <Button className="h-auto py-4 flex flex-col gap-2" variant="outline" onClick={() => handleNavigate("/client/rules")}>
                                            <Shield className="h-6 w-6" />
                                            <span>Rules & Policies</span>
                                            <span className="text-xs text-gray-400">Cancellation, parking, turf rules</span>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="settings">
                            <Card className="bg-gray-800 border-gray-700">
                                <CardHeader>
                                    <CardTitle>Profile & Settings</CardTitle>
                                    <CardDescription>Manage your account, notifications, and security</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                                            <div>
                                                <p className="font-medium">Change Password</p>
                                                <p className="text-sm text-gray-400">Update your login password</p>
                                            </div>
                                            <Button variant="outline">Change</Button>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                                            <div>
                                                <p className="font-medium">Notification Preferences</p>
                                                <p className="text-sm text-gray-400">Configure booking alerts</p>
                                            </div>
                                            <Button variant="outline">Configure</Button>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                                            <div>
                                                <p className="font-medium">Staff Access</p>
                                                <p className="text-sm text-gray-400">Add team members</p>
                                            </div>
                                            <Button variant="outline">Manage</Button>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                                            <div>
                                                <p className="font-medium">Audit Logs</p>
                                                <p className="text-sm text-gray-400">View who changed what and when</p>
                                            </div>
                                            <Button variant="outline">View Logs</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </MobileShell>
    );
};

export default ClientDashboard;
