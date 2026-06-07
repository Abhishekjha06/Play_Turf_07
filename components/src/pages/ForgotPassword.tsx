import { useState } from "react";
import { Link } from "react-router-dom";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import heroNight from "@/assets/hero-night-turf.webp";
import { checkRateLimit } from "@/lib/rate-limit";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    try {
      const isAllowed = await checkRateLimit(email, 'reset', 3, 60);
      if (!isAllowed) {
        toast.error("Too many reset attempts. Please try again later.");
        return;
      }

      const supabase = await getSupabase();
      if (!supabase) throw new Error("Supabase is not configured");

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (error) throw error;

      setSent(true);
      toast.success("Password reset email sent!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell>
      <div className="absolute inset-0">
        <img src={heroNight} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
      </div>

      <div className="relative z-10 px-5 pt-6">
        <BackButton />
      </div>

      <div className="relative z-10 px-5 pt-16 flex flex-col items-center text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display font-extrabold text-3xl">
            Reset Password
          </h1>
          <p className="mt-2 text-soft text-sm">Enter your email to receive a reset link</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-10 w-full max-w-sm"
        >
          {!sent ? (
            <div className="rounded-3xl border border-white/10 bg-panel-2/80 p-5 text-left">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-background px-4 text-sm outline-none focus:border-primary"
                placeholder="Email Address"
                type="email"
              />

              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="mt-4 w-full bg-primary text-primary-foreground font-semibold rounded-full py-3 text-sm pressable disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-panel-2/80 p-6 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 text-primary mx-auto flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
              <p className="text-sm text-soft">
                We sent a password reset link to <br/>
                <span className="font-medium text-foreground">{email}</span>
              </p>
              <Link to="/login" className="block mt-4 w-full bg-white/10 text-foreground font-semibold rounded-full py-3 text-sm pressable">
                Return to Login
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </MobileShell>
  );
};

export default ForgotPassword;
