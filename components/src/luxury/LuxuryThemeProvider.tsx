import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ───────────────────────────────────────────
   LUXURY THEME SYSTEM — 2 Themes (Premium Teal / AMOLED Black)
   Single source of truth: every color token namespace in the app is
   derived from these objects and injected on <html> by injectCSSVariables.
   ─────────────────────────────────────────── */

export type LuxuryThemeId = "premium-teal" | "amoled-black";

/**
 * Theme-invariant status palette (booking states etc.). Deliberately NOT the
 * brand accent: the success green is deeper than AMOLED's neon-emerald primary
 * so a status green is never confused with the brand green, in either theme.
 */
export const STATUS_COLORS = {
    success: "152 55% 48%",
    warning: "38 92% 50%",
    danger: "0 84% 60%",
    successForeground: "210 40% 98%",
    warningForeground: "215 28% 11%",
    dangerForeground: "210 40% 98%",
    successSurface: "152 55% 48% / 0.14",
    warningSurface: "38 92% 50% / 0.12",
    dangerSurface: "0 84% 60% / 0.12",
} as const;

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
        goldSecondary: string;
        emerald: string;
        emeraldPrimary: string;
        emeraldSecondary: string;
        foreground: string;
        foregroundSecondary: string;
        glassBg: string;
        glassBorder: string;
        shadow: string;
        shadowGlow: string;
        divider: string;
        badgeBg: string;
        badgeText: string;
        navBg: string;
        navBorder: string;
        inputBg: string;
        inputBorder: string;
        headerGradient: string;
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
        /* Semantic --color-* namespace (consumed by BottomNav, TurfCard,
           BookingRow, index.css and any future component). */
        colorPrimary: string;
        colorPrimaryHover: string;
        colorSurfaceDefault: string;
        colorSurfaceElevated: string;
        colorSurfaceOverlay: string;
        colorSurfaceSubtle: string;
        colorTextPrimary: string;
        colorTextSecondary: string;
        colorTextTertiary: string;
        colorTextInverse: string;
        colorBorderDefault: string;
        colorBorderSubtle: string;
        colorBorderInverse: string;
        colorNeutral: string;
        colorNeutralForeground: string;
        colorNeutralSurface: string;
        shadowSm: string;
        shadowMd: string;
        shadowLg: string;
        shadowXl: string;
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
            goldSecondary: "#D97706",
            emerald: "#16A34A",
            emeraldPrimary: "#22C55E",
            emeraldSecondary: "#16A34A",
            foreground: "#0F172A",
            foregroundSecondary: "#64748B",
            glassBg: "rgba(255,255,255,0.85)",
            glassBorder: "rgba(226,232,240,0.9)",
            shadow: "0 8px 30px rgba(15,23,42,0.08)",
            shadowGlow: "0 10px 30px rgba(20,184,176,0.35)",
            divider: "#E2E8F0",
            badgeBg: "rgba(245,158,11,0.15)",
            badgeText: "#F59E0B",
            navBg: "rgba(255,255,255,0.92)",
            navBorder: "rgba(226,232,240,0.9)",
            inputBg: "#FFFFFF",
            inputBorder: "#E2E8F0",
            headerGradient: "linear-gradient(135deg, #0F172A 0%, #0E4F5F 30%, #14B8B0 70%, #0F172A 100%)",
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
            shadowCard: "0 2px 12px rgba(15,23,42,0.06)",
            /* Semantic --color-* namespace (mirrors index.css html.light) */
            colorPrimary: "174 80% 40%",
            colorPrimaryHover: "174 80% 35%",
            colorSurfaceDefault: "210 40% 96%",
            colorSurfaceElevated: "0 0% 100%",
            colorSurfaceOverlay: "210 40% 98%",
            colorSurfaceSubtle: "210 40% 94%",
            colorTextPrimary: "215 28% 11%",
            colorTextSecondary: "215 16% 47%",
            colorTextTertiary: "215 14% 60%",
            colorTextInverse: "210 40% 98%",
            colorBorderDefault: "214 32% 91%",
            colorBorderSubtle: "214 32% 88%",
            colorBorderInverse: "215 28% 11%",
            colorNeutral: "215 16% 47%",
            colorNeutralForeground: "210 40% 98%",
            colorNeutralSurface: "215 16% 47% / 0.12",
            shadowSm: "0 1px 2px hsl(215 28% 11% / 0.05)",
            shadowMd: "0 4px 6px hsl(215 28% 11% / 0.08)",
            shadowLg: "0 10px 15px hsl(215 28% 11% / 0.1)",
            shadowXl: "0 20px 25px hsl(215 28% 11% / 0.12)",
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
            goldSecondary: "#E6C200",
            emerald: "#00C853",
            emeraldPrimary: "#00E676",
            emeraldSecondary: "#00C853",
            foreground: "#FFFFFF",
            foregroundSecondary: "#A0A0A0",
            glassBg: "rgba(9, 9, 9, 0.68)",
            glassBorder: "rgba(0, 230, 118, 0.12)",
            shadow: "0 8px 32px rgba(0,0,0,0.7)",
            shadowGlow: "0 4px 28px rgba(0,230,118,0.25)",
            divider: "rgba(255,255,255,0.06)",
            badgeBg: "rgba(0,230,118,0.15)",
            badgeText: "#00E676",
            navBg: "rgba(9,9,9,0.92)",
            navBorder: "rgba(0,230,118,0.12)",
            inputBg: "#0F0F0F",
            inputBorder: "rgba(0,230,118,0.15)",
            headerGradient: "linear-gradient(135deg, #000000 0%, #090909 30%, #004D26 70%, #000000 100%)",
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
            shadowCard: "0 2px 12px rgba(0,0,0,0.35)",
            /* Semantic --color-* namespace — pure-black surfaces, emerald accents */
            colorPrimary: "151 100% 45%",
            colorPrimaryHover: "151 100% 38%",
            colorSurfaceDefault: "0 0% 0%",
            colorSurfaceElevated: "0 0% 4%",
            colorSurfaceOverlay: "0 0% 7%",
            colorSurfaceSubtle: "0 0% 10%",
            colorTextPrimary: "0 0% 100%",
            colorTextSecondary: "0 0% 63%",
            colorTextTertiary: "0 0% 45%",
            colorTextInverse: "0 0% 0%",
            colorBorderDefault: "151 100% 45% / 0.14",
            colorBorderSubtle: "0 0% 100% / 0.07",
            colorBorderInverse: "0 0% 0%",
            colorNeutral: "0 0% 45%",
            colorNeutralForeground: "0 0% 100%",
            colorNeutralSurface: "0 0% 100% / 0.10",
            shadowSm: "0 1px 2px hsl(0 0% 0% / 0.6)",
            shadowMd: "0 4px 6px hsl(0 0% 0% / 0.6)",
            shadowLg: "0 10px 15px hsl(0 0% 0% / 0.65)",
            shadowXl: "0 20px 25px hsl(0 0% 0% / 0.7)",
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
    const isDark = theme.id === "amoled-black";

    // 1. Custom --l-* theme properties
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
    root.style.setProperty("--l-foreground-muted", h.foregroundMuted);
    root.style.setProperty("--l-glass-bg", c.glassBg);
    root.style.setProperty("--l-glass-border", c.glassBorder);
    root.style.setProperty("--l-card-border", c.glassBorder);
    root.style.setProperty("--l-gradient-primary", h.gradientNeon);
    root.style.setProperty("--l-nav-bg", c.navBg);
    root.style.setProperty("--l-nav-border", c.navBorder);
    root.style.setProperty("--l-input-bg", c.inputBg);
    root.style.setProperty("--l-input-border", c.inputBorder);
    root.style.setProperty("--l-shadow", c.shadow);
    root.style.setProperty("--l-shadow-glow", c.shadowGlow);
    root.style.setProperty("--l-divider", c.divider);
    root.style.setProperty("--l-badge-bg", c.badgeBg);
    root.style.setProperty("--l-badge-text", c.badgeText);
    // Status colors are theme-invariant (see STATUS_COLORS)
    root.style.setProperty("--l-success", `hsl(${STATUS_COLORS.success})`);
    root.style.setProperty("--l-warning", `hsl(${STATUS_COLORS.warning})`);
    root.style.setProperty("--l-error", `hsl(${STATUS_COLORS.danger})`);

    // 1.1 Booking-flow UI variables
    root.style.setProperty("--bg-primary", c.bg);
    root.style.setProperty("--bg-secondary", c.bgSecondary);
    root.style.setProperty("--card-bg", c.card);
    root.style.setProperty("--card-premium", c.card);
    root.style.setProperty("--text-primary", c.foreground);
    root.style.setProperty("--text-secondary", c.foregroundSecondary);
    root.style.setProperty("--gold-primary", c.gold);
    root.style.setProperty("--gold-secondary", c.goldSecondary);
    root.style.setProperty("--emerald-primary", c.emeraldPrimary);
    root.style.setProperty("--emerald-secondary", c.emeraldSecondary);
    root.style.setProperty("--border-primary", c.divider);
    root.style.setProperty("--shadow-primary", c.shadow);

    // 1.2 Semantic --color-* namespace (BottomNav, TurfCard, BookingRow, index.css)
    root.style.setProperty("--color-primary", h.colorPrimary);
    root.style.setProperty("--color-primary-hover", h.colorPrimaryHover);
    root.style.setProperty("--color-surface-default", h.colorSurfaceDefault);
    root.style.setProperty("--color-surface-elevated", h.colorSurfaceElevated);
    root.style.setProperty("--color-surface-overlay", h.colorSurfaceOverlay);
    root.style.setProperty("--color-surface-subtle", h.colorSurfaceSubtle);
    root.style.setProperty("--color-text-primary", h.colorTextPrimary);
    root.style.setProperty("--color-text-secondary", h.colorTextSecondary);
    root.style.setProperty("--color-text-tertiary", h.colorTextTertiary);
    root.style.setProperty("--color-text-inverse", h.colorTextInverse);
    root.style.setProperty("--color-border-default", h.colorBorderDefault);
    root.style.setProperty("--color-border-subtle", h.colorBorderSubtle);
    root.style.setProperty("--color-border-inverse", h.colorBorderInverse);
    root.style.setProperty("--color-neutral", h.colorNeutral);
    root.style.setProperty("--color-neutral-foreground", h.colorNeutralForeground);
    root.style.setProperty("--color-neutral-surface", h.colorNeutralSurface);
    root.style.setProperty("--color-success", STATUS_COLORS.success);
    root.style.setProperty("--color-warning", STATUS_COLORS.warning);
    root.style.setProperty("--color-danger", STATUS_COLORS.danger);
    root.style.setProperty("--color-success-foreground", STATUS_COLORS.successForeground);
    root.style.setProperty("--color-warning-foreground", STATUS_COLORS.warningForeground);
    root.style.setProperty("--color-danger-foreground", STATUS_COLORS.dangerForeground);
    root.style.setProperty("--color-success-surface", STATUS_COLORS.successSurface);
    root.style.setProperty("--color-warning-surface", STATUS_COLORS.warningSurface);
    root.style.setProperty("--color-danger-surface", STATUS_COLORS.dangerSurface);
    // Brand-glow shadows reference the injected --color-primary, so they follow the theme.
    root.style.setProperty("--shadow-primary", "0 4px 14px hsl(var(--color-primary) / 0.30)");
    root.style.setProperty("--shadow-primary-lg", "0 10px 30px hsl(var(--color-primary) / 0.40)");

    // 1.3 App header gradient (per-theme, consumed by AppHeader)
    root.style.setProperty("--header-gradient", c.headerGradient);

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

    // 3. Dynamic document properties
    root.classList.remove("dark");
    root.classList.remove("light");
    root.classList.add(isDark ? "dark" : "light");
    root.style.colorScheme = isDark ? "dark" : "light";

    // 4. Browser chrome follows the theme (mobile address bar etc.)
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c.bg);
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", isDark ? "dark" : "light");
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
    const isDark = themeId === "amoled-black";

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
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}