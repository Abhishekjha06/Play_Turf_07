import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { signInWithGoogle } from "@/lib/auth";
import { Briefcase, Lock, User } from "lucide-react";

const ClientLogin = () => {
    const navigate = useNavigate();
    const [clientId, setClientId] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleClientLogin = async () => {
        if (!clientId.trim() || !password.trim()) {
            toast.error("Please enter client ID and password");
            return;
        }
        setLoading(true);
        try {
            if (clientId.trim() === "abhishek1018@" && password === "123456789") {
                localStorage.setItem("client_token", "mock_client_token_abhishek");
                localStorage.setItem("client_id", "abhishek1018@");
                await signInWithGoogle("client");
                toast.success("Welcome Abhishek!");
                navigate("/client/dashboard");
            } else {
                toast.error("Invalid credentials. Use the demo button to test.");
            }
        } catch (error) {
            toast.error((error as Error).message || "Invalid credentials");
        } finally {
            setLoading(false);
        }
    };

    const handleMockLogin = async () => {
        localStorage.setItem("client_token", "mock_client_token_abhishek");
        localStorage.setItem("client_id", "abhishek1018@");
        await signInWithGoogle("client");
        toast.success("Demo client login successful");
        navigate("/client/dashboard");
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

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-3 bg-panel-2 text-[11px] text-muted2 uppercase tracking-wider">
                                    or
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleMockLogin}
                            className="w-full rounded-full border border-white/15 py-3 text-sm font-semibold text-soft pressable hover:bg-white/5 min-h-[44px]"
                        >
                            Try Demo Dashboard
                        </button>

                        <div className="rounded-2xl border border-white/5 bg-white/5 p-3 text-xs text-muted2 space-y-1">
                            <p className="font-semibold text-soft">Demo Credentials:</p>
                            <p>Client ID: <span className="text-primary">abhishek1018@</span></p>
                            <p>Password: <span className="text-primary">123456789</span></p>
                        </div>
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
