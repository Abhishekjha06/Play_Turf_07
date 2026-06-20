import { useState } from "react";
import { RotateCcw, Settings2, Sparkles, Check, Crown, Award, Zap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useCricketBooking } from "../BookingContext";
import { TeamAvatar, getMascotForTeam } from "../components/TeamAvatar";
import { TeamSearchSelect } from "../components/TeamSearchSelect";
import { TeamManagerModal } from "../components/TeamManagerModal";
import { VsBadge } from "../components/VsBadge";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";

const PACKAGES = [
  {
    id: "starter",
    name: "Starter",
    price: 500,
    desc: "Best for casual matches",
    features: ["Standard pitch access", "Basic kit provided", "1-hour play time"],
    icon: Zap,
  },
  {
    id: "premium",
    name: "Premium",
    price: 1000,
    desc: "Most popular choice",
    features: ["Premium pitch booking", "Full equipment access", "2-hour play time", "Refreshment lounge"],
    icon: Award,
    popular: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: 2000,
    desc: "For serious matches",
    features: ["Professional match pitch", "Pro-grade equipment kit", "3-hour play time", "Locker room access", "Live recording feed"],
    icon: ShieldCheck,
  },
  {
    id: "vip",
    name: "VIP",
    price: 5000,
    desc: "Luxury experience",
    features: ["Executive private turf", "Elite equipment concierge", "Unlimited match time", "VIP lounge & hospitality", "Match umpire & ballboy", "4K video broadcast feed"],
    icon: Crown,
  },
];

export function PickMatch() {
  const { state, teamA, teamB, setTeamA, setTeamB, setAmount, setStep, resetFlow } = useCricketBooking();
  const { theme, themeId } = useLuxuryTheme();
  const [managerOpen, setManagerOpen] = useState(false);

  // Derive active package from amount inside the cricket context
  const selectedPkg = PACKAGES.find((p) => p.price === state.amount);

  const handleSelectPackage = (price: number) => {
    setAmount(price);
  };

  const handleReset = () => {
    resetFlow();
    setAmount(0); // Clear selected package amount
  };

  const continueFlow = () => {
    if (!teamA || !teamB) return toast.error("Select two teams to proceed");
    if (teamA.id === teamB.id) return toast.error("Choose two different teams");
    if (!selectedPkg) return toast.error("Please choose a premium package");
    setStep(2);
  };

  // Receipt calculations
  const baseAmount = state.amount;
  const taxes = Math.round(baseAmount * 0.18); // 18% luxury sports levy
  const totalAmount = baseAmount + taxes;

  const isFormValid = !!(teamA && teamB && teamA.id !== teamB.id && selectedPkg);

  // Dynamic card styling mapping based on theme and active state
  const getCardStyles = (pkgId: string, active: boolean) => {
    if (themeId === "dusky-white") {
      return {
        cardBg: active ? "#FFFDF9" : "#FFF8EE",
        borderColor: active ? "transparent" : "rgba(212, 175, 55, 0.22)",
        shadow: active 
          ? "0 12px 30px rgba(58, 47, 36, 0.09), 0 0 15px rgba(212, 175, 55, 0.2)" 
          : "0 4px 16px rgba(58, 47, 36, 0.04)",
        gradientBorder: active ? "var(--gradient-neon)" : "none",
        iconBg: active ? "rgba(212, 175, 55, 0.12)" : "rgba(58, 47, 36, 0.04)",
        iconColor: active ? "#A87820" : "#75624C",
        badgeBg: "rgba(91, 140, 90, 0.12)",
        badgeText: "#5B8C5A",
        textColor: "#3A2F24",
        textSecColor: "#75624C"
      };
    } else if (themeId === "midnight-gold") {
      return {
        cardBg: active ? "#1a1f2e" : "#131722",
        borderColor: active ? "transparent" : "rgba(255, 215, 0, 0.12)",
        shadow: active 
          ? "0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 215, 0, 0.25)" 
          : "0 6px 20px rgba(0, 0, 0, 0.4)",
        gradientBorder: active ? "linear-gradient(135deg, #FFD700 0%, #B8860B 100%)" : "none",
        iconBg: active ? "rgba(255, 215, 0, 0.12)" : "rgba(255, 255, 255, 0.04)",
        iconColor: active ? "#FFD700" : "#B8B8B8",
        badgeBg: "rgba(255, 215, 0, 0.15)",
        badgeText: "#FFD700",
        textColor: "#FFFFFF",
        textSecColor: "#B8B8B8"
      };
    } else {
      // amoled-black
      return {
        cardBg: active ? "#090909" : "#000000",
        borderColor: active ? "transparent" : "rgba(255, 255, 255, 0.08)",
        shadow: active 
          ? "0 12px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 230, 118, 0.3)" 
          : "none",
        gradientBorder: active ? "linear-gradient(135deg, #00E676 0%, #FFD700 100%)" : "none",
        iconBg: active ? "rgba(0, 230, 118, 0.15)" : "rgba(255, 255, 255, 0.03)",
        iconColor: active ? "#00E676" : "#A0A0A0",
        badgeBg: "rgba(0, 230, 118, 0.2)",
        badgeText: "#00E676",
        textColor: "#FFFFFF",
        textSecColor: "#A0A0A0"
      };
    }
  };

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 pb-28 lg:grid-cols-[1.2fr_.8fr] lg:pb-8">
      {/* ── Main Picker Area ──────────────────────────────── */}
      <div 
        className="card-panel rounded-3xl p-5 shadow-2xl transition-all duration-300 sm:p-6"
        style={{ background: "var(--l-card)", borderColor: "var(--l-divider)" }}
      >
        {/* Step Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
              Step 1 of 3
            </p>
            <h2 className="text-2xl font-black text-foreground sm:text-3xl font-display mt-0.5">
              Pick Your Match
            </h2>
          </div>
          <button 
            type="button" 
            onClick={() => setManagerOpen(true)} 
            className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-panel hover:bg-panel-2 transition-colors cursor-pointer"
            title="Team Settings"
          >
            <Settings2 className="h-5 w-5 text-foreground/80" />
          </button>
        </div>

        {/* Team Search Selects */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <TeamSearchSelect label="Team A" teams={state.teams} value={state.teamAId} blockedId={state.teamBId} onChange={setTeamA} />
          <div className="mx-auto hidden pb-3 md:block">
            <VsBadge />
          </div>
          <TeamSearchSelect label="Team B" teams={state.teams} value={state.teamBId} blockedId={state.teamAId} onChange={setTeamB} />
        </div>

        <div className="my-5 grid place-items-center md:hidden">
          <VsBadge />
        </div>

        {/* Live Match Vs Preview Banner */}
        <div className="mt-6 rounded-[28px] border border-emerald-500/20 bg-[#050B0F] p-4 md:p-6 lg:p-8 relative overflow-hidden transition-all duration-300 shadow-[0_0_35px_rgba(16,185,129,0.15)]">
          {/* Subtle green neon spotlight beam */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/15 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10 items-center justify-items-center relative z-10">
            <TeamPreview side="A" />
            
            {/* VS Section */}
            <div className="flex items-center justify-center py-4 md:py-0 self-center">
              <div className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-emerald-500/30 to-black rounded-full border border-emerald-400/40 shadow-[0_0_40px_rgba(16,185,129,0.4)] flex items-center justify-center relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/10 opacity-30" />
                <span className="relative text-2xl md:text-3xl font-black font-display tracking-tight text-white">
                  VS
                </span>
              </div>
            </div>

            <TeamPreview side="B" />
          </div>
        </div>

        {/* Premium Package Selector Header */}
        <div className="mt-8 mb-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            Select Booking Package
          </h3>
          <p className="text-xs text-muted-foreground mt-1.5">
            Choose a curated luxury athletic tier configured with premium sports club hospitality.
          </p>
        </div>

        {/* Premium Packages Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {PACKAGES.map((pkg) => {
            const active = selectedPkg?.id === pkg.id;
            const PkgIcon = pkg.icon;
            const styleOpts = getCardStyles(pkg.id, active);

            return (
              <motion.div
                key={pkg.id}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectPackage(pkg.price)}
                className="cursor-pointer relative rounded-[20px] transition-all duration-300"
                style={{
                  padding: active ? "2.5px" : "2px",
                  background: active ? styleOpts.gradientBorder : "transparent",
                  boxShadow: styleOpts.shadow,
                }}
              >
                <div
                  className="w-full h-full rounded-[18px] p-5 flex flex-col justify-between transition-all duration-300"
                  style={{
                    backgroundColor: styleOpts.cardBg,
                    border: active ? "none" : `1px solid ${styleOpts.borderColor}`,
                  }}
                >
                  {/* Package Main Info */}
                  <div>
                    <div className="flex items-start justify-between">
                      <div 
                        className="w-10 h-10 rounded-xl grid place-items-center border border-border/30 transition-colors"
                        style={{ backgroundColor: styleOpts.iconBg }}
                      >
                        <PkgIcon className="h-5 w-5 transition-transform" style={{ color: styleOpts.iconColor }} />
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase font-extrabold tracking-widest" style={{ color: styleOpts.textSecColor }}>
                          Package Cost
                        </p>
                        <p className="text-2xl font-black font-display mt-0.5 text-primary">
                          Rs {pkg.price}
                        </p>
                      </div>
                    </div>

                    <h4 className="text-base font-black font-display mt-4 flex items-center gap-1.5" style={{ color: styleOpts.textColor }}>
                      {pkg.name}
                      {pkg.popular && (
                        <span 
                          className="text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: styleOpts.badgeBg, color: styleOpts.badgeText }}
                        >
                          Popular
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] mt-1 leading-relaxed font-semibold" style={{ color: styleOpts.textSecColor }}>
                      {pkg.desc}
                    </p>
                  </div>

                  {/* Features Checklist */}
                  <div className="mt-5 pt-4 border-t flex flex-col gap-2" style={{ borderTopColor: active ? "rgba(255,255,255,0.06)" : "var(--l-divider)" }}>
                    {pkg.features.map((feat) => (
                      <div key={feat} className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3.5} />
                        </div>
                        <span className="text-[11px] font-semibold leading-none" style={{ color: styleOpts.textColor }}>
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Selector indicator */}
                  <div className="mt-5 pt-3 border-t flex items-center justify-between" style={{ borderTopColor: active ? "rgba(255,255,255,0.06)" : "var(--l-divider)" }}>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: styleOpts.textSecColor }}>
                      Premium Tier
                    </span>
                    <div className="flex items-center gap-1.5">
                      {active && (
                        <span 
                          className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
                          style={{ 
                            background: themeId === "amoled-black" ? "rgba(0, 230, 118, 0.15)" : "var(--gradient-neon)",
                            color: themeId === "amoled-black" ? "#00E676" : "var(--primary-foreground)" 
                          }}
                        >
                          Active
                        </span>
                      )}
                      <div className="w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300"
                        style={{
                          borderColor: active ? "var(--primary)" : "rgba(255, 255, 255, 0.2)",
                          backgroundColor: active ? "var(--primary)" : "transparent",
                        }}
                      >
                        {active && <Check size={11} className="text-primary-foreground" strokeWidth={4} />}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer Actions (Desktop Only) */}
        <div className="mt-8 hidden gap-3 border-t border-border/40 pt-6 sm:flex">
          <button
            onClick={continueFlow}
            disabled={!isFormValid}
            className="flex-1 pressable h-12 rounded-full font-bold text-sm tracking-wide bg-gradient-neon text-primary-foreground shadow-neon disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.5} /> Continue to Booking
          </button>
          <button
            onClick={handleReset}
            className="px-6 pressable h-12 rounded-full font-bold text-sm tracking-wide border border-border bg-panel hover:bg-panel-2 text-foreground transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      {/* ── Receipt Summary Aside ─────────────────────────── */}
      <div className="flex flex-col gap-6">
        {/* Premium Booking Summary Card */}
        <div 
          className="glass rounded-3xl p-5 border border-border/45 shadow-xl flex flex-col transition-all duration-300"
          style={{ backgroundColor: "var(--l-card)", borderColor: "var(--l-divider)" }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Crown size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Match Ticket
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Sports Club Booking
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            {/* Matches */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Fixture</span>
              <span className="font-bold text-foreground truncate max-w-[140px]">
                {teamA && teamB ? `${teamA.name} vs ${teamB.name}` : "Pending Teams"}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Select State</span>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                teamA && teamB ? "bg-primary/12 text-primary" : "bg-panel text-muted-foreground"
              }`}>
                {teamA && teamB ? "Ready" : "Fixture Incomplete"}
              </span>
            </div>

            <div className="h-[1px] border-b border-dashed border-border/60 my-2" />

            {/* Selected Package Details */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Active Tier</span>
              <span className="font-extrabold text-foreground">
                {selectedPkg ? selectedPkg.name : "None Selected"}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Package Fee</span>
              <span className="font-extrabold text-foreground">
                {selectedPkg ? `Rs ${selectedPkg.price}` : "Rs 0"}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Sports Service GST (18%)</span>
              <span className="font-extrabold text-foreground">
                {selectedPkg ? `Rs ${taxes}` : "Rs 0"}
              </span>
            </div>

            <div className="h-[1px] border-b border-dashed border-border/60 my-2" />

            {/* Grand Total */}
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Estimated Total</p>
                <p className="text-lg font-black text-foreground">GRAND TOTAL</p>
              </div>
              <p className="text-2xl font-black text-primary leading-none">
                Rs {selectedPkg ? totalAmount.toLocaleString() : "0"}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-panel border border-border/40 p-3.5 flex gap-2.5 items-start">
            <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Match locks are secured in real-time under premium sports club rules. Cancellations are subject to concierge availability. Refund balance is posted directly to your PlayTurf Wallet.
            </p>
          </div>
        </div>

        {/* Side Info Cards */}
        <aside 
          className="glass rounded-3xl p-5 border border-border/40"
          style={{ backgroundColor: "var(--l-card)", borderColor: "var(--l-divider)" }}
        >
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-primary">
            Market Pulse
          </p>
          <h3 className="mt-1.5 text-lg font-black text-foreground font-display">
            Aman Elite Booking Rules
          </h3>
          <div className="mt-4 space-y-2.5">
            {[
              "Locker access & priority check-in enabled",
              "Concierge ballboy and umpire assigned to VIP",
              "Editable team roster locked on continue",
              "Supabase real-time match sync active",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-border bg-panel-2/50 p-3">
                <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-neon flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground/80 leading-tight">{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ── Sticky Mobile Footer (Floating Luxury Action Bar) ──────────────────────────── */}
      <div 
        className="fixed bottom-4 inset-x-4 z-30 rounded-[24px] border bg-panel-3/95 p-3.5 shadow-2xl backdrop-blur-xl sm:hidden"
        style={{ borderColor: "var(--l-divider)" }}
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-2">
          <div>
            <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider leading-none">GRAND TOTAL</p>
            <p className="text-lg font-black text-primary leading-none mt-1">
              Rs {selectedPkg ? totalAmount.toLocaleString() : "0"}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={continueFlow}
              disabled={!isFormValid}
              className="pressable h-10 rounded-full font-bold text-xs tracking-wide bg-gradient-neon text-primary-foreground shadow-neon disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer px-5"
            >
              Continue
            </button>
            <button
              onClick={handleReset}
              className="pressable h-10 rounded-full border border-border bg-panel text-foreground cursor-pointer px-3.5 flex items-center justify-center"
              title="Reset Flow"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <TeamManagerModal open={managerOpen} onOpenChange={setManagerOpen} />
    </section>
  );

  function TeamPreview({ side }: { side: "A" | "B" }) {
    const team = side === "A" ? teamA : teamB;
    const teamGlow = team?.colors?.[0] ? `${team.colors[0]}22` : "rgba(16,185,129,0.05)";

    return (
      <div 
        className="w-full max-w-[280px] md:max-w-[340px] lg:max-w-[400px] h-auto flex flex-col items-center justify-center bg-[#0B0F14] border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)] rounded-3xl p-5 md:p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(16,185,129,0.35)] relative overflow-hidden"
        style={{ 
          boxShadow: team?.colors?.[0] 
            ? `0 0 30px ${teamGlow}, 0 0 30px rgba(16,185,129,0.2)`
            : undefined
        }}
      >
        {/* Subtle diagonal background mesh pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        
        {/* Team Glow spotlight background */}
        <div 
          className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-[40px] opacity-20 pointer-events-none"
          style={{ background: team?.colors?.[0] ?? "#10b981" }}
        />

        {/* Logo Section */}
        <div className="aspect-square flex items-center justify-center w-full mb-2">
          <TeamAvatar variant="sports" size="card-redesign" team={team} />
        </div>

        {/* Team Name */}
        <h3 
          className="text-center font-bold max-w-[90%] mx-auto truncate px-2 leading-tight !text-white font-display mb-1"
          style={{ fontSize: "clamp(12px, 2vw, 22px)" }}
          title={team?.name || `Select Team ${side}`}
        >
          {team ? team.name : `Select Team ${side}`}
        </h3>

        {/* Team Initials */}
        <p className="text-xs opacity-70 text-center font-semibold !text-white uppercase tracking-wider leading-none">
          {team ? team.shortName : `T${side}`}
        </p>
      </div>
    );
  }
}
