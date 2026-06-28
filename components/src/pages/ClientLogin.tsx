import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Briefcase, Lock, User } from "lucide-react";
import { api } from "@/lib/api";

const ClientLogin = () => {
    const navigate = useNavigate();
    const [clientId, setClientId] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleClientLogin = async () => {
        if (!clientId.trim()) {
            toast.error("Please enter client ID");
            return;
        }
        setLoading(true);
        try {
            const normalizedClient = clientId.trim().toLowerCase();
            const u = await api.clientLogin(normalizedClient, password || "123456789");
            toast.success(`Welcome ${u.name}!`);
            navigate("/client/dashboard");
        } catch (error) {
            toast.error((error as Error).message || "Invalid credentials");
        } finally {
            setLoading(false);
        }
    };



    return (
        <MobileShell>
            <div className="relative z-10 px-5 pt-6">
                <BackButton />
            </div>

            <div className="relative z-10 px-5 pt-10 flex flex-col items-center text-center">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="h-16 w-16 rounded-2xl bg-gradient-neon grid place-items-center mx-auto mb-4">
                        <Briefcase className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h1 className="font-display font-extrabold text-3xl">
                        <span className="text-foreground">Client</span>{" "}
                        <span className="neon-text">Panel</span>
                    </h1>
                    <p className="mt-2 text-soft text-sm">Turf owners &amp; managers – manage your venue</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mt-8 w-full max-w-sm"
                >
                    <div className="rounded-3xl border border-white/10 bg-panel-2/80 p-5 text-left space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted2">
                            Sign in to your account
                        </p>

                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted2" />
                            <input
                                value={clientId}
                                onChange={(e) => setClientId(e.target.value)}
                                className="h-12 w-full rounded-2xl border border-white/10 bg-background pl-11 pr-4 text-sm outline-none focus:border-primary"
                                placeholder="Client ID"
                                autoComplete="username"
                                data-testid="client-id"
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted2" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 w-full rounded-2xl border border-white/10 bg-background pl-11 pr-4 text-sm outline-none focus:border-primary"
                                placeholder="Password"
                                autoComplete="current-password"
                                data-testid="client-password"
                            />
                        </div>

                        <button
                            onClick={handleClientLogin}
                            disabled={loading}
                            className="w-full bg-primary text-primary-foreground font-semibold rounded-full py-3 text-sm pressable disabled:opacity-50 min-h-[44px]"
                            data-testid="client-login-submit"
                        >
                            {loading ? "Signing in…" : "Sign In"}
                        </button>


                    </div>

                    <p className="mt-6 text-xs text-muted2 text-center">
                        Not a client?{" "}
                        <a href="/login" className="text-primary underline underline-offset-2">
                            Go to user login
                        </a>
                    </p>
                </motion.div>
            </div>
        </MobileShell>
    );
};

export default ClientLogin;
