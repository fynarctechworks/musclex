"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PulseCarouselProps {
  children: React.ReactNode[];
  className?: string;
}

/**
 * Horizontal scroll-snap carousel for mobile. One pulse card visible at a
 * time, full bleed minus 24px peek of the next so users discover there's
 * more. Dot indicator below tracks position. Native scroll handles all the
 * physics — no JS gesture handler needed (avoids fighting the OS).
 */
export function PulseCarousel({ children, className }: PulseCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = children.length;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      // Determine which card is most visible: card width is ~el.clientWidth,
      // active = round(scrollLeft / cardWidth).
      const cardWidth = el.clientWidth - 24; // matches peek
      if (cardWidth <= 0) return;
      const idx = Math.round(el.scrollLeft / cardWidth);
      setActive(Math.max(0, Math.min(count - 1, idx)));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [count]);

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 -mx-4 px-4"
        style={{ scrollbarWidth: "none" }}
      >
        {children.map((child, i) => (
          <div
            key={i}
            className="snap-start shrink-0"
            style={{ width: "calc(100vw - 56px)" }}
          >
            {child}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-1">
        {children.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to card ${i + 1}`}
            onClick={() => {
              const el = scrollerRef.current;
              if (!el) return;
              const cardWidth = el.clientWidth - 24;
              el.scrollTo({ left: cardWidth * i, behavior: "smooth" });
            }}
            className={cn(
              "h-1.5 rounded-full transition-all",
              active === i
                ? "w-6 bg-primary"
                : "w-1.5 bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
    </div>
  );
}
