import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { toast } from "sonner";
import {
    Calendar, Filter, Search, CheckCircle, XCircle, Clock,
    DollarSign, User, Phone, MapPin, IndianRupee,
} from "lucide-react";

const bookings = [
    { id: 1, customer: "Rahul Sharma", phone: "+91 98765 43210", date: "2026-05-10", time: "10:00 – 12:00", turf: "Arena 7", amount: 2400, status: "confirmed", payment: "paid" },
    { id: 2, customer: "Priya Patel", phone: "+91 98765 43211", date: "2026-05-10", time: "14:00 – 16:00", turf: "Night Strikers", amount: 3000, status: "pending", payment: "pending" },
    { id: 3, customer: "Amit Kumar", phone: "+91 98765 43212", date: "2026-05-11", time: "18:00 – 20:00", turf: "Arena 7", amount: 3600, status: "confirmed", payment: "paid" },
    { id: 4, customer: "Neha Singh", phone: "+91 98765 43213", date: "2026-05-11", time: "20:00 – 22:00", turf: "Night Strikers", amount: 4000, status: "cancelled", payment: "refunded" },
    { id: 5, customer: "Vikram Roy", phone: "+91 98765 43214", date: "2026-05-12", time: "08:00 – 10:00", turf: "Arena 7", amount: 2000, status: "pending", payment: "pending" },
    { id: 6, customer: "Sonia Mehta", phone: "+91 98765 43215", date: "2026-05-12", time: "12:00 – 14:00", turf: "Night Strikers", amount: 3000, status: "confirmed", payment: "paid" },
];

const statusStyle: Record<string, { bg: string; color: string }> = {
    confirmed: { bg: "#0d2e1a", color: "#4ade80" },
    pending: { bg: "#2d1e00", color: "#f5b942" },
    cancelled: { bg: "#3d1a1a", color: "#f87171" },
};
const paymentStyle: Record<string, { bg: string; color: string }> = {
    paid: { bg: "#0d2e1a", color: "#4ade80" },
    pending: { bg: "#2d1e00", color: "#f5b942" },
    refunded: { bg: "#1e1040", color: "#b39dfa" },
};

const quickStats = [
    { label: "Total", value: "142", icon: Calendar, color: "#7fb8f5", bg: "#0d2a4a" },
    { label: "Pending", value: "8", icon: Clock, color: "#f5b942", bg: "#2d1e00" },
    { label: "Revenue", value: "₹24.5k", icon: IndianRupee, color: "#4ade80", bg: "#062920" },
    { label: "Cancelled", value: "3", icon: XCircle, color: "#f87171", bg: "#3d1a1a" },
];

const ClientBookingManagement = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const filtered = bookings.filter(b => {
        const q = search.toLowerCase();
        const matchSearch = b.customer.toLowerCase().includes(q) ||
            b.phone.includes(q) || b.turf.toLowerCase().includes(q);
        const matchStatus = statusFilter === "all" || b.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const handleAccept = (id: number) => toast.success(`Booking #${id} accepted`);
    const handleCancel = (id: number) => toast.error(`Booking #${id} cancelled`);

    return (
        <MobileShell>
            <div className="min-h-screen bg-background text-foreground">

                {/* ── Header ── */}
                <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <BackButton />
                        <div className="min-w-0">
                            <h1 className="truncate text-base font-bold">Booking Management</h1>
                            <p className="truncate text-xs text-muted2">Manage customer bookings</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => navigate("/client/dashboard")}>
                        Dashboard
                    </Button>
                </div>

                <div className="space-y-4 p-4 pb-8">

                    {/* ── Quick Stats ── */}
                    <div className="grid grid-cols-2 gap-3">
                        {quickStats.map(({ label, value, icon: Icon, color, bg }) => (
                            <div key={label} className="rounded-2xl p-3 flex items-center gap-3"
                                style={{ backgroundColor: bg }}>
                                <div className="rounded-xl p-2" style={{ background: `${color}20` }}>
                                    <Icon className="h-5 w-5" style={{ color }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium truncate" style={{ color }}>{label}</p>
                                    <p className="text-xl font-bold truncate" style={{ color: "white" }}>{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Search + Filter ── */}
                    <div className="card-panel rounded-2xl p-4 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted2" />
                            <Input
                                placeholder="Customer, phone or turf…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 bg-panel border-border"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="bg-panel border-border">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ── Booking Cards (replaces table) ── */}
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 bg-panel-2 mb-3">
                            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                            <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
                            <TabsTrigger value="confirmed" className="text-xs">Confirmed</TabsTrigger>
                            <TabsTrigger value="cancelled" className="text-xs">Cancelled</TabsTrigger>
                        </TabsList>

                        {(["all", "pending", "confirmed", "cancelled"] as const).map(tabVal => (
                            <TabsContent key={tabVal} value={tabVal} className="space-y-3 mt-0">
                                {filtered
                                    .filter(b => tabVal === "all" || b.status === tabVal)
                                    .map(booking => {
                                        const ss = statusStyle[booking.status] ?? statusStyle.pending;
                                        const ps = paymentStyle[booking.payment] ?? paymentStyle.pending;
                                        return (
                                            <div key={booking.id} className="card-panel rounded-2xl p-4 space-y-3">
                                                {/* Row 1: customer + badges */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-sm truncate">{booking.customer}</p>
                                                        <div className="flex items-center gap-1 mt-0.5 text-muted2 text-xs">
                                                            <Phone className="h-3 w-3 shrink-0" />
                                                            <span className="truncate">{booking.phone}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1.5 shrink-0">
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                                            style={{ background: ss.bg, color: ss.color }}>
                                                            {booking.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Row 2: details grid */}
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="flex items-center gap-1.5 text-muted2">
                                                        <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
                                                        <span>{booking.date}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-muted2">
                                                        <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
                                                        <span>{booking.time}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-muted2">
                                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                                                        <span className="truncate">{booking.turf}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-sm neon-text">₹{booking.amount.toLocaleString()}</span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                                            style={{ background: ps.bg, color: ps.color }}>
                                                            {booking.payment}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Row 3: action buttons (only for pending) */}
                                                {booking.status === "pending" && (
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            onClick={() => handleAccept(booking.id)}
                                                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold pressable min-h-[44px]"
                                                            style={{ background: "#0d2e1a", color: "#4ade80", border: "1px solid #4ade8030" }}
                                                        >
                                                            <CheckCircle className="h-3.5 w-3.5" /> Accept
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancel(booking.id)}
                                                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold pressable min-h-[44px]"
                                                            style={{ background: "#3d1a1a", color: "#f87171", border: "1px solid #f8717130" }}
                                                        >
                                                            <XCircle className="h-3.5 w-3.5" /> Cancel
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                {filtered.filter(b => tabVal === "all" || b.status === tabVal).length === 0 && (
                                    <p className="text-center text-sm text-muted2 py-8">No bookings found.</p>
                                )}
                            </TabsContent>
                        ))}
                    </Tabs>

                    {/* ── Action Buttons ── */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted2 uppercase tracking-wider px-1">Quick Actions</p>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { label: "Add Promo Code", sub: "Create discount offers", icon: DollarSign, color: "#b39dfa", bg: "#1e1040" },
                                { label: "Manage Holidays", sub: "Set non‑working days", icon: Calendar, color: "#f5b942", bg: "#2d1e00" },
                                { label: "Peak Hours Pricing", sub: "Adjust rates for peak times", icon: Clock, color: "#3fd6a8", bg: "#062920" },
                            ].map(({ label, sub, icon: Icon, color, bg }) => (
                                <button
                                    key={label}
                                    onClick={() => toast.info(`${label} — coming soon`)}
                                    className="flex items-center gap-4 rounded-2xl p-4 text-left pressable min-h-[56px] w-full"
                                    style={{ backgroundColor: bg, border: `1px solid ${color}25` }}
                                >
                                    <Icon className="h-5 w-5 shrink-0" style={{ color }} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold" style={{ color }}>{label}</p>
                                        <p className="text-xs text-muted2 truncate">{sub}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </MobileShell>
    );
};

export default ClientBookingManagement;
