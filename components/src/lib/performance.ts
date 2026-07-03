/**
 * Performance utilities for PlayTurf
 * Includes: preconnect, prefetch, preload helpers, idle callback scheduling,
 * and Core Web Vitals measurement helpers.
 */

/**
 * Inject a <link rel="preconnect"> or <link rel="dns-prefetch"> into the document head.
 */
export function injectPreconnect(href: string, crossOrigin = true) {
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = href;
  if (crossOrigin) link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

export function injectDnsPrefetch(href: string) {
  const link = document.createElement("link");
  link.rel = "dns-prefetch";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Preload a critical resource (font, image, css, etc.)
 */
export function preloadResource(
  href: string,
  as: "font" | "image" | "style" | "script" | "fetch",
  type?: string,
  crossOrigin?: boolean
) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.href = href;
  link.as = as;
  if (type) link.type = type;
  if (crossOrigin) link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

/**
 * Prefetch a resource for future navigation
 */
export function prefetchResource(href: string, as?: "document" | "script" | "style" | "font" | "image" | "fetch") {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = href;
  if (as) link.as = as;
  document.head.appendChild(link);
}

/**
 * Schedule work during browser idle time using requestIdleCallback
 * with a fallback to setTimeout.
 */
export function scheduleIdleWork<T>(
  callback: () => T,
  timeout = 2000
): Promise<T> {
  return new Promise((resolve) => {
    const run = () => resolve(callback());
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(run, { timeout });
    } else {
      setTimeout(run, 1);
    }
  });
}

/**
 * Defer non-critical initialization until after the page is interactive.
 */
export function deferUntilInteractive(callback: () => void) {
  if (document.readyState === "complete") {
    scheduleIdleWork(callback);
  } else {
    window.addEventListener("load", () => scheduleIdleWork(callback));
  }
}

/**
 * Measure and report Core Web Vitals to an analytics endpoint.
 */
export function reportWebVitals(
  endpoint: string,
  headers?: Record<string, string>
) {
  const send = (metric: { name: string; value: number; id: string; delta?: number }) => {
    const body = JSON.stringify({
      ...metric,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent.slice(0, 100),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, body);
    } else {
      fetch(endpoint, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json", ...headers },
        keepalive: true,
      }).catch(() => {});
    }
  };

  return send;
}

/**
 * Check if the browser supports AVIF images.
 */
export async function supportsAvif(): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src =
      "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=";
  });
}

/**
 * Check if the browser supports WebP images.
 */
export function supportsWebp(): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src =
      "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
  });
}

/**
 * Get optimal image format extension based on browser support.
 */
export async function getOptimalImageFormat(): Promise<"avif" | "webp" | "jpg"> {
  if (await supportsAvif()) return "avif";
  if (await supportsWebp()) return "webp";
  return "jpg";
}

/**
 * Batch multiple DOM reads/writes to avoid layout thrashing.
 */
export function batchDomOperations<T>(operations: (() => T)[]): T[] {
  const results: T[] = [];
  // Force layout sync by reading offsetHeight
  document.body.offsetHeight;
  for (const op of operations) {
    results.push(op());
  }
  return results;
}

/**
 * Observe element visibility and trigger callback when visible.
 */
export function observeVisibility(
  element: Element,
  callback: (isVisible: boolean) => void,
  options?: IntersectionObserverInit
): () => void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      callback(entry.isIntersecting);
    });
  }, { threshold: 0, rootMargin: "50px", ...options });

  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * Preload critical hero images for LCP optimization.
 */
export function preloadHeroImages(imageUrls: string[]) {
  imageUrls.forEach((url, index) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = url;
    link.fetchPriority = index === 0 ? "high" : "low";
    document.head.appendChild(link);
  });
}

/**
 * Initialize critical performance optimizations on page load.
 */
export function initPerformanceOptimizations() {
  // Preconnect to critical origins
  const criticalOrigins = [
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
  ];

  // Add Supabase origin if configured
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      criticalOrigins.push(`${url.protocol}//${url.host}`);
    } catch {
      // ignore invalid URL
    }
  }

  criticalOrigins.forEach((origin) => {
    injectPreconnect(origin, origin.includes("gstatic"));
  });

  // Prefetch likely next routes
  deferUntilInteractive(() => {
    const likelyRoutes = ["/tournaments", "/open-games", "/offers"];
    likelyRoutes.forEach((route) => {
      prefetchResource(route, "document");
    });
  });
}
