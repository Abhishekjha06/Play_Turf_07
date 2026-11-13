/**
 * /admin/login — dedicated admin authentication.
 *
 * Flow: Supabase email+password → server-verified admin role
 * (adminPasswordSignIn re-reads profiles and signs non-admins out) →
 * TOTP MFA challenge when factors are enrolled (AAL2) → dashboard.
 *
 * No shared keyword, no hardcoded credentials. New admins are provisioned by
 * an existing Super Admin creating their auth user + profile role.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Loader2, Lock, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { checkRateLimit, recordRateLimitAttempt } from "@/lib/rate-limit";
import { useSeo } from "@/hooks/use-seo";
import { getAalStatus, listFactors, verifyTotp } from "./admin-mfa";
import { isAdminRole } from "./admin-rbac";

type Step = "credentials" | "mfa" | "mfa-enroll-hint";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Only same-origin relative paths may be used as a post-login target.
  const rawNext = params.get("next") || "/admin";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";
  const stepRef = useRef(false);

  useSeo({
    title: "Admin Sign In — PlayTurf Control Center",
    description: "Secure administrator sign-in for the PlayTurf Control Center.",
    path: "/admin/login",
    noindex: true,
  });

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaFactors, setMfaFactors] = useState<{ id: string; name: string }[]>([]);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);

  // Already signed in as an admin? Straight in.
  useEffect(() => {
    (async () => {
      const supabase = await getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || stepRef.current) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (isAdminRole(profile?.role)) navigate(next, { replace: true });
    })();
  }, [navigate, next]);

  const handleCredentials = async () => {
    if (stepRef.current) return;
    if (!email.trim() || !password) {
      setError("Enter your administrator email and password.");
      return;
    }
    setError(null);
    stepRef.current = true;
    setBusy(true);
    try {
      const identifier = email.trim().toLowerCase();
      // Client-side rate limit (server-side enforcement requires the edge
      // function noted in the deployment checklist).
      const allowed = await checkRateLimit(identifier, "admin_login").catch(() => true);
      if (!allowed) {
        throw new Error("Too many attempts. Try again in 15 minutes.");
      }

      try {
        await api.adminPasswordSignIn(identifier, password);
      } catch (authErr) {
        await recordRateLimitAttempt(identifier, "admin_login").catch(() => {});
        throw authErr;
      }

      // Second factor: if TOTP factors are enrolled, require AAL2 now.
      const factors = await listFactors().catch(() => []);
      if (factors.length > 0) {
        const aal = await getAalStatus();
        if (aal.current !== "aal2") {
          setMfaFactors(factors.filter((f) => f.status === "verified").map((f) => ({ id: f.id, name: f.friendly_name || "Authenticator" })));
          setStep("mfa");
          return;
        }
      }
      navigate(next, { replace: true });
    } catch (e) {
      setError((e as Error).message || "Sign-in failed.");
    } finally {
      stepRef.current = false;
      setBusy(false);
    }
  };

  const handleMfa = async () => {
    setMfaError(null);
    setBusy(true);
    try {
      const factorId = mfaFactors[0]?.id;
      if (!factorId) throw new Error("No authenticator found. Sign in again.");
      const ok = await verifyTotp(factorId, mfaCode);
      if (!ok) {
        setMfaError("Invalid code. Check your authenticator app and try again.");
        return;
      }
      const aal = await getAalStatus();
      if (aal.current !== "aal2") {
        // Verification succeeded but the session didn't upgrade — block rather
        // than pretend the second factor passed.
        setMfaError("Second factor could not be verified. Sign in again.");
        return;
      }
      navigate(next, { replace: true });
    } catch (e) {
      setMfaError((e as Error).message || "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-root grid min-h-dvh place-items-center bg-[#050606] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <h1 className="text-xl font-black tracking-tight text-white">PlayTurf Control Center</h1>
          <p className="mt-1 text-xs text-zinc-500">Administrator access only. All sign-ins are rate-limited and logged.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0c0e0d] p-5 shadow-2xl">
          {step === "credentials" && (
            <div className="space-y-3.5">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  <Mail className="h-3 w-3" /> Admin email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#080a09] px-3.5 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                  placeholder="admin@playturf.app"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  <Lock className="h-3 w-3" /> Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCredentials()}
                  autoComplete="current-password"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#080a09] px-3.5 text-sm text-zinc-100 outline-none focus:border-teal-400/40"
                  placeholder="••••••••"
                />
              </label>

              {error && <p className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-2.5 text-xs text-rose-300">{error}</p>}

              <button
                onClick={handleCredentials}
                disabled={busy}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-500 text-xs font-black uppercase tracking-widest text-[#04110e] transition hover:bg-teal-400 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {busy ? "Verifying…" : "Sign in securely"}
              </button>
              <p className="text-center text-[10px] leading-relaxed text-zinc-600">
                Accounts without an administrator role are signed out automatically.
                MFA is enforced when an authenticator is enrolled.
              </p>
            </div>
          )}

          {step === "mfa" && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-teal-300">
                <Smartphone className="h-3.5 w-3.5" /> Two-factor authentication
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">
                Enter the 6-digit code from <b className="text-zinc-200">{mfaFactors[0]?.name || "your authenticator"}</b> to
                complete sign-in.
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && mfaCode.length === 6 && handleMfa()}
                className="h-12 w-full rounded-xl border border-white/10 bg-[#080a09] text-center text-xl font-black tracking-[0.4em] text-zinc-100 outline-none focus:border-teal-400/40"
                placeholder="000000"
              />
              {mfaError && <p className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-2.5 text-xs text-rose-300">{mfaError}</p>}
              <button
                onClick={handleMfa}
                disabled={busy || mfaCode.length !== 6}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-500 text-xs font-black uppercase tracking-widest text-[#04110e] hover:bg-teal-400 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify code
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-zinc-600">
          Not an administrator? <a href="/" className="text-teal-400 hover:underline">Back to PlayTurf</a>
        </p>
      </div>
    </div>
  );
}
