/**
 * Shimmer skeleton loader component.
 * Renders an animated shimmer placeholder that can be used while content loads.
 * Respects prefers-reduced-motion.
 */
import { cn } from "@/lib/utils";

interface ShimmerProps {
    className?: string;
    /** border-radius shorthand — defaults to rounded-xl */
    rounded?: string;
}

export function Shimmer({ className, rounded = "rounded-xl" }: ShimmerProps) {
    return (
        <div
            className={cn(
                "relative overflow-hidden",
                rounded,
                className
            )}
            style={{
                background: "hsl(var(--panel-2))",
            }}
            aria-hidden="true"
        >
            <div
                className="absolute inset-0 shimmer-wave motion-reduce:hidden"
                style={{
                    backgroundImage:
                        "linear-gradient(90deg, transparent 0%, hsl(var(--panel-3)) 50%, transparent 100%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmerWave 1.6s linear infinite",
                }}
            />
        </div>
    );
}

/** Preset skeleton for a TurfCard */
export function TurfCardSkeleton() {
    return (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-white/5">
            <Shimmer className="h-28" rounded="rounded-none" />
            <div className="p-3 space-y-2">
                <Shimmer className="h-4 w-3/4" />
                <Shimmer className="h-3 w-1/2" />
                <Shimmer className="h-3 w-1/3 mt-1" />
                <Shimmer className="h-8 w-full mt-2 rounded-full" rounded="rounded-full" />
            </div>
        </div>
    );
}

/** Preset skeleton for a BookingRow */
export function BookingRowSkeleton() {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-white/5 p-3">
            <Shimmer className="h-14 w-14 shrink-0" rounded="rounded-xl" />
            <div className="flex-1 space-y-2">
                <Shimmer className="h-4 w-2/3" />
                <Shimmer className="h-3 w-1/2" />
                <Shimmer className="h-3 w-1/3" />
            </div>
        </div>
    );
}
