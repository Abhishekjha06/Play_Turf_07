import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import heroNight from "@/assets/hero-night-turf.webp";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupFormValues } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackEvent, identifyUser } from "@/lib/analytics";

const Signup = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent("Signup Started");
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", phone: "", password: "", confirmPassword: "" }
  });

  const onSubmit = async (data: SignupFormValues) => {
    setLoading(true);
    try {
      const isAllowed = await checkRateLimit(data.email, 'signup', 5, 60);
      if (!isAllowed) {
        toast.error("Too many signup attempts. Please try again later.");
        return;
      }

      const supabase = await getSupabase();

      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone: data.phone,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      if (authData.user) {
        identifyUser(authData.user.id, { email: data.email, full_name: data.fullName });
      }
      trackEvent("Signup Completed", { method: "email" });

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
            <form onSubmit={handleSubmit(onSubmit)} className="rounded-3xl border border-white/10 bg-panel-2/80 p-5 text-left space-y-4">
              <div>
                <input
                  {...register("fullName")}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-background px-4 text-sm outline-none focus:border-primary"
                  placeholder="Full Name"
                  type="text"
                />
                {errors.fullName && <p className="text-destructive text-xs mt-1 ml-1">{errors.fullName.message}</p>}
              </div>

              <div>
                <input
                  {...register("email")}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-background px-4 text-sm outline-none focus:border-primary"
                  placeholder="Email Address"
                  type="email"
                />
                {errors.email && <p className="text-destructive text-xs mt-1 ml-1">{errors.email.message}</p>}
              </div>

              <div>
                <input
                  {...register("phone")}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-background px-4 text-sm outline-none focus:border-primary"
                  placeholder="Phone Number (10 digits)"
                  type="tel"
                />
                {errors.phone && <p className="text-destructive text-xs mt-1 ml-1">{errors.phone.message}</p>}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
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
              {errors.password && <p className="text-destructive text-xs mt-1 ml-1">{errors.password.message}</p>}

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  {...register("confirmPassword")}
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
              {errors.confirmPassword && <p className="text-destructive text-xs mt-1 ml-1">{errors.confirmPassword.message}</p>}
              
              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full bg-primary text-primary-foreground font-semibold rounded-full py-3 text-sm pressable disabled:opacity-50"
              >
                {loading ? "Signing up..." : "Sign Up"}
              </button>
            </form>

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
