import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Card — Design.md `card-marketing` / `card-soft` chrome.
 *
 * Surfaces sit on `bg-card` (canvas) with a hairline border + level-2 stacked
 * shadow (no single heavy drop). The `soft` tone is for nested clusters that
 * need to recede; `ink` is the polarity-flipped variant.
 *
 * Radius defaults to 8 px (Design.md marketing radius). Use `lg` for callouts
 * (12 px) and `xl` when hosting a hero image cap (16 px).
 */
const cardVariants = cva(
  "bg-card text-card-foreground border border-hairline",
  {
    variants: {
      tone: {
        default: "bg-card",
        soft: "bg-canvas-soft",
        ink: "surface-ink border-transparent",
      },
      elevation: {
        flat: "shadow-none",
        hairline: "shadow-level-1 border-transparent",
        sm: "shadow-level-2",
        md: "shadow-level-3",
        lg: "shadow-level-4",
      },
      radius: {
        sm: "rounded-md",        // 6 px — small inline cards
        DEFAULT: "rounded-lg",   // 8 px — feature-card chrome (Design.md md)
        lg: "rounded-[12px]",    // 12 px — callout / pricing-card (Design.md lg)
        xl: "rounded-[16px]",    // 16 px — hero image-capped cards (Design.md xl)
      },
    },
    defaultVariants: {
      tone: "default",
      elevation: "sm",
      radius: "DEFAULT",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone, elevation, radius, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ tone, elevation, radius }), className)}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-base font-semibold leading-6 tracking-[-0.01em] text-foreground",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-5", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-2 p-6 pt-0 border-t border-hairline/0",
      className
    )}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
}
