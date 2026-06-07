import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth";
import { toast } from "sonner";
import { motion } from "framer-motion";

function GoogleG() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 5.7 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
            />
            <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 5.7 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
                fill="#4CAF50"
                d="M24 44c5.1 0 9.7-1.7 13.3-4.7l-6.1-5.2C29 35.4 26.6 36 24 36c-5.3 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"
            />
            <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.1 5.2C40.8 35 44 29.9 44 24c0-1.2-.1-2.4-.4-3.5z"
            />
        </svg>
    );
}

interface GoogleLoginButtonProps {
    /** Callback after successful sign-in (only fires in mock / Supabase mode) */
    onSuccess?: () => void;
    /** Callback if sign-in fails */
    onError?: (error: Error) => void;
    /** Visual variant */
    variant?: "primary" | "outline";
    /** Optional extra class names */
    className?: string;
    /** Disable the button */
    disabled?: boolean;
}

export function GoogleLoginButton({
    onSuccess,
    onError,
    variant = "primary",
    className = "",
    disabled = false,
}: GoogleLoginButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        try {
            await signInWithGoogle("user");
            toast.success("Signed in with Google");
            onSuccess?.();
        } catch (err) {
            const message = (err as Error).message || "Google sign-in failed";
            toast.error(message);
            onError?.(err as Error);
        } finally {
            setLoading(false);
        }
    };

    const baseClasses =
        "w-full font-semibold rounded-full py-3.5 inline-flex items-center justify-center gap-3 transition-all disabled:opacity-50";

    const variantClasses =
        variant === "primary"
            ? "bg-foreground text-background shadow-neon-lg pressable"
            : "border border-white/15 bg-panel-2/80 text-foreground pressable hover:bg-panel-3/60";

    return (
        <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleClick}
            disabled={disabled || loading}
            className={`${baseClasses} ${variantClasses} ${className}`}
            data-testid="google-signin"
        >
            {loading ? (
                <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
                <GoogleG />
            )}
            {loading ? "Signing in…" : "Continue with Google"}
        </motion.button>
    );
}
