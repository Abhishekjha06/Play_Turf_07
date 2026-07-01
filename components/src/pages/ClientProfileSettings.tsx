import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Badge } from "@/ui/badge";
import { toast } from "sonner";
import { User, Lock, Bell, History, Save, Eye, EyeOff, Key, LogOut, ChevronRight, MessageSquarePlus } from "lucide-react";
import { clientProfileUpdateSchema } from "@/lib/validations";
import { FeedbackModal } from "@/ui/FeedbackModal";

const ClientProfileSettings = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    // Profile state
    const [profile, setProfile] = useState({
        companyName: "Arena 7 Sports Turf",
        clientId: "CLIENT_001",
        email: "owner@arena7.com",
        phone: "+91 9876543210",
    });

    // Password change state
    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    // Notification preferences
    const [notifications, setNotifications] = useState({
        emailNotifications: true,
        smsNotifications: true,
        bookingConfirmations: true,
        bookingCancellations: true,
    });

    // Audit logs mock data
    const auditLogs = [
        { id: 1, action: "Password changed", user: "System", timestamp: "2024-03-15 14:30:22", ip: "192.168.1.105" },
        { id: 2, action: "Booking accepted", user: "Rajesh Sharma", timestamp: "2024-03-15 11:15:45", ip: "192.168.1.105" },
        { id: 3, action: "Slot blocked", user: "Rajesh Sharma", timestamp: "2024-03-14 16:45:33", ip: "192.168.1.105" },
        { id: 4, action: "Profile updated", user: "Rajesh Sharma", timestamp: "2024-03-13 09:22:18", ip: "192.168.1.105" },
    ];

    useEffect(() => {
        // Auth + role are enforced by <ClientRoute>; nothing to gate here.
    }, []);

    const handleProfileUpdate = () => {
        const result = clientProfileUpdateSchema.safeParse(profile);
        if (!result.success) {
            toast.error(result.error.errors[0].message);
            return;
        }

        setLoading(true);
        setTimeout(() => {
            toast.success("Profile updated successfully");
            setLoading(false);
        }, 1000);
    };

    const handlePasswordChange = () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error("New password and confirm password do not match");
            return;
        }
        if (passwordData.newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        setTimeout(() => {
            toast.success("Password changed successfully");
            setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
            setLoading(false);
        }, 1000);
    };

    const handleNotificationToggle = (key: keyof typeof notifications) => {
        setNotifications(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSaveNotifications = () => {
        setLoading(true);
        setTimeout(() => {
            toast.success("Notification preferences saved");
            setLoading(false);
        }, 800);
    };

    const handleLogout = async () => {
        const { signOut } = await import("@/lib/auth");
        await signOut();
        toast.success("Logged out successfully");
        navigate("/client/login");
    };

    return (
        <MobileShell>
            <div className="min-h-screen bg-background text-foreground">
                {/* Header */}
                <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <BackButton />
                        <div className="min-w-0">
                            <h1 className="truncate text-base font-bold">Profile & Settings</h1>
                            <p className="truncate text-xs text-muted2">Manage your account and preferences</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-10 w-10" onClick={handleLogout}>
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>

                {/* Main Content */}
                <div className="p-4 pb-8">
                    <Tabs defaultValue="profile" className="w-full">
                        <TabsList className="mb-5 grid w-full grid-cols-4 bg-panel-2">
                            <TabsTrigger value="profile" className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />
                                <span className="text-xs">Profile</span>
                            </TabsTrigger>
                            <TabsTrigger value="security" className="flex items-center gap-1.5">
                                <Lock className="h-3.5 w-3.5" />
                                <span className="text-xs">Security</span>
                            </TabsTrigger>
                            <TabsTrigger value="notifications" className="flex items-center gap-1.5">
                                <Bell className="h-3.5 w-3.5" />
                                <span className="text-xs">Alerts</span>
                            </TabsTrigger>
                            <TabsTrigger value="audit" className="flex items-center gap-1.5">
                                <History className="h-3.5 w-3.5" />
                                <span className="text-xs">Logs</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* Profile Tab */}
                        <TabsContent value="profile" className="space-y-4">
                            <div className="card-panel rounded-2xl p-4 space-y-4">
                                <div className="flex items-center gap-2 pb-1">
                                    <User className="h-4 w-4 text-primary" />
                                    <h2 className="font-semibold text-sm">Company Profile</h2>
                                </div>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="companyName" className="text-xs text-muted2">Company Name</Label>
                                        <Input id="companyName" value={profile.companyName}
                                            onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                                            className="bg-panel border-border min-h-[44px]" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="clientId" className="text-xs text-muted2">Client ID</Label>
                                        <Input id="clientId" value={profile.clientId} disabled
                                            className="bg-panel border-border min-h-[44px] opacity-60 cursor-not-allowed" />
                                        <p className="text-xs text-muted2">Client ID cannot be changed</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="email" className="text-xs text-muted2">Email Address</Label>
                                        <Input id="email" type="email" value={profile.email}
                                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                            className="bg-panel border-border min-h-[44px]" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="phone" className="text-xs text-muted2">Phone Number</Label>
                                        <Input id="phone" value={profile.phone}
                                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                            className="bg-panel border-border min-h-[44px]" />
                                    </div>
                                </div>
                                <Button onClick={handleProfileUpdate} disabled={loading}
                                    className="w-full bg-primary text-primary-foreground min-h-[44px]">
                                    {loading ? "Saving…" : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
                                </Button>
                            </div>
                        </TabsContent>

                        {/* Security Tab */}
                        <TabsContent value="security" className="space-y-4">
                            <div className="card-panel rounded-2xl p-4 space-y-4">
                                <div className="flex items-center gap-2 pb-1">
                                    <Lock className="h-4 w-4 text-primary" />
                                    <h2 className="font-semibold text-sm">Change Password</h2>
                                </div>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="currentPassword" className="text-xs text-muted2">Current Password</Label>
                                        <div className="relative">
                                            <Input id="currentPassword"
                                                type={showPassword ? "text" : "password"}
                                                value={passwordData.currentPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                className="bg-panel border-border pr-11 min-h-[44px]" />
                                            <button type="button"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center text-muted2"
                                                onClick={() => setShowPassword(!showPassword)}>
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="newPassword" className="text-xs text-muted2">New Password</Label>
                                        <Input id="newPassword" type="password" value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            className="bg-panel border-border min-h-[44px]" />
                                        <p className="text-xs text-muted2">Must be at least 6 characters</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="confirmPassword" className="text-xs text-muted2">Confirm New Password</Label>
                                        <Input id="confirmPassword" type="password" value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            className="bg-panel border-border min-h-[44px]" />
                                    </div>
                                </div>
                                <Button onClick={handlePasswordChange} disabled={loading}
                                    className="w-full bg-primary text-primary-foreground min-h-[44px]">
                                    {loading ? "Updating…" : <><Key className="h-4 w-4 mr-2" />Change Password</>}
                                </Button>
                            </div>

                            {/* Support Section */}
                            <div className="mt-8">
                                <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted2">Support</h2>
                                <div className="card-panel flex flex-col overflow-hidden rounded-3xl">
                                    <button
                                        onClick={() => setFeedbackOpen(true)}
                                        className="pressable flex items-center gap-3 border-b border-white/5 p-4 text-left transition-colors hover:bg-white/5"
                                    >
                                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/20 text-primary">
                                            <MessageSquarePlus className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">Provide Feedback</p>
                                            <p className="text-[11px] text-muted2">Report a bug or request a feature</p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-soft" />
                                    </button>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Notifications Tab */}
                        <TabsContent value="notifications" className="space-y-4">
                            <div className="card-panel rounded-2xl p-4 space-y-4">
                                <div className="flex items-center gap-2 pb-1">
                                    <Bell className="h-4 w-4 text-primary" />
                                    <h2 className="font-semibold text-sm">Notification Preferences</h2>
                                </div>
                                <div className="space-y-4 divide-y divide-white/8">
                                    {[
                                        { key: "emailNotifications" as const, label: "Email Notifications", sub: "Receive updates via email" },
                                        { key: "smsNotifications" as const, label: "SMS Notifications", sub: "Receive updates via SMS" },
                                        { key: "bookingConfirmations" as const, label: "Booking Confirmations", sub: "Notify when bookings are confirmed" },
                                        { key: "bookingCancellations" as const, label: "Booking Cancellations", sub: "Notify when bookings are cancelled" },
                                    ].map(({ key, label, sub }) => (
                                        <div key={key} className="flex items-center justify-between gap-3 pt-4 first:pt-0">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium">{label}</p>
                                                <p className="text-xs text-muted2">{sub}</p>
                                            </div>
                                            <Switch checked={notifications[key]}
                                                onCheckedChange={() => handleNotificationToggle(key)}
                                                aria-label={label} />
                                        </div>
                                    ))}
                                </div>
                                <Button onClick={handleSaveNotifications} disabled={loading}
                                    className="w-full bg-primary text-primary-foreground min-h-[44px]">
                                    {loading ? "Saving…" : "Save Preferences"}
                                </Button>
                            </div>
                        </TabsContent>

                        {/* Audit Logs Tab */}
                        <TabsContent value="audit" className="space-y-3">
                            <div className="card-panel rounded-2xl p-4 space-y-3">
                                <div className="flex items-center gap-2 pb-1">
                                    <History className="h-4 w-4 text-primary" />
                                    <h2 className="font-semibold text-sm">Audit Logs</h2>
                                </div>
                                {auditLogs.map((log) => (
                                    <div key={log.id} className="rounded-xl bg-panel p-3 space-y-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-medium leading-snug">{log.action}</p>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-muted2 shrink-0">
                                                {log.ip}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted2">
                                            By {log.user} · {log.timestamp}
                                        </p>
                                    </div>
                                ))}
                                <p className="text-xs text-muted2 text-center pt-1">
                                    Showing {auditLogs.length} most recent activities
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </MobileShell>
    );
};

export default ClientProfileSettings;
