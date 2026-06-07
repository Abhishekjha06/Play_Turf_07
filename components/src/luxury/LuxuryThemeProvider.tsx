import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ───────────────────────────────────────────
   LUXURY THEME SYSTEM — 3 Premium Themes
   ─────────────────────────────────────────── */

export type LuxuryThemeId = "premium-teal" | "amoled-black";

export interface LuxuryTheme {
    id: LuxuryThemeId;
    name: string;
    tagline: string;
    icon: string;
    description: string;
    highlights: string[];
    bestFor: string;
    colors: {
        bg: string;
        bgSecondary: string;
        card: string;
        accent: string;
        accentSoft: string;
        accentGlow: string;
        gold: string;
        emerald: string;
        foreground: string;
        foregroundSecondary: string;
        glassBg: string;
        glassBorder: string;
        shadow: string;
        shadowGlow: string;
        divider: string;
        badgeBg: string;
        badgeText: string;
    };
    // Tailwind-specific HSL variables (comma-less space-separated format)
    hsl: {
        background: string;
        foreground: string;
        foregroundSoft: string;
        foregroundMuted: string;
        panel: string;
        panel2: string;
        panel3: string;
        card: string;
        cardForeground: string;
        primary: string;
        primaryForeground: string;
        primaryGlow: string;
        accent: string;
        accentForeground: string;
        muted: string;
        mutedForeground: string;
        border: string;
        input: string;
        ring: string;
        gradientBg: string;
        gradientCard: string;
        gradientNeon: string;
        gradientOverlay: string;
        shadowNeon: string;
        shadowNeonLg: string;
        shadowCard: string;
    };
}

export const THEMES: Record<LuxuryThemeId, LuxuryTheme> = {
    "premium-teal": {
        id: "premium-teal",
        name: "Premium Teal",
        tagline: "Clean. Bold. Luxury Sports Booking.",
        icon: "◈",
        description: "A premium light-mode dashboard inspired by Airbnb, Nike, and Stripe. Crisp white cards on slate-gray backgrounds with vibrant teal accents.",
        highlights: ["Airbnb-inspired clean cards", "Teal action palette", "Navy dark text system", "Gold rewards highlights"],
        bestFor: "Premium daytime use, professional sports booking",
        colors: {
            bg: "#F1F5F9",
            bgSecondary: "#E2E8F0",
            card: "#FFFFFF",
            accent: "#14B8B0",
            accentSoft: "rgba(20,184,176,0.10)",
            accentGlow: "rgba(20,184,176,0.30)",
            gold: "#F59E0B",
            emerald: "#22C55E",
            foreground: "#0F172A",
            foregroundSecondary: "#64748B",
            glassBg: "rgba(255,255,255,0.85)",
            glassBorder: "rgba(226,232,240,0.9)",
            shadow: "0 8px 30px rgba(15,23,42,0.08)",
            shadowGlow: "0 10px 30px rgba(20,184,176,0.35)",
            divider: "#E2E8F0",
            badgeBg: "rgba(245,158,11,0.15)",
            badgeText: "#F59E0B",
        },
        hsl: {
            background: "210 40% 96%",    // #F1F5F9
            foreground: "222 47% 11%",    // #0F172A
            foregroundSoft: "215 16% 47%", // #64748B
            foregroundMuted: "215 20% 65%",
            panel: "214 32% 91%",          // #E2E8F0
            panel2: "0 0% 100%",           // #FFFFFF
            panel3: "210 40% 98%",
            card: "0 0% 100%",             // #FFFFFF
            cardForeground: "222 47% 11%",
            primary: "177 77% 40%",        // #14B8B0
            primaryForeground: "0 0% 100%",
            primaryGlow: "177 77% 40%",
            accent: "177 77% 40%",
            accentForeground: "0 0% 100%",
            muted: "214 32% 91%",
            mutedForeground: "215 16% 47%",
            border: "214 32% 91%",         // #E2E8F0
            input: "0 0% 100%",
            ring: "177 77% 40%",
            gradientBg: "linear-gradient(135deg, #F1F5F9 0%, #E8F4F8 100%)",
            gradientCard: "linear-gradient(180deg, #FFFFFF, #F8FAFC)",
            gradientNeon: "linear-gradient(135deg, #14B8B0, #0D9488)",
            gradientOverlay: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.50) 100%)",
            shadowNeon: "0 0 16px rgba(20,184,176,0.30)",
            shadowNeonLg: "0 10px 30px rgba(20,184,176,0.35), 0 0 10px rgba(20,184,176,0.20)",
            shadowCard: "0 8px 30px rgba(15,23,42,0.08)",
        },
    },
    "amoled-black": {
        id: "amoled-black",
        name: "AMOLED Black",
        tagline: "Futuristic elite sports",
        icon: "◆",
        description: "Pure #000000 AMOLED base with electric neon emerald and luxury gold highlights. Floating glass cards.",
        highlights: ["Battery-saving deep dark", "Tesla-inspired cyber design", "Floating liquid glass cards", "Electric emerald glow"],
        bestFor: "Battery efficiency, futuristic elite appearance",
        colors: {
            bg: "#000000",
            bgSecondary: "#050505",
            card: "#090909",
            accent: "#00E676",
            accentSoft: "rgba(0,230,118,0.12)",
            accentGlow: "rgba(0,230,118,0.35)",
            gold: "#FFD700",
            emerald: "#00C853",
            foreground: "#FFFFFF",
            foregroundSecondary: "#A0A0A0",
            glassBg: "rgba(9, 9, 9, 0.68)",
            glassBorder: "rgba(0, 230, 118, 0.12)",
            shadow: "0 8px 32px rgba(0,0,0,0.7)",
            shadowGlow: "0 4px 28px rgba(0,230,118,0.25)",
            divider: "rgba(255,255,255,0.06)",
            badgeBg: "rgba(0,230,118,0.15)",
            badgeText: "#00E676",
        },
        hsl: {
            background: "0 0% 0%", // Pure AMOLED #000000
            foreground: "0 0% 100%",
            foregroundSoft: "0 0% 63%", // #A0A0A0
            foregroundMuted: "0 0% 45%",
            panel: "0 0% 2%", // #050505
            panel2: "0 0% 4%", // #090909
            panel3: "0 0% 7%",
            card: "0 0% 4%",
            cardForeground: "0 0% 100%",
            primary: "151 100% 45%", // Neon Emerald #00E676
            primaryForeground: "0 0% 0%",
            primaryGlow: "151 100% 45%",
            accent: "151 100% 45%",
            accentForeground: "0 0% 0%",
            muted: "0 0% 4%",
            mutedForeground: "0 0% 63%",
            border: "151 100% 45% / 0.12", // emerald glowing borders
            input: "0 0% 3%",
            ring: "151 100% 45%",
            gradientBg: `radial-gradient(1200px 600px at 50% -10%, hsl(151 100% 45% / 0.12), transparent 60%), radial-gradient(800px 400px at 0% 100%, hsl(51 100% 50% / 0.08), transparent 60%), #000000`,
            gradientCard: "linear-gradient(180deg, #090909, #020202)",
            gradientNeon: "linear-gradient(135deg, #FFD700, #00E676)", // stunning Gold-to-Emerald gradient
            gradientOverlay: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.98) 100%)",
            shadowNeon: "0 0 20px rgba(0,230,118,0.3)",
            shadowNeonLg: "0 0 35px rgba(0,230,118,0.45), 0 0 10px rgba(255,215,0,0.2)",
            shadowCard: "0 8px 32px rgba(0,0,0,0.6)",
        },
    },
};

/* ── Context ─────────────────────────────────── */

interface ThemeContextValue {
    theme: LuxuryTheme;
    themeId: LuxuryThemeId;
    setTheme: (id: LuxuryThemeId) => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useLuxuryTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useLuxuryTheme must be used within LuxuryThemeProvider");
    return ctx;
}

const STORAGE_KEY = "playturf-luxury-theme";

/* ── CSS Variable injection ─────────────────── */

function injectCSSVariables(theme: LuxuryTheme) {
    const c = theme.colors;
    const h = theme.hsl;
    const root = document.documentElement;

    // 1. Set Custom Theme properties
    root.style.setProperty("--l-bg", c.bg);
    root.style.setProperty("--l-bg-secondary", c.bgSecondary);
    root.style.setProperty("--l-card", c.card);
    root.style.setProperty("--l-accent", c.accent);
    root.style.setProperty("--l-accent-soft", c.accentSoft);
    root.style.setProperty("--l-accent-glow", c.accentGlow);
    root.style.setProperty("--l-gold", c.gold);
    root.style.setProperty("--l-emerald", c.emerald);
    root.style.setProperty("--l-foreground", c.foreground);
    root.style.setProperty("--l-foreground-secondary", c.foregroundSecondary);
    root.style.setProperty("--l-glass-bg", c.glassBg);
    root.style.setProperty("--l-glass-border", c.glassBorder);
    root.style.setProperty("--l-shadow", c.shadow);
    root.style.setProperty("--l-shadow-glow", c.shadowGlow);
    root.style.setProperty("--l-divider", c.divider);
    root.style.setProperty("--l-badge-bg", c.badgeBg);
    root.style.setProperty("--l-badge-text", c.badgeText);

    // 1.1 Inject requested UI variables for entire booking screen adaptation
    root.style.setProperty("--bg-primary", c.bg);
    root.style.setProperty("--bg-secondary", c.bgSecondary);
    root.style.setProperty("--card-bg", c.card);
    root.style.setProperty("--card-premium", theme.id === "dusky-white" ? "#FFF8EE" : theme.id === "midnight-gold" ? "#1a1f2e" : theme.id === "premium-teal" ? "#FFFFFF" : "#090909");
    root.style.setProperty("--text-primary", c.foreground);
    root.style.setProperty("--text-secondary", c.foregroundSecondary);
    root.style.setProperty("--gold-primary", theme.id === "dusky-white" ? "#C89B3C" : theme.id === "midnight-gold" ? "#FFD700" : theme.id === "premium-teal" ? "#F59E0B" : "#D4AF37");
    root.style.setProperty("--gold-secondary", theme.id === "dusky-white" ? "#A87820" : theme.id === "midnight-gold" ? "#E6C200" : theme.id === "premium-teal" ? "#D97706" : "#FFD700");
    root.style.setProperty("--emerald-primary", theme.id === "dusky-white" ? "#5B8C5A" : theme.id === "midnight-gold" ? "#4CAF50" : theme.id === "premium-teal" ? "#22C55E" : "#00E676");
    root.style.setProperty("--emerald-secondary", theme.id === "dusky-white" ? "#3E603D" : theme.id === "midnight-gold" ? "#388E3C" : theme.id === "premium-teal" ? "#16A34A" : "#00C853");
    root.style.setProperty("--border-primary", c.divider);
    root.style.setProperty("--shadow-primary", c.shadow);

    // 2. Overwrite global standard Tailwind/HSL theme variables
    root.style.setProperty("--background", h.background);
    root.style.setProperty("--foreground", h.foreground);
    root.style.setProperty("--foreground-soft", h.foregroundSoft);
    root.style.setProperty("--foreground-muted", h.foregroundMuted);
    root.style.setProperty("--panel", h.panel);
    root.style.setProperty("--panel-2", h.panel2);
    root.style.setProperty("--panel-3", h.panel3);
    root.style.setProperty("--card", h.card);
    root.style.setProperty("--card-foreground", h.cardForeground);
    root.style.setProperty("--primary", h.primary);
    root.style.setProperty("--primary-foreground", h.primaryForeground);
    root.style.setProperty("--primary-glow", h.primaryGlow);
    root.style.setProperty("--accent", h.accent);
    root.style.setProperty("--accent-foreground", h.accentForeground);
    root.style.setProperty("--muted", h.muted);
    root.style.setProperty("--muted-foreground", h.mutedForeground);
    root.style.setProperty("--border", h.border);
    root.style.setProperty("--input", h.input);
    root.style.setProperty("--ring", h.ring);
    root.style.setProperty("--gradient-bg", h.gradientBg);
    root.style.setProperty("--gradient-card", h.gradientCard);
    root.style.setProperty("--gradient-neon", h.gradientNeon);
    root.style.setProperty("--gradient-overlay", h.gradientOverlay);
    root.style.setProperty("--shadow-neon", h.shadowNeon);
    root.style.setProperty("--shadow-neon-lg", h.shadowNeonLg);
    root.style.setProperty("--shadow-card", h.shadowCard);

    // Dynamic document properties
    if (theme.id === "dusky-white" || theme.id === "premium-teal") {
        root.classList.remove("dark");
        root.classList.add("light");
        root.style.colorScheme = "light";
    } else {
        root.classList.remove("light");
        root.classList.add("dark");
        root.style.colorScheme = "dark";
    }
}

/* ── Provider ───────────────────────────────── */

export function LuxuryThemeProvider({ children }: { children: React.ReactNode }) {
    const [themeId, setThemeId] = useState<LuxuryThemeId>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && Object.keys(THEMES).includes(stored)) return stored as LuxuryThemeId;
        } catch { /* ignore */ }
        return "premium-teal"; // Premium light teal theme by default
    });

    const theme = THEMES[themeId];
    const isDark = themeId === "midnight-gold" || themeId === "amoled-black";

    useEffect(() => {
        injectCSSVariables(theme);
        try { localStorage.setItem(STORAGE_KEY, themeId); } catch { /* ignore */ }
    }, [theme, themeId]);

    const setTheme = useCallback((id: LuxuryThemeId) => {
        setThemeId(id);
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, themeId, setTheme, isDark }}>
            <div
                style={{
                    backgroundColor: theme.colors.bg,
                    color: theme.colors.foreground,
                    minHeight: "100dvh",
                    transition: "background-color 0.45s cubic-bezier(0.25, 1, 0.5, 1), color 0.45s ease",
                }}
            >
                {children}
            </div>
        </ThemeContext.Provider>
    );
}

/* ── Theme Transition Wrapper ────────────────── */

export function ThemeTransition({ children }: { children: React.ReactNode }) {
    const { theme } = useLuxuryTheme();
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={theme.id}
                initial={{ opacity: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}