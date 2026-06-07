import React, { useState, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/ui/carousel";
import { cn } from "@/lib/utils";

interface MobileGalleryProps {
  images: string[];
  altPrefix?: string;
}

export function MobileGallery({ images, altPrefix = "Gallery Image" }: MobileGalleryProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  if (!images || images.length === 0) return null;

  return (
    <div className="w-full relative">
      <Carousel 
        opts={{ align: "center", loop: true }}
        setApi={setApi}
        className="w-full"
      >
        <CarouselContent className="-ml-3">
          {images.map((src, i) => (
            <CarouselItem key={i} className="pl-3 basis-[88%]">
              <div className="relative overflow-hidden rounded-[20px] h-[240px] shadow-sm bg-panel-2 border border-white/5">
                <img 
                  src={src} 
                  alt={`${altPrefix} ${i + 1}`} 
                  loading="lazy" 
                  decoding="async" 
                  className="h-full w-full object-cover select-none pointer-events-none" 
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      
      {/* Dots Indicator */}
      <div className="flex justify-center items-center gap-1.5 mt-4">
        {images.map((_, i) => (
          <button
            key={i}
            className={cn(
              "rounded-full transition-all duration-300",
              current === i ? "w-5 h-1.5 bg-primary shadow-neon" : "w-1.5 h-1.5 bg-foreground/20 hover:bg-foreground/40"
            )}
            onClick={() => api?.scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
