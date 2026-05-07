"use client";

import { useEffect, useState } from "react";

/**
 * Reactive mobile-breakpoint detector. Mirrors the §14 cutoff (≤767px =
 * mobile). The dashboard mounts a different shell at this width — not a
 * shrunken desktop, but a purpose-built decision instrument.
 *
 * Defaults to `false` during SSR so the desktop shell is the safe initial
 * render; the client switches to mobile after hydration if needed.
 */
export function useIsMobile(maxWidth = 767): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);

  return isMobile;
}
