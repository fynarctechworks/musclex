"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md" | "lg" | "xl";

/**
 * Fluid size tokens — each uses clamp(min, viewport-scaled, max) so the
 * cube grows on tablet/desktop and shrinks on small phones without
 * needing breakpoint props at every callsite.
 */
const SIZE_FLUID: Record<SpinnerSize, string> = {
  sm: "clamp(16px, 2.5vw, 24px)",
  md: "clamp(20px, 3.5vw, 32px)",
  lg: "clamp(24px, 4.5vw, 40px)",
  xl: "clamp(28px, 5.5vw, 48px)",
};

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size token (fluid) or a fixed pixel value. */
  size?: SpinnerSize | number;
  label?: string;
}

export function Spinner({
  size = "md",
  label = "Loading",
  className,
  style,
  ...rest
}: SpinnerProps) {
  const sizeValue =
    typeof size === "number" ? `${size}px` : SIZE_FLUID[size];
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("spinner-cube", className)}
      style={{ ["--spinner-size" as string]: sizeValue, ...style }}
      {...rest}
    >
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <span className="sr-only">{label}</span>
    </div>
  );
}

interface SpinnerOverlayProps {
  label?: string;
  size?: SpinnerSize | number;
  fullscreen?: boolean;
  className?: string;
}

export function SpinnerOverlay({
  label = "Loading",
  size = "lg",
  fullscreen = false,
  className,
}: SpinnerOverlayProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 bg-background/70 backdrop-blur-sm",
        fullscreen ? "fixed inset-0 z-50" : "absolute inset-0 z-10",
        className,
      )}
    >
      <Spinner size={size} label={label} />
      {label ? (
        <p className="text-sm text-muted-foreground" aria-hidden="true">
          {label}
        </p>
      ) : null}
    </div>
  );
}
