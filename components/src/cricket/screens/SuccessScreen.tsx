import { Check, Download, RotateCcw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useCricketBooking } from "../BookingContext";
import { TeamAvatar } from "../components/TeamAvatar";
import { NeonButton } from "../components/NeonButton";

import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";

export function SuccessScreen() {
  const { state, teamA, teamB, potentialWin, resetFlow } = useCricketBooking();
  const { themeId } = useLuxuryTheme();
  const timestamp = state.placedAt ? new Date(state.placedAt) : new Date();

  const receipt = [
    "PlayTurf Booking Receipt",
    `Booking ID: ${state.bookingId}`,
    `Match: ${teamA?.name} vs ${teamB?.name}`,
    `Amount: Rs ${state.amount}`,
    `Mock Odds: ${state.odds}x`,
    `Potential Win: Rs ${potentialWin}`,
    `Payment: ${state.paymentMethod}`,
    `Timestamp: ${timestamp.toLocaleString()}`,
  ].join("\n");

  const downloadReceipt = () => {
    const blob = new Blob([receipt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${state.bookingId}-receipt.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  };

  const shareReceipt = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Booking Confirmed Successfully", text: receipt });
      return;
    }
    await navigator.clipboard.writeText(receipt);
    toast.success("Receipt copied");
  };

  return (
    <section className="mx-auto w-full max-w-4xl pb-8">
      {/* Dynamic Theme Confetti */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-40">
        {Array.from({ length: 28 }).map((_, index) => (
          <span
            key={index}
            className="absolute h-2.5 w-2.5 animate-confetti rounded-full"
            style={{
              left: `${(index * 37) % 100}%`,
              animationDelay: `${(index % 9) * 0.15}s`,
              backgroundColor: index % 3 === 0 
                ? "var(--l-gold)" 
                : index % 3 === 1 
                  ? "var(--l-emerald)" 
                  : "var(--primary)",
            }}
          />
        ))}
      </div>

      <div className="card-panel relative overflow-hidden rounded-3xl p-5 text-center shadow-2xl transition-all duration-300 sm:p-8"
           style={{ backgroundColor: "var(--l-card)", borderColor: "var(--l-divider)" }}>
        
        {/* Accent Glow Line */}
        <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-neon" />
        
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border transition-all duration-300"
             style={{ 
               borderColor: "var(--l-divider)", 
               backgroundColor: "var(--l-accent-soft)",
               boxShadow: "var(--l-shadow-glow)"
             }}>
          <Check className="h-10 w-10 animate-scale-in text-primary" strokeWidth={3} />
        </div>
        
        <p className="mt-5 text-[10px] font-extrabold uppercase tracking-widest text-primary">Booking Confirmed Successfully</p>
        <h2 className="mt-2 text-2xl font-black text-foreground sm:text-4xl font-display">You are booked in</h2>

        <div className="mx-auto mt-6 grid max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-3xl border border-border bg-panel-2/50 p-4 transition-all duration-300"
             style={{ backgroundColor: "var(--l-bg-secondary)", borderColor: "var(--l-divider)" }}>
          <TeamAvatar team={teamA} size="lg" className="mx-auto border border-border/40 shadow-sm" />
          <span className="text-xl font-black font-display bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-neon)" }}>VS</span>
          <TeamAvatar team={teamB} size="lg" className="mx-auto border border-border/40 shadow-sm" />
          <p className="truncate text-sm font-black text-foreground font-display">{teamA?.name}</p>
          <span />
          <p className="truncate text-sm font-black text-foreground font-display">{teamB?.name}</p>
        </div>

        <div className="mt-5 grid gap-3.5 text-left sm:grid-cols-2">
          <Summary label="Booking Package" value={state.amount === 500 ? "Starter" : state.amount === 1000 ? "Premium" : state.amount === 2000 ? "Elite" : state.amount === 5000 ? "VIP" : "Custom"} />
          <Summary label="Booking ID" value={state.bookingId} />
          <Summary label="Timestamp" value={timestamp.toLocaleString()} />
          <Summary label="Paid Amount" value={`Rs ${state.amount.toLocaleString("en-IN")}`} />
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <NeonButton onClick={resetFlow}><RotateCcw className="h-4 w-4" /> Book Another</NeonButton>
          <NeonButton variant="ghost" onClick={downloadReceipt}><Download className="h-4 w-4" /> Receipt</NeonButton>
          <NeonButton variant="ghost" onClick={shareReceipt}><Share2 className="h-4 w-4" /> Share</NeonButton>
        </div>
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-panel p-4 transition-all duration-300"
         style={{ backgroundColor: "var(--l-card)", borderColor: "var(--l-divider)" }}>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-foreground font-display">{value}</p>
    </div>
  );
}
