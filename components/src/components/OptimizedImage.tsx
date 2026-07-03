import React, { useState, useEffect, useRef, forwardRef } from "react";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  placeholder?: "blur" | "shimmer" | "none";
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  fetchpriority?: "high" | "low" | "auto";
  sizes?: string;
  srcSet?: string;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  objectPosition?: string;
  className?: string;
  containerClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * OptimizedImage — Production-grade image component with:
 * - Lazy loading with IntersectionObserver
 * - Blur placeholder / shimmer effect
 * - WebP/AVIF source selection
 * - Responsive srcset support
 * - Proper width/height for CLS prevention
 * - Async decoding
 * - Loading state management
 */
export const OptimizedImage = forwardRef<HTMLImageElement, OptimizedImageProps>(
  (
    {
      src,
      alt,
      width,
      height,
      placeholder = "blur",
      loading = "lazy",
      decoding = "async",
      fetchpriority = "auto",
      sizes,
      srcSet,
      objectFit = "cover",
      objectPosition = "center",
      className = "",
      containerClassName = "",
      onLoad,
      onError,
      style,
      ...rest
    },
    forwardedRef
  ) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(loading === "eager");
    const [hasError, setHasError] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // IntersectionObserver for lazy loading
    useEffect(() => {
      if (loading === "eager" || isInView) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsInView(true);
              observer.disconnect();
            }
          });
        },
        {
          rootMargin: "200px 0px", // Start loading 200px before viewport
          threshold: 0,
        }
      );

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      return () => observer.disconnect();
    }, [loading]);

    // Handle image load
    const handleLoad = () => {
      setIsLoaded(true);
      onLoad?.();
    };

    // Handle image error
    const handleError = () => {
      setHasError(true);
      onError?.();
    };

    // Generate WebP/AVIF src alternatives if not provided
    const generateSrcSet = () => {
      if (srcSet) return srcSet;
      // If the source is already a CDN or optimized URL, use as-is
      return undefined;
    };

    // Blur hash or color placeholder
    const getPlaceholderStyle = (): React.CSSProperties => {
      if (placeholder === "blur") {
        return {
          filter: isLoaded ? "blur(0px)" : "blur(20px)",
          transition: "filter 0.3s ease-out",
          transform: isLoaded ? "scale(1)" : "scale(1.05)",
        };
      }
      if (placeholder === "shimmer") {
        return {
          opacity: isLoaded ? 1 : 0.5,
          transition: "opacity 0.3s ease-out",
        };
      }
      return {};
    };

    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden ${containerClassName}`}
        style={{
          width: width ? `${width}px` : "100%",
          height: height ? `${height}px` : "100%",
          aspectRatio: width && height ? `${width} / ${height}` : undefined,
          backgroundColor: "hsl(215 22% 14%)",
        }}
      >
        {/* Shimmer placeholder */}
        {!isLoaded && placeholder === "shimmer" && (
          <div
            className="absolute inset-0 shimmer-bg"
            style={{
              background:
                "linear-gradient(90deg, hsl(215 22% 14%) 25%, hsl(215 22% 18%) 50%, hsl(215 22% 14%) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
            }}
          />
        )}

        {/* Actual image */}
        {isInView && !hasError && (
          <picture>
            {/* AVIF source */}
            <source
              srcSet={src.replace(/\.(jpg|jpeg|png|webp)$/i, ".avif")}
              type="image/avif"
              sizes={sizes}
            />
            {/* WebP source */}
            <source
              srcSet={src.replace(/\.(jpg|jpeg|png)$/i, ".webp")}
              type="image/webp"
              sizes={sizes}
            />
            {/* Fallback */}
            <img
              ref={(node) => {
                imgRef.current = node;
                if (typeof forwardedRef === "function") {
                  forwardedRef(node);
                } else if (forwardedRef) {
                  forwardedRef.current = node;
                }
              }}
              src={src}
              alt={alt}
              width={width}
              height={height}
              loading={loading}
              decoding={decoding}
              fetchPriority={fetchpriority}
              sizes={sizes}
              srcSet={generateSrcSet()}
              onLoad={handleLoad}
              onError={handleError}
              className={`block w-full h-full ${className}`}
              style={{
                objectFit,
                objectPosition,
                ...getPlaceholderStyle(),
                ...style,
              }}
              {...rest}
            />
          </picture>
        )}

        {/* Error fallback */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-panel">
            <span className="text-xs text-muted2">Failed to load image</span>
          </div>
        )}
      </div>
    );
  }
);

OptimizedImage.displayName = "OptimizedImage";

export default OptimizedImage;
