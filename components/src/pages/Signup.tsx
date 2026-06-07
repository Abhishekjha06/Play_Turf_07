import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import heroNight from "@/assets/hero-night-turf.webp";

const Signup = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }

    // Basic password strength check as requested
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      toast.error("Password must be at least 8 chars, 1 uppercase, 1 lowercase, 1 number");
      return;
    }

    setLoading(true);
    try {
      const supabase = await getSupabase();
      if (!supabase) throw new Error("Supabase is not configured.");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      toast.success("Verification email sent! Please check your inbox.");
      navigate("/login");
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

      <div className="relative z-10 px-5 pt-10 flex flex-col items-center text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display font-extrabold text-3xl">
            Create Account
          </h1>
          <p className="mt-2 text-soft text-sm">Join play_Turf today</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-8 w-full max-w-sm"
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-panel-2/80 p-5 text-left space-y-4">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-background px-4 text-sm outline-none focus:border-primary"
                placeholder="Full Name"
                type="text"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-background px-4 text-sm outline-none focus:border-primary"
                placeholder="Email Address"
                type="email"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-background px-4 text-sm outline-none focus:border-primary"
                placeholder="Phone Number (10 digits)"
                type="tel"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-background px-4 pr-10 text-sm outline-none focus:border-primary"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-soft hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-background px-4 pr-10 text-sm outline-none focus:border-primary"
                  placeholder="Confirm Password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-soft hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              <button
                onClick={handleSignup}
                disabled={loading}
                className="mt-4 w-full bg-primary text-primary-foreground font-semibold rounded-full py-3 text-sm pressable disabled:opacity-50"
              >
                {loading ? "Signing up..." : "Sign Up"}
              </button>
            </div>

            <p className="text-sm text-soft mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Log In
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </MobileShell>
  );
};

export default Signup;
