import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { toast } from "sonner";
import { Clock, Calendar, Plus, Trash2, CheckCircle, XCircle, IndianRupee } from "lucide-react";

type Slot = {
    id: number;
    time: string;
    duration: number;
    status: "available" | "booked" | "blocked";
    price: number;
    isBlocked: boolean;
};

const initSlots: Slot[] = [
    { id: 1, time: "06:00", duration: 2, status: "available", price: 1200, isBlocked: false },
    { id: 2, time: "08:00", duration: 2, status: "booked", price: 1200, isBlocked: false },
    { id: 3, time: "10:00", duration: 2, status: "available", price: 1500, isBlocked: false },
    { id: 4, time: "12:00", duration: 2, status: "available", price: 1500, isBlocked: true },
    { id: 5, time: "14:00", duration: 2, status: "booked", price: 1800, isBlocked: false },
    { id: 6, time: "16:00", duration: 2, status: "available", price: 1800, isBlocked: false },
    { id: 7, time: "18:00", duration: 2, status: "available", price: 2000, isBlocked: false },
    { id: 8, time: "20:00", duration: 2, status: "booked", price: 2000, isBlocked: false },
];

const statusColor: Record<string, { bg: string; color: string; dot: string }> = {
    available: { bg: "#062920", color: "#3fd6a8", dot: "#3fd6a8" },
    booked: { bg: "#0d2a4a", color: "#7fb8f5", dot: "#7fb8f5" },
    blocked: { bg: "#2d1008", color: "#f5886a", dot: "#f5886a" },
};

const ClientSlotManagement = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [slots, setSlots] = useState<Slot[]>(initSlots);
    const [newTime, setNewTime] = useState("");
    const [newDuration, setNewDuration] = useState("2");
    const [newPrice, setNewPrice] = useState("1200");
    const [editingPrice, setEditingPrice] = useState<number | null>(null);
    const [editPriceVal, setEditPriceVal] = useState("");

    const handleAddSlot = () => {
        if (!newTime) { toast.error("Please select a start time"); return; }
        const slot: Slot = {
            id: Date.now(),
            time: newTime,
            duration: parseInt(newDuration),
            status: "available",
            price: parseInt(newPrice) || 1200,
            isBlocked: false,
        };
        setSlots(prev => [...prev, slot].sort((a, b) => a.time.localeCompare(b.time)));
        setNewTime("");
        toast.success("Slot added");
    };

    const handleToggleBlock = (id: number) => {
        setSlots(prev => prev.map(s => s.id === id
            ? { ...s, isBlocked: !s.isBlocked, status: s.isBlocked ? "available" : "blocked" }
            : s
        ));
        toast.success("Slot status updated");
    };

    const handleDelete = (id: number) => {
        setSlots(prev => prev.filter(s => s.id !== id));
        toast.success("Slot removed");
    };

    const savePrice = (id: number) => {
        const val = parseInt(editPriceVal);
        if (!val || val < 0) { toast.error("Enter a valid price"); return; }
        setSlots(prev => prev.map(s => s.id === id ? { ...s, price: val } : s));
        setEditingPrice(null);
        toast.success("Price updated");
    };

    const filterSlots = (tab: string) =>
        tab === "all" ? slots : slots.filter(s => s.status === tab);

    return (
        <MobileShell>
            <div className="min-h-screen bg-background text-foreground">

                {/* ── Header ── */}
                <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <BackButton />
                        <div className="min-w-0">
                            <h1 className="truncate text-base font-bold">Slot Management</h1>
                            <p className="truncate text-xs text-muted2">Manage time slots for your turf</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => navigate("/client/dashboard")}>
                        Dashboard
                    </Button>
                </div>

                <div className="space-y-4 p-4 pb-8">

                    {/* ── Date Selector ── */}
                    <div className="card-panel rounded-2xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-muted2 uppercase tracking-wider">Select Date</p>
                        <div className="flex gap-3">
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="flex-1 bg-panel border-border min-h-[44px]"
                            />
                            <Button
                                className="bg-primary text-primary-foreground shrink-0 min-h-[44px]"
                                onClick={() => toast.success("Slots loaded")}
                            >
                                <Calendar className="h-4 w-4 mr-1.5" />
                                Load
                            </Button>
                        </div>
                        <p className="text-xs text-muted2">
                            Showing slots for{" "}
                            <span className="text-soft font-semibold">
                                {new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                        </p>
                    </div>

                    {/* ── Add New Slot ── */}
                    <div className="card-panel rounded-2xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-muted2 uppercase tracking-wider">Add New Slot</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted2">Start Time</Label>
                                <Input
                                    type="time"
                                    value={newTime}
                                    onChange={(e) => setNewTime(e.target.value)}
                                    className="bg-panel border-border min-h-[44px]"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted2">Duration</Label>
                                <Select value={newDuration} onValueChange={setNewDuration}>
                                    <SelectTrigger className="bg-panel border-border min-h-[44px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4].map(h => (
                                            <SelectItem key={h} value={String(h)}>{h}h</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted2">Price (₹)</Label>
                                <Input
                                    type="number"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value)}
                                    className="bg-panel border-border min-h-[44px]"
                                    min={0}
                                />
                            </div>
                            <div className="flex items-end">
                                <Button
                                    onClick={handleAddSlot}
                                    className="w-full bg-primary text-primary-foreground min-h-[44px]"
                                >
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Add Slot
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* ── Slot Cards ── */}
                    <Tabs defaultValue="all">
                        <TabsList className="grid w-full grid-cols-4 bg-panel-2 mb-3">
                            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                            <TabsTrigger value="available" className="text-xs">Free</TabsTrigger>
                            <TabsTrigger value="booked" className="text-xs">Booked</TabsTrigger>
                            <TabsTrigger value="blocked" className="text-xs">Blocked</TabsTrigger>
                        </TabsList>

                        {(["all", "available", "booked", "blocked"] as const).map(tab => (
                            <TabsContent key={tab} value={tab} className="space-y-3 mt-0">
                                {filterSlots(tab).map(slot => {
                                    const sc = statusColor[slot.status] ?? statusColor.available;
                                    return (
                                        <div key={slot.id} className="card-panel rounded-2xl p-4 space-y-3">
                                            {/* Row 1: time + status dot + delete */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <span
                                                        className="h-2.5 w-2.5 rounded-full shrink-0"
                                                        style={{ background: sc.dot }}
                                                    />
                                                    <span className="text-lg font-black font-display">{slot.time}</span>
                                                    <span
                                                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                                        style={{ background: sc.bg, color: sc.color }}
                                                    >
                                                        {slot.duration}h · {slot.status.toUpperCase()}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(slot.id)}
                                                    className="h-9 w-9 grid place-items-center rounded-xl pressable"
                                                    style={{ background: "#3d1a1a", color: "#f87171" }}
                                                    aria-label="Delete slot"
                                                    disabled={slot.status === "booked"}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>

                                            {/* Row 2: price editor */}
                                            <div className="flex items-center gap-3">
                                                <IndianRupee className="h-4 w-4 text-muted2 shrink-0" />
                                                {editingPrice === slot.id ? (
                                                    <div className="flex flex-1 gap-2">
                                                        <Input
                                                            type="number"
                                                            value={editPriceVal}
                                                            onChange={e => setEditPriceVal(e.target.value)}
                                                            className="flex-1 bg-panel border-border h-9 text-sm"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => savePrice(slot.id)}
                                                            className="px-3 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold pressable"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingPrice(null)}
                                                            className="px-2 h-9 rounded-xl border border-border text-xs pressable"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-1 items-center justify-between">
                                                        <span className="font-bold text-sm neon-text">₹{slot.price.toLocaleString()}</span>
                                                        <button
                                                            onClick={() => { setEditingPrice(slot.id); setEditPriceVal(String(slot.price)); }}
                                                            className="text-xs text-primary underline underline-offset-2 pressable"
                                                            disabled={slot.status === "booked"}
                                                        >
                                                            Edit price
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Row 3: block toggle */}
                                            <div className="flex items-center justify-between border-t border-white/8 pt-3">
                                                <span className="text-sm text-soft">
                                                    {slot.isBlocked ? "Slot is blocked" : "Slot is open"}
                                                </span>
                                                <Switch
                                                    checked={slot.isBlocked}
                                                    onCheckedChange={() => handleToggleBlock(slot.id)}
                                                    disabled={slot.status === "booked"}
                                                    aria-label="Block / unblock slot"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}

                                {filterSlots(tab).length === 0 && (
                                    <p className="text-center text-sm text-muted2 py-8">No slots in this category.</p>
                                )}
                            </TabsContent>
                        ))}
                    </Tabs>

                    {/* ── Bulk Actions ── */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted2 uppercase tracking-wider px-1">Bulk Actions</p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: "Mark Available", icon: CheckCircle, color: "#4ade80", bg: "#0d2e1a" },
                                { label: "Block Selected", icon: XCircle, color: "#f87171", bg: "#3d1a1a" },
                                { label: "Update Prices", icon: IndianRupee, color: "#7fb8f5", bg: "#0d2a4a" },
                                { label: "Set Peak Hours", icon: Clock, color: "#f5b942", bg: "#2d1e00" },
                            ].map(({ label, icon: Icon, color, bg }) => (
                                <button
                                    key={label}
                                    onClick={() => toast.info(`${label} — coming soon`)}
                                    className="flex items-center gap-2 rounded-2xl px-3 py-3 text-xs font-semibold pressable min-h-[44px]"
                                    style={{ backgroundColor: bg, color, border: `1px solid ${color}25` }}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </MobileShell>
    );
};

export default ClientSlotManagement;
