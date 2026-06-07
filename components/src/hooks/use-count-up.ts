import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` over `duration` ms.
 * Uses requestAnimationFrame for smooth 60 FPS counting.
 * Returns the current animated value as a number.
 */
export function useCountUp(target: number, duration = 900, start = true): number {
    const [value, setValue] = useState(0);
    const rafId = useRef<number>(0);
    const startTime = useRef<number | null>(null);

    useEffect(() => {
        if (!start) return;
        startTime.current = null;

        const step = (timestamp: number) => {
            if (startTime.current === null) startTime.current = timestamp;
            const elapsed = timestamp - startTime.current;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.floor(eased * target));
            if (progress < 1) {
                rafId.current = requestAnimationFrame(step);
            } else {
                setValue(target);
            }
        };

        rafId.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafId.current);
    }, [target, duration, start]);

    return value;
}
