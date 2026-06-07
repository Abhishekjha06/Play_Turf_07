import type { Variants, Transition } from "framer-motion";

/* ── Easing presets ──────────────────────────────────────────── */
export const ease = {
    smooth: [0.25, 1, 0.5, 1] as [number, number, number, number],
    spring: { type: "spring", stiffness: 340, damping: 28 } as Transition,
    springFast: { type: "spring", stiffness: 480, damping: 32 } as Transition,
    springBounce: { type: "spring", stiffness: 300, damping: 20 } as Transition,
    springGentle: { type: "spring", stiffness: 200, damping: 24 } as Transition,
    out: [0.16, 1, 0.3, 1] as [number, number, number, number],
} as const;

/* ── Fade + slide down (header entrance) ────────────────────── */
export const fadeSlideDown: Variants = {
    hidden: { opacity: 0, y: -24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, ease: ease.smooth },
    },
};

/* ── Fade + slide up (cards, sections) ──────────────────────── */
export const fadeSlideUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: ease.out },
    },
};

/* ── Scale + fade in (stats, badges) ────────────────────────── */
export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.88 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.5, ease: ease.smooth },
    },
};

/* ── Stagger container ───────────────────────────────────────── */
export function staggerContainer(
    stagger = 0.08,
    delayChildren = 0
): Variants {
    return {
        hidden: {},
        visible: {
            transition: { staggerChildren: stagger, delayChildren },
        },
    };
}

/* ── Slide in from left ──────────────────────────────────────── */
export const slideInLeft: Variants = {
    hidden: { opacity: 0, x: -32 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.4, ease: ease.out },
    },
};

/* ── Card lift on hover / tap ────────────────────────────────── */
export const cardLift = {
    rest: {
        y: 0,
        boxShadow: "0 8px 30px rgba(15,23,42,0.08)",
        transition: { duration: 0.2, ease: ease.smooth },
    },
    hover: {
        y: -6,
        boxShadow: "0 16px 40px rgba(15,23,42,0.16)",
        transition: { duration: 0.22, ease: ease.smooth },
    },
    tap: {
        y: -2,
        scale: 0.975,
        boxShadow: "0 10px 28px rgba(15,23,42,0.10)",
        transition: { duration: 0.12 },
    },
};

/* ── Card lift – dark themes ─────────────────────────────────── */
export const cardLiftDark = {
    rest: {
        y: 0,
        boxShadow: "0 4px 20px rgba(0,0,0,0.30)",
        transition: { duration: 0.2, ease: ease.smooth },
    },
    hover: {
        y: -6,
        boxShadow: "0 20px 48px rgba(0,0,0,0.50), 0 0 0 1px hsl(195 90% 50% / 0.10)",
        transition: { duration: 0.22, ease: ease.smooth },
    },
    tap: {
        y: -2,
        scale: 0.975,
        transition: { duration: 0.12 },
    },
};

/* ── Nav icon bounce ─────────────────────────────────────────── */
export const navIconBounce: Variants = {
    inactive: { scale: 1, y: 0 },
    active: {
        scale: 1.18,
        y: -3,
        transition: ease.springBounce,
    },
};

/* ── Sliding nav indicator ───────────────────────────────────── */
export const navIndicator: Variants = {
    hidden: { scaleX: 0, opacity: 0 },
    visible: {
        scaleX: 1,
        opacity: 1,
        transition: ease.springBounce,
    },
};

/* ── Page entrance ───────────────────────────────────────────── */
export const pageEnter: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: ease.out },
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: { duration: 0.22, ease: ease.smooth },
    },
};

/* ── Shimmer keyframe (skeleton loader) ──────────────────────── */
export const shimmer: Variants = {
    initial: { backgroundPosition: "-200% 0" },
    animate: {
        backgroundPosition: "200% 0",
        transition: { repeat: Infinity, duration: 1.6, ease: "linear" },
    },
};

/* ── Floating glow pulse ──────────────────────────────────────── */
export const floatingGlow: Variants = {
    initial: { opacity: 0.4, scale: 1 },
    animate: {
        opacity: [0.4, 0.65, 0.4],
        scale: [1, 1.06, 1],
        transition: { repeat: Infinity, duration: 3.5, ease: "easeInOut" },
    },
};

/* ── Subtle float (particles / decorative) ───────────────────── */
export const floatY = (amplitude = 8, duration = 4): Variants => ({
    initial: { y: 0 },
    animate: {
        y: [-amplitude / 2, amplitude / 2, -amplitude / 2],
        transition: { repeat: Infinity, duration, ease: "easeInOut" },
    },
});

/* ── Ripple (button press feedback) ──────────────────────────── */
export const ripple: Variants = {
    initial: { scale: 0, opacity: 0.35 },
    animate: {
        scale: 2.8,
        opacity: 0,
        transition: { duration: 0.55, ease: ease.out },
    },
};

/* ── Count-up number (combine with useCountUp hook) ──────────── */
export const countUp: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: ease.smooth },
    },
};

/* ── Section slide up with viewport trigger ──────────────────── */
export const sectionReveal: Variants = {
    hidden: { opacity: 0, y: 28 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.45, ease: ease.out },
    },
};
