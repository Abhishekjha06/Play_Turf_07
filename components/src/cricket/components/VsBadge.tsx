import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";

export function VsBadge() {
  const { themeId } = useLuxuryTheme();

  return (
    <div 
      className="relative grid h-16 w-16 place-items-center rounded-full border transition-all duration-300"
      style={{
        backgroundColor: "var(--l-card)",
        borderColor: "var(--l-divider)",
        boxShadow: "var(--l-shadow-glow)",
      }}
    >
      <div 
        className="absolute inset-0 animate-ping rounded-full border opacity-20"
        style={{ borderColor: "var(--primary)" }}
      />
      <div 
        className="absolute inset-1.5 rounded-full opacity-20 blur-sm"
        style={{ background: "var(--gradient-neon)" }}
      />
      <span 
        className="relative text-xl font-black font-display tracking-tight bg-clip-text text-transparent"
        style={{ backgroundImage: "var(--gradient-neon)" }}
      >
        VS
      </span>
    </div>
  );
}
