export function VsBadge({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative grid place-items-center rounded-full border transition-all duration-300 ${
        compact ? "h-14 w-14" : "h-16 w-16"
      }`}
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
        className={`relative font-black font-display tracking-tight bg-clip-text text-transparent ${
          compact ? "text-lg" : "text-xl"
        }`}
        style={{ backgroundImage: "var(--gradient-neon)" }}
      >
        VS
      </span>
    </div>
  );
}
