import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check, Palette, Sun, Moon, Star, Award, Shield, Zap } from "lucide-react";
import { MobileShell } from "@/layout/MobileShell";
import { useLuxuryTheme, THEMES, type LuxuryThemeId } from "@/luxury/LuxuryThemeProvider";
import { CoolThemeToggle } from "@/ui/CoolThemeToggle";

const THEME_PREVIEWS: Record<LuxuryThemeId, { preview: string; accent: string; icon: React.ReactNode }> = {
    "premium-teal": {
        preview: "linear-gradient(135deg, #F1F5F9 0%, #E8F4F8 100%)",
        accent: "#14B8B0",
        icon: <Zap size={20} className="text-[#14B8B0]" />,
    },
    "amoled-black": {
        preview: "linear-gradient(135deg, #000000 0%, #090909 50%, #000000 100%)",
        accent: "#00E676",
        icon: <Moon size={20} className="text-[#00E676]" />,
    },
};

export default function ThemeSelect() {
    const { themeId, setTheme, theme } = useLuxuryTheme();
    const navigate = useNavigate();
    const themeIds = Object.keys(THEMES) as LuxuryThemeId[];

    return (
        <MobileShell>
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md px-4 py-4 flex items-center gap-3 border-b border-border/40">
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full bg-panel-2 border border-border/45 flex items-center justify-center pressable shrink-0"
                    aria-label="Go back"
                >
                    <ChevronLeft className="h-5 w-5 text-foreground" />
                </motion.button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold font-display tracking-tight">
                        App <span className="text-primary">Appearance</span>
                    </h1>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                        Elegance in Motion: PlayTurf Themes
                    </p>
                </div>
                <div className="shrink-0 flex items-center">
                    <CoolThemeToggle size="md" />
                </div>
            </div>

            {/* Showcase Presentation */}
            <div className="p-4 flex flex-col gap-4">
                {themeIds.map((id, index) => {
                    const t = THEMES[id];
                    const preview = THEME_PREVIEWS[id];
                    const isActive = themeId === id;

                    return (
                        <motion.div
                            key={id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1, duration: 0.4 }}
                            whileHover={{ y: -3 }}
                            onClick={() => setTheme(id)}
                            className={`rounded-3xl overflow-hidden cursor-pointer border-2 transition-all duration-300 ${
                                isActive 
                                    ? "border-primary shadow-[0_0_30px_rgba(var(--primary),0.15)]" 
                                    : "border-border/40 hover:border-border"
                             }`}
                            style={{
                                boxShadow: isActive ? "var(--shadow-neon)" : "var(--shadow-card)",
                            }}
                        >
                            {/* Preview Header Banner */}
                            <div
                                className="h-28 relative flex items-center justify-center"
                                style={{ background: preview?.preview }}
                            >
                                {/* Simulated luxury dashboard design on the banner */}
                                <div className="flex gap-2.5 px-4 w-full justify-center opacity-40">
                                    <div className="w-14 h-2 rounded bg-foreground/15" />
                                    <div className="w-10 h-2 rounded bg-foreground/10" />
                                    <div className="w-12 h-2 rounded bg-primary/20" />
                                </div>

                                {/* Floating Icon Badge */}
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-panel-2/80 backdrop-blur-md border border-border/40 flex items-center justify-center">
                                    {preview?.icon}
                                </div>

                                {/* Active badge */}
                                {isActive && (
                                    <div className="absolute top-4 left-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                                        <Check size={11} strokeWidth={3} />
                                        Active
                                    </div>
                                )}
                            </div>

                            {/* Details Information */}
                            <div className="p-5" style={{ backgroundColor: "var(--l-card)" }}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-foreground font-display">
                                            {t.name}
                                        </h2>
                                        <p className="text-[11px] font-medium tracking-wide text-primary mt-0.5">
                                            {t.tagline}
                                        </p>
                                    </div>
                                    {isActive && (
                                        <div className="w-7 h-7 rounded-full bg-primary grid place-items-center">
                                            <Check size={14} className="text-primary-foreground" strokeWidth={3} />
                                        </div>
                                    )}
                                </div>

                                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                                    {t.description}
                                </p>

                                {/* Highlights pills */}
                                <div className="flex flex-wrap gap-1.5 mt-4">
                                    {t.highlights.map((highlight) => (
                                        <span
                                            key={highlight}
                                            className="text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                                            style={{
                                                backgroundColor: "var(--l-badge-bg, rgba(var(--primary), 0.1))",
                                                color: "var(--l-badge-text, var(--l-accent))",
                                            }}
                                        >
                                            {highlight}
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <span>Best for:</span>
                                    <span className="font-bold text-foreground">{t.bestFor}</span>
                                </div>

                                {/* Apply action button */}
                                {!isActive && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTheme(id);
                                        }}
                                        className="w-full mt-4 py-2.5 rounded-2xl bg-panel-3 hover:bg-panel-2 border border-border/40 text-xs font-bold tracking-wide transition-all"
                                    >
                                        Apply Theme
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Elite VIP presentation quote card */}
            <div className="px-4 pb-12">
                <div className="rounded-3xl border border-border/40 p-5 bg-panel-2/50 relative overflow-hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <Palette size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-foreground">Elegance in Motion</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Where performance and luxury unite.</p>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
                        PlayTurf is a premium, state-of-the-art sports-tech booking engine. Your active appearance preference is synced automatically, converting the standard headers, neon icons, HSL values, and floating glass components into your bespoke choice instantly.
                    </p>
                </div>
            </div>
        </MobileShell>
    );
}
