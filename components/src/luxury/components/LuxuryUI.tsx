import { ReactNode } from "react";
import { motion } from "framer-motion";

/* ───────────────────────────────────────────────
   Luxury UI Shared Components
   Glassmorphism cards, premium buttons, gradients
   ─────────────────────────────────────────────── */

interface GlassCardProps {
    children: ReactNode;
    className?: string;
    glow?: boolean;
    onClick?: () => void;
    style?: React.CSSProperties;
}

export function GlassCard({ children, className = "", glow, onClick, style }: GlassCardProps) {
    return (
        <motion.div
            whileHover={onClick ? { scale: 0.99 } : undefined}
            whileTap={onClick ? { scale: 0.98 } : undefined}
            onClick={onClick}
            className={className}
            style={{
                background: "var(--l-card)",
                backdropFilter: "blur(20px) saturate(1.4)",
                WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                border: "1px solid var(--l-card-border)",
                borderRadius: 20,
                boxShadow: glow ? "var(--l-shadow-glow)" : "var(--l-shadow)",
                transition: "all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                cursor: onClick ? "pointer" : undefined,
                ...style,
            }}
        >
            {children}
        </motion.div>
    );
}

/* ── Premium Glass Card (deeper glassmorphism) ──── */

export function PremiumGlassCard({ children, className = "", glow }: GlassCardProps) {
    return (
        <GlassCard
            className={className}
            glow={glow}
            style={{
                background: "var(--l-glass-bg)",
                backdropFilter: "blur(30px) saturate(1.6)",
                WebkitBackdropFilter: "blur(30px) saturate(1.6)",
                border: "1px solid var(--l-glass-border)",
            }}
        >
            {children}
        </GlassCard>
    );
}

/* ── Gold Gradient Button ──────────────────────── */

interface GoldButtonProps {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    fullWidth?: boolean;
    size?: "sm" | "md" | "lg";
    glow?: boolean;
    disabled?: boolean;
    style?: React.CSSProperties;
}

export function GoldButton({
    children, onClick, className = "", fullWidth, size = "md", glow = true, disabled, style,
}: GoldButtonProps) {
    const sizeMap = { sm: "py-2 px-4 text-xs", md: "py-3 px-6 text-sm", lg: "py-4 px-8 text-base" };
    return (
        <motion.button
            whileHover={!disabled ? { scale: 1.02, y: -1 } : undefined}
            whileTap={!disabled ? { scale: 0.97 } : undefined}
            onClick={onClick}
            disabled={disabled}
            className={`font-semibold tracking-wide rounded-full ${sizeMap[size]} ${fullWidth ? "w-full" : ""} ${className}`}
            style={{
                background: "var(--l-gradient-primary)",
                color: "#0C0B10",
                boxShadow: glow ? "var(--l-shadow-glow)" : undefined,
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                border: "none",
                transition: "all 0.25s ease",
                ...style,
            }}
        >
            {children}
        </motion.button>
    );
}

/* ── Luxury Badge ──────────────────────────────── */

interface LuxuryBadgeProps {
    children: ReactNode;
    variant?: "gold" | "success" | "warning" | "error";
    className?: string;
}

export function LuxuryBadge({ children, variant = "gold", className = "" }: LuxuryBadgeProps) {
    const colors = {
        gold: { bg: "var(--l-badge-bg)", color: "var(--l-badge-text)" },
        success: { bg: "rgba(91,140,90,0.15)", color: "var(--l-success)" },
        warning: { bg: "rgba(201,149,60,0.15)", color: "var(--l-warning)" },
        error: { bg: "rgba(201,76,76,0.15)", color: "var(--l-error)" },
    };
    return (
        <span
            className={`text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full ${className}`}
            style={{
                backgroundColor: colors[variant].bg,
                color: colors[variant].color,
            }}
        >
            {children}
        </span>
    );
}

/* ── Premium Divider ───────────────────────────── */

export function LuxuryDivider({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <div
            className={`w-full ${className}`}
            style={{
                height: 1,
                background: "var(--l-divider)",
                ...style,
            }}
        />
    );
}

/* ── Gold Text with glow ───────────────────────── */

export function GoldText({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <span
            className={className}
            style={{
                background: "var(--l-gradient-primary)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontWeight: 700,
            }}
        >
            {children}
        </span>
    );
}

/* ── Section Header ────────────────────────────── */

interface LuxurySectionHeaderProps {
    title: string;
    subtitle?: string;
    action?: { label: string; onClick: () => void };
    className?: string;
    style?: React.CSSProperties;
}

export function LuxurySectionHeader({ title, subtitle, action, className = "", style }: LuxurySectionHeaderProps) {
    return (
        <div className={`flex items-end justify-between px-4 ${className}`} style={style}>
            <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--l-foreground)" }}>
                    {title}
                </h2>
                {subtitle && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--l-foreground-muted)" }}>
                        {subtitle}
                    </p>
                )}
            </div>
            {action && (
                <button
                    onClick={action.onClick}
                    className="text-xs font-semibold tracking-wide"
                    style={{
                        background: "var(--l-gradient-primary)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                    }}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}

/* ── Floating Navigation ───────────────────────── */

import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, Calendar, Wallet, User } from "lucide-react";

const NAV_ITEMS = [
    { to: "/luxury/home", label: "Home", icon: Home },
    { to: "/luxury/turfs", label: "Explore", icon: Search },
    { to: "/luxury/booking", label: "Bookings", icon: Calendar },
    { to: "/luxury/wallet", label: "Wallet", icon: Wallet },
    { to: "/luxury/profile", label: "Profile", icon: User },
];

export function LuxuryBottomNav({ onNavigate }: { onNavigate?: (path: string) => void }) {
    const navigate = useNavigate();
    const location = useLocation();

    const go = (to: string) => {
        if (onNavigate) onNavigate(to);
        else navigate(to);
    };

    return (
        <>
            <div className="h-28" aria-hidden />
            <div
                style={{
                    position: "fixed",
                    bottom: 16,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 50,
                    width: "calc(100% - 32px)",
                    maxWidth: 456,
                    background: "var(--l-nav-bg)",
                    backdropFilter: "blur(24px) saturate(1.5)",
                    WebkitBackdropFilter: "blur(24px) saturate(1.5)",
                    border: "1px solid var(--l-nav-border)",
                    borderRadius: 28,
                    padding: "6px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-around",
                    boxShadow: "0 4px 30px rgba(0,0,0,0.25)",
                }}
            >
                {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
                    const active = location.pathname === to;
                    return (
                        <motion.button
                            key={to}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => go(to)}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 2,
                                width: 64,
                                height: 48,
                                borderRadius: 16,
                                border: "none",
                                background: active ? "var(--l-accent-soft)" : "transparent",
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                            }}
                        >
                            <Icon
                                size={active ? 20 : 18}
                                style={{
                                    color: active ? "var(--l-accent)" : "var(--l-foreground-muted)",
                                    transition: "color 0.25s ease",
                                }}
                            />
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: active ? 700 : 500,
                                    color: active ? "var(--l-accent)" : "var(--l-foreground-muted)",
                                    letterSpacing: "0.5px",
                                    transition: "color 0.25s ease",
                                }}
                            >
                                {label}
                            </span>
                        </motion.button>
                    );
                })}
            </div>
        </>
    );
}

/* ── Luxury Input ─────────────────────────────── */

interface LuxuryInputProps {
    placeholder?: string;
    value?: string;
    onChange?: (v: string) => void;
    icon?: ReactNode;
    className?: string;
    type?: string;
}

export function LuxuryInput({ placeholder, value, onChange, icon, className = "", type = "text" }: LuxuryInputProps) {
    return (
        <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${className}`}
            style={{
                background: "var(--l-input-bg)",
                border: "1px solid var(--l-input-border)",
                backdropFilter: "blur(12px)",
            }}
        >
            {icon && <span style={{ color: "var(--l-foreground-muted)" }}>{icon}</span>}
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--l-foreground)",
                    fontSize: 14,
                    width: "100%",
                    fontFamily: "inherit",
                }}
                className="placeholder:text-muted2"
            />
        </div>
    );
}

/* ── Luxury Avatar (initial-based) ─────────────── */

export function LuxuryAvatar({
    name, size = 44, imageUrl, className = "",
}: {
    name: string;
    size?: number;
    imageUrl?: string;
    className?: string;
}) {
    const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={name}
                className={`rounded-full object-cover ${className}`}
                style={{ width: size, height: size }}
            loading="lazy" decoding="async" />
        );
    }

    return (
        <div
            className={`rounded-full grid place-items-center font-bold ${className}`}
            style={{
                width: size,
                height: size,
                background: "var(--l-gradient-primary)",
                color: "#0C0B10",
                fontSize: size * 0.38,
            }}
        >
            {initials}
        </div>
    );
}

/* ── Stat Display ──────────────────────────────── */

interface StatProps {
    label: string;
    value: string;
    icon?: ReactNode;
}

export function LuxuryStat({ label, value, icon }: StatProps) {
    return (
        <div style={{ textAlign: "center" }}>
            {icon && <div style={{ marginBottom: 4, color: "var(--l-accent)" }}>{icon}</div>}
            <p className="text-lg font-bold" style={{ color: "var(--l-foreground)" }}>{value}</p>
            <p className="text-[10px] font-medium tracking-wide" style={{ color: "var(--l-foreground-muted)" }}>{label}</p>
        </div>
    );
}

/* ── Page Transition ───────────────────────────── */

export function PageTransition({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/* ── Luxury Page Shell ─────────────────────────── */

export function LuxuryPageShell({
    children, className = "", hideNav, onNavigate,
}: {
    children: ReactNode;
    className?: string;
    hideNav?: boolean;
    onNavigate?: (path: string) => void;
}) {
    return (
        <div
            className={className}
            style={{
                maxWidth: 480,
                margin: "0 auto",
                minHeight: "100dvh",
                position: "relative",
                overflowX: "clip",
            }}
        >
            <PageTransition>{children}</PageTransition>
            {!hideNav && <LuxuryBottomNav onNavigate={onNavigate} />}
        </div>
    );
}

/* ── Status Bar simulation ─────────────────────── */

export function LuxuryStatusBar({ title }: { title?: string }) {
    return (
        <div
            style={{
                padding: "12px 20px 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--l-foreground-muted)", letterSpacing: 0.5 }}>
                9:41
            </span>
            {title && (
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--l-foreground)", letterSpacing: 0.3 }}>
                    {title}
                </span>
            )}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                    <rect x="0.5" y="0.5" width="13" height="9" rx="1.5" stroke="var(--l-foreground-muted)" strokeOpacity="0.4" />
                    <rect x="2" y="2" width="4" height="5.5" rx="0.75" fill="var(--l-foreground-muted)" fillOpacity="0.6" />
                    <rect x="6.5" y="2" width="2.5" height="5.5" rx="0.75" fill="var(--l-foreground-muted)" fillOpacity="0.3" />
                    <rect x="9.5" y="2" width="2.5" height="5.5" rx="0.75" fill="var(--l-foreground-muted)" fillOpacity="0.15" />
                </svg>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 0C6 3 9 4 11 6C9 8 6 9 6 12C6 9 3 8 1 6C3 4 6 3 6 0Z" fill="var(--l-foreground-muted)" fillOpacity="0.6" />
                </svg>
            </div>
        </div>
    );
}