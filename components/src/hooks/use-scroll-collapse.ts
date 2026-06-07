import { useEffect, useRef, useState } from "react";

/**
 * Tracks scroll position within a scrollable container (or window).
 * Returns `collapsed` (true when scrolled past threshold) and the raw scrollY value.
 * Optimised with passive listeners and requestAnimationFrame for 60 FPS.
 */
export function useScrollCollapse(threshold = 60) {
    const [scrollY, setScrollY] = useState(0);
    const [collapsed, setCollapsed] = useState(false);
    const rafId = useRef<number>(0);

    useEffect(() => {
        const onScroll = () => {
            if (rafId.current) cancelAnimationFrame(rafId.current);
            rafId.current = requestAnimationFrame(() => {
                const y = window.scrollY;
                setScrollY(y);
                setCollapsed(y > threshold);
            });
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            cancelAnimationFrame(rafId.current);
        };
    }, [threshold]);

    return { scrollY, collapsed };
}
