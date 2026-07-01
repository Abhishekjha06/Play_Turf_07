import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { getSupabase } from "@/lib/supabase";
import { refreshUser } from "@/lib/auth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import heroNight from "@/assets/hero-night-turf.webp";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackEvent, identifyUser } from "@/lib/analytics";



const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectUrl = location.state?.from || "/";
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent("Login Started");
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    await handleSupabaseLogin(data);
    setLoading(false);
  };

  const handleSupabaseLogin = async (formData: LoginFormValues) => {
    try {
      const isAllowed = await checkRateLimit(formData.email, 'login', 5, 15);
      if (!isAllowed) {
        toast.error("Too many login attempts. Please try again later.");
        return;
      }

      const supabase = await getSupabase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      // Check if email is verified
      if (data.user && !data.user.email_confirmed_at) {
        toast.error("Please verify your email first.");
        await supabase.auth.signOut();
        return;
      }

      // Check / Create profile if missing
      let role = "user";
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", data.user.id)
          .single();

        if (!profile) {
          const fullName = data.user.user_metadata?.full_name || "User";
          const phone = data.user.user_metadata?.phone || "0000000000";

          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              full_name: fullName,
              phone: phone,
            });

          if (profileError) {
            console.error("Failed to create profile:", profileError);
            toast.error("Error creating user profile");
          }
        } else {
          role = profile.role || "user";
        }
      }

      // Synchronise the auth store BEFORE navigating so that
      // ProtectedRoute / AdminRoute / ClientRoute see a valid user
      // immediately (no race with the async onAuthStateChange listener).
      await refreshUser();

      toast.success("Signed in successfully");
      identifyUser(data.user.id, { email: formData.email });
      trackEvent("Login", { method: "supabase" });
      
      if (role === "super_admin" || role === "admin") {
        navigate("/admin");
      } else {
        navigate(redirectUrl);
      }
    } catch (err: any) {
      if (err.message === "Invalid login credentials") {
        toast.error("Invalid credentials. If you just signed up, please check your email to verify your account first.");
      } else {
        toast.error(err.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const supabase = await getSupabase();

      if (location.state?.from) {
        localStorage.setItem("play_turf_post_login_redirect", location.state.from);
      } else {
        localStorage.removeItem("play_turf_post_login_redirect");
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      if (error) throw error;
      trackEvent("Login", { method: "google" });
    } catch (e: any) {
      toast.error(e.message);
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
          <h1 className="font-display font-extrabold text-4xl">
            <span className="text-foreground">play</span><span className="neon-text">_Turf</span>
          </h1>
          <p className="mt-2 text-soft text-sm tracking-[0.3em] uppercase">BookMySports</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-10 w-full max-w-sm"
        >
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold rounded-full py-3 text-sm pressable hover:bg-gray-100 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-soft">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="rounded-3xl border border-white/10 bg-panel-2/80 p-5 text-left">
              <input
                {...register("email")}
                className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-background px-4 text-sm outline-none focus:border-primary"
                placeholder="Email Address"
                type="email"
              />
              {errors.email && <p className="text-destructive text-xs mt-1 ml-1">{errors.email.message}</p>}
              
              <div className="relative mt-3">
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
              
              <div className="flex justify-end mt-2">
                <Link to="/forgot-password" className="text-xs text-soft hover:text-primary">
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full bg-foreground text-background font-semibold rounded-full py-3 text-sm pressable disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
            
            <p className="text-sm text-soft mt-4">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline">
                Sign Up
              </Link>
            </p>

          </div>
        </motion.div>
      </div>
    </MobileShell>
  );
};

export default Login;
