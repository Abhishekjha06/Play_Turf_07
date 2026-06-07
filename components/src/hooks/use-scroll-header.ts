import { useEffect, useRef, useState } from "react";

/**
 * Tracks scroll position of a scrollable container (or window).
 * Returns scrollY, whether the header is collapsed, and scroll velocity direction.
 */
export function useScrollHeader(threshold = 60) {
    const [scrollY, setScrollY] = useState(0);
    const [collapsed, setCollapsed] = useState(false);
    const [scrollingDown, setScrollingDown] = useState(false);
    const lastY = useRef(0);

    useEffect(() => {
        // Find the nearest scrollable ancestor – the MobileShell inner div
        // We listen on the window since MobileShell uses min-h-dvh natural scroll
        const onScroll = () => {
            const y = window.scrollY;
            setScrollingDown(y > lastY.current);
            lastY.current = y;
            setScrollY(y);
            setCollapsed(y > threshold);
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [threshold]);

    return { scrollY, collapsed, scrollingDown };
}
