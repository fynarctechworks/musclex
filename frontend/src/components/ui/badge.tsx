import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge — Design.md `badge-secondary` family.
 *
 * Subtle by default (canvas-soft pill, body-ink label, caption typography).
 * Semantic variants for status indicators (success / warning / error / info).
 * Never carries a heavy drop-shadow — flat by design.
 */
const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 whitespace-nowrap",
    "font-medium leading-none",
    "border transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
  ].join(" "),
  {
    variants: {
      variant: {
        // Brand-default: subtle canvas-soft pill (Design.md `badge-secondary`)
        default:
          "bg-canvas-soft-2 text-foreground border-transparent",
        // Solid ink — for high-emphasis status (e.g. "Live")
        solid:
          "bg-primary text-primary-foreground border-transparent",
        // Outline — hairline only
        outline:
          "bg-transparent text-foreground border-hairline",
        // Semantic soft pills (background-soft + deep text)
        success:
          "bg-success/12 text-success border-transparent",
        warning:
          "bg-warning-soft text-warning-deep border-transparent",
        destructive:
          "bg-error-soft text-error-deep border-transparent",
        info:
          "bg-link-soft text-link-deep border-transparent",
        // Mono caption pill — for IDs, codes, version tags
        mono:
          "bg-canvas-soft-2 text-foreground border-transparent font-mono uppercase tracking-wide",
        // Legacy alias
        secondary:
          "bg-canvas-soft-2 text-foreground border-transparent",
      },
      size: {
        sm: "h-5 px-2 text-[11px] rounded-full",
        md: "h-6 px-2.5 text-xs rounded-full",
        lg: "h-7 px-3 text-xs rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
