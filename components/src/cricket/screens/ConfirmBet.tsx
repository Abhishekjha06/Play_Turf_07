import { useState } from "react";
import { ArrowLeft, CreditCard, Loader2, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useCricketBooking } from "../BookingContext";
import { mockConfirmBooking } from "../mockApi";
import type { PaymentMethod } from "../types";
import { TeamAvatar } from "../components/TeamAvatar";
import { NeonButton } from "../components/NeonButton";
import { VsBadge } from "../components/VsBadge";

import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";

const methods: Array<{ value: PaymentMethod; label: string; icon: typeof Smartphone }> = [
  { value: "UPI", label: "Fake UPI", icon: Smartphone },
  { value: "Card", label: "Card", icon: CreditCard },
  { value: "Wallet", label: "Wallet", icon: Wallet },
];

export function ConfirmBet() {
  const { state, teamA, teamB, potentialWin, setStep, setPaymentMethod, completeBooking } = useCricketBooking();
  const { themeId } = useLuxuryTheme();
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    await mockConfirmBooking();
    completeBooking();
    toast.success("Booking confirmed");
    setLoading(false);
  };

  return (
    <section className="mx-auto w-full max-w-4xl pb-28 sm:pb-8">
      <div className="card-panel rounded-3xl p-5 shadow-2xl transition-all duration-300 sm:p-7"
           style={{ backgroundColor: "var(--l-card)", borderColor: "var(--l-divider)" }}>
        <button 
          type="button" 
          onClick={() => setStep(1)} 
          className="mb-5 inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-4 py-2 text-sm font-bold text-foreground hover:bg-panel-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <TeamSummary name={teamA?.name} side="Team A" />
          <div className="mx-auto"><VsBadge /></div>
          <TeamSummary name={teamB?.name} side="Team B" right />
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Stat label="Amount" value={`Rs ${state.amount.toLocaleString("en-IN")}`} />
          <Stat label="Mock Odds" value={`${state.odds}x`} />
          <Stat label="Potential Win" value={`Rs ${potentialWin.toLocaleString("en-IN")}`} />
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-panel-2 p-4 transition-all"
             style={{ borderColor: "var(--l-divider)", backgroundColor: "var(--l-bg-secondary)" }}>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Booking ID</p>
          <p className="mt-1 break-all text-base font-black text-foreground font-display">{state.bookingId}</p>
        </div>

        <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-widest text-primary">Mock Payment</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {methods.map((method) => {
              const Icon = method.icon;
              const active = method.value === state.paymentMethod;
              return (
                <button 
                  key={method.value} 
                  type="button" 
                  onClick={() => setPaymentMethod(method.value)} 
                  className={`rounded-2xl border p-4 text-left transition-all duration-300 cursor-pointer ${
                    active 
                      ? "border-primary shadow-lg scale-[1.02]" 
                      : "border-border hover:border-primary/40"
                  }`}
                  style={{
                    backgroundColor: active ? "var(--l-accent-soft)" : "var(--l-card)",
                    boxShadow: active ? "var(--l-shadow-glow)" : "none",
                    borderColor: active ? "var(--primary)" : "var(--l-divider)"
                  }}
                >
                  <Icon className={`mb-3 h-5 w-5 ${active ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                  <span className="font-bold text-foreground block">{method.label}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Demo only</span>
                </button>
              );
            })}
          </div>
        </div>

        <NeonButton onClick={confirm} disabled={loading} className="mt-7 hidden w-full sm:flex">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Confirming..." : "Confirm Bet"}
        </NeonButton>
      </div>

      {/* Floating Sticky Mobile Footer */}
      <div 
        className="fixed bottom-4 inset-x-4 z-30 rounded-[24px] border bg-panel-3/95 p-3.5 shadow-2xl backdrop-blur-xl sm:hidden"
        style={{ borderColor: "var(--l-divider)" }}
      >
        <NeonButton onClick={confirm} disabled={loading} className="mx-auto w-full max-w-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Confirming..." : "Confirm Bet"}
        </NeonButton>
      </div>
    </section>
  );

  function TeamSummary({ name, side, right }: { name?: string; side: string; right?: boolean }) {
    const team = right ? teamB : teamA;
    return (
      <div className="rounded-3xl border border-border bg-panel-2 p-5 text-center transition-all duration-300"
           style={{ backgroundColor: "var(--l-bg-secondary)", borderColor: "var(--l-divider)" }}>
        <TeamAvatar team={team} size="lg" className="mx-auto border border-border/40 shadow-sm" />
        <p className="mt-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{side}</p>
        <h3 className="mt-1 text-lg font-black text-foreground font-display">{name}</h3>
      </div>
    );
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-panel p-4 transition-all duration-300"
         style={{ backgroundColor: "var(--l-card)", borderColor: "var(--l-divider)" }}>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black text-foreground font-display">{value}</p>
    </div>
  );
}
