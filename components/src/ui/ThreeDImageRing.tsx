"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, easeOut } from "framer-motion";
import { cn } from "@/lib/utils";
import { animate } from "framer-motion";

export interface ThreeDImageRingProps {
  /** Array of image URLs to display in the ring */
  images: string[];
  /** Container width in pixels (will be scaled) */
  width?: number;
  /** 3D perspective value */
  perspective?: number;
  /** Distance of images from center (z-depth) */
  imageDistance?: number;
  /** Initial rotation of the ring */
  initialRotation?: number;
  /** Animation duration for entrance */
  animationDuration?: number;
  /** Stagger delay between images */
  staggerDelay?: number;
  /** Hover opacity for non-hovered images */
  hoverOpacity?: number;
  /** Custom container className */
  containerClassName?: string;
  /** Custom ring className */
  ringClassName?: string;
  /** Custom image className */
  imageClassName?: string;
  /** Background color of the stage */
  backgroundColor?: string;
  /** Enable/disable drag functionality */
  draggable?: boolean;
  /** Animation ease for entrance */
  ease?: string;
  /** Breakpoint for mobile responsiveness (e.g., 768 for iPad mini) */
  mobileBreakpoint?: number;
  /** Scale factor for mobile (e.g., 0.7 for 70% size) */
  mobileScaleFactor?: number;
  /** Power for the drag end inertia animation (higher means faster stop) */
  inertiaPower?: number;
  /** Time constant for the drag end inertia animation (duration of deceleration in ms) */
  inertiaTimeConstant?: number;
  /** Multiplier for initial velocity when drag ends (influences initial "spin") */
  inertiaVelocityMultiplier?: number;
  /** Callback when active image index changes */
  onChangeActiveIndex?: (index: number) => void;
  /** Enable auto-rotation */
  autoplay?: boolean;
  /** Auto-rotation interval in milliseconds */
  autoplayInterval?: number;
}

export function ThreeDImageRing({
  images,
  width = 180,
  perspective = 1200,
  imageDistance = 220,
  initialRotation = 180,
  animationDuration = 1.2,
  staggerDelay = 0.08,
  hoverOpacity = 0.5,
  containerClassName,
  ringClassName,
  imageClassName,
  backgroundColor,
  draggable = true,
  ease = "easeOut",
  mobileBreakpoint = 768,
  mobileScaleFactor = 0.8,
  inertiaPower = 0.8,
  inertiaTimeConstant = 300,
  inertiaVelocityMultiplier = 20,
  onChangeActiveIndex,
  autoplay = true,
  autoplayInterval = 3000,
}: ThreeDImageRingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const rotationY = useMotionValue(initialRotation);
  const startX = useRef<number>(0);
  const currentRotationY = useRef<number>(initialRotation);
  const isDragging = useRef<boolean>(false);
  const velocity = useRef<number>(0);

  const [currentScale, setCurrentScale] = useState(1);
  const [showImages, setShowImages] = useState(false);
  const lastActiveIndex = useRef<number>(0);

  const angle = useMemo(() => 360 / images.length, [images.length]);

  const getBgPos = (imageIndex: number, currentRot: number, scale: number) => {
    const scaledImageDistance = imageDistance * scale;
    const effectiveRotation = currentRot - 180 - imageIndex * angle;
    const parallaxOffset = ((effectiveRotation % 360 + 360) % 360) / 360;
    return `${-(parallaxOffset * (scaledImageDistance / 1.5))}px 0px`;
  };

  useEffect(() => {
    const unsubscribe = rotationY.on("change", (latestRotation) => {
      if (ringRef.current) {
        Array.from(ringRef.current.children).forEach((imgElement, i) => {
          (imgElement as HTMLElement).style.backgroundPosition = getBgPos(
            i,
            latestRotation,
            currentScale
          );
        });
      }
      currentRotationY.current = latestRotation;
      const relativeRot = latestRotation - initialRotation;
      const normalizedRot = ((relativeRot % 360) + 360) % 360;
      const index = Math.round(normalizedRot / angle) % images.length;
      if (index !== lastActiveIndex.current) {
        lastActiveIndex.current = index;
        onChangeActiveIndex?.(index);
      }
    });
    return () => unsubscribe();
  }, [rotationY, images.length, imageDistance, currentScale, angle, initialRotation]);

  useEffect(() => {
    const handleResize = () => {
      const viewportWidth = window.innerWidth;
      const newScale = viewportWidth <= mobileBreakpoint ? mobileScaleFactor : 1;
      setCurrentScale(newScale);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, [mobileBreakpoint, mobileScaleFactor]);

  useEffect(() => {
    setShowImages(true);
  }, []);

  useEffect(() => {
    if (!autoplay || images.length <= 1) return;

    const interval = setInterval(() => {
      if (isDragging.current) return;
      const current = rotationY.get();
      const next = current + angle;
      animate(rotationY, next, {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
      });
    }, autoplayInterval);

    return () => clearInterval(interval);
  }, [autoplay, autoplayInterval, angle, rotationY, images.length]);

  const handleDragStart = (event: React.MouseEvent | React.TouchEvent) => {
    if (!draggable) return;
    isDragging.current = true;
    const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
    startX.current = clientX;
    rotationY.stop();
    velocity.current = 0;
    if (ringRef.current) {
      (ringRef.current as HTMLElement).style.cursor = "grabbing";
    }
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchmove", handleDrag);
    document.addEventListener("touchend", handleDragEnd);
  };

  const handleDrag = (event: MouseEvent | TouchEvent) => {
    if (!draggable || !isDragging.current) return;

    const clientX = "touches" in event ? (event as TouchEvent).touches[0].clientX : (event as MouseEvent).clientX;
    const deltaX = clientX - startX.current;

    velocity.current = -deltaX * 0.5;

    rotationY.set(currentRotationY.current + velocity.current);

    startX.current = clientX;
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    if (ringRef.current) {
      ringRef.current.style.cursor = "grab";
      currentRotationY.current = rotationY.get();
    }

    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", handleDragEnd);
    document.removeEventListener("touchmove", handleDrag);
    document.removeEventListener("touchend", handleDragEnd);

    const initial = rotationY.get();
    const velocityBoost = velocity.current * inertiaVelocityMultiplier;
    const target = initial + velocityBoost;

    animate(initial, target, {
      type: "inertia",
      velocity: velocityBoost,
      power: inertiaPower,
      timeConstant: inertiaTimeConstant,
      restDelta: 0.5,
      modifyTarget: (target) => Math.round(target / angle) * angle,
      onUpdate: (latest) => {
        rotationY.set(latest);
      },
    });

    velocity.current = 0;
  };

  const imageVariants = {
    hidden: { y: 200, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full h-full overflow-hidden select-none relative",
        containerClassName
      )}
      style={{
        backgroundColor,
        transform: `scale(${currentScale})`,
        transformOrigin: "center center",
      }}
      onMouseDown={draggable ? handleDragStart : undefined}
      onTouchStart={draggable ? handleDragStart : undefined}
    >
      <div
        style={{
          perspective: `${perspective}px`,
          width: `${width}px`,
          height: `${width * 1.33}px`,
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <motion.div
          ref={ringRef}
          className={cn(
            "w-full h-full absolute",
            ringClassName
          )}
          style={{
            transformStyle: "preserve-3d",
            rotateY: rotationY,
            cursor: draggable ? "grab" : "default",
          }}
        >
          <AnimatePresence>
            {showImages && images.map((imageUrl, index) => (
              <motion.div
                key={index}
                className={cn(
                  "w-full h-full absolute rounded-xl overflow-hidden shadow-xl border border-white/10",
                  imageClassName
                )}
                style={{
                  transformStyle: "preserve-3d",
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                  backfaceVisibility: "hidden",
                  rotateY: index * -angle,
                  z: -imageDistance * currentScale,
                  transformOrigin: `50% 50% ${imageDistance * currentScale}px`,
                  backgroundPosition: "center",
                }}
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={imageVariants}
                custom={index}
                transition={{
                  delay: index * staggerDelay,
                  duration: animationDuration,
                  ease: easeOut,
                }}
                whileHover={{ opacity: 1, transition: { duration: 0.15 } }}
                onHoverStart={() => {
                  if (isDragging.current) return;
                  if (ringRef.current) {
                    Array.from(ringRef.current.children).forEach((imgEl, i) => {
                      if (i !== index) {
                        (imgEl as HTMLElement).style.opacity = `${hoverOpacity}`;
                      }
                    });
                  }
                }}
                onHoverEnd={() => {
                  if (isDragging.current) return;
                  if (ringRef.current) {
                    Array.from(ringRef.current.children).forEach((imgEl) => {
                      (imgEl as HTMLElement).style.opacity = `1`;
                    });
                  }
                }}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

export default ThreeDImageRing;
