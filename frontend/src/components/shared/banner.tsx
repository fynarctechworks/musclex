"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Banner — unified inline notification surface for top-of-page or
 * top-of-section states. Replaces ad-hoc `<div className="rounded-lg
 * border border-warning/30 bg-warning-soft ...">` snippets scattered
 * across the codebase.
 *
 * Tone maps to semantic tokens. Optional CTA + dismiss. Same chrome,
 * same spacing, same icon position everywhere.
 *
 *   <Banner tone="warning" title="Offline mode" description="..." />
 *   <Banner tone="info" title="3 pending sync" cta={...} onDismiss={...} />
 */

const bannerVariants = cva(
  [
    "flex items-start gap-3 rounded-md px-4 py-3",
    "border text-sm",
    "transition-colors duration-fast ease-out",
  ].join(" "),
  {
    variants: {
      tone: {
        info: "bg-link-soft border-link/20 text-link-deep",
        success: "bg-success/12 border-success/30 text-success",
        warning: "bg-warning-soft border-warning/30 text-warning-deep",
        error: "bg-error-soft border-error/30 text-error-deep",
        neutral: "bg-canvas-soft border-hairline text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

const toneIcon: Record<
  NonNullable<VariantProps<typeof bannerVariants>["tone"]>,
  LucideIcon
> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  neutral: Info,
};

export interface BannerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof bannerVariants> {
  /** Optional override for the default tone icon. */
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  cta?: React.ReactNode;
  onDismiss?: () => void;
}

export function Banner({
  tone = "neutral",
  icon,
  title,
  description,
  cta,
  onDismiss,
  className,
  ...rest
}: BannerProps) {
  const Icon = icon ?? toneIcon[tone ?? "neutral"];
  return (
    <div
      role="status"
      className={cn(bannerVariants({ tone }), className)}
      {...rest}
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-5">{title}</p>
        {description && (
          <p className="mt-0.5 text-[13px] leading-5 opacity-90">
            {description}
          </p>
        )}
      </div>
      {cta && <div className="shrink-0 flex items-center">{cta}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 -mt-1 inline-flex h-6 w-6 items-center justify-center rounded-sm opacity-70 transition-opacity duration-fast hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * BannerStack — vertical stack of related banners with shared spacing.
 * Skips falsy children so callers can use conditional rendering without
 * leaving empty gaps.
 */
export function BannerStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
}

// Re-export the Button so call-sites don't need a second import for the CTA.
export { Button as BannerButton };
