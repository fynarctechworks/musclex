import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button — Design.md aligned.
 *
 * Variants:
 *  - default  → ink-on-canvas primary CTA (Design.md `button-primary-sm` in-app, `button-primary` at lg)
 *  - secondary → canvas pill with ink text (Design.md `button-secondary`)
 *  - outline   → canvas with hairline border (Design.md `nav-cta-ask-ai`)
 *  - ghost     → transparent until hover
 *  - link      → inline link blue, underlined on hover
 *  - destructive → error-red, reserved for destructive confirms
 *
 * Sizes map directly to the brand's two button scales:
 *  - sm / default / md → nav + in-app scale (6 px radius, 14 px label, 500 weight)
 *  - lg → marketing scale (8 px radius, 16 px label, 48 px tall)
 *  - pill / pill-lg → 100 px marketing CTAs (Design.md hero)
 *
 * Shadows follow the brand ladder: no single heavy drop — only inset hairline
 * rings or the level-2 stacked shadow on the primary CTA.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium select-none",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-level-1 hover:bg-primary/90 active:bg-primary/95",
        secondary:
          "bg-canvas text-foreground shadow-level-1 hover:bg-canvas-soft-2",
        outline:
          "bg-canvas text-foreground border border-hairline hover:bg-canvas-soft",
        ghost:
          "bg-transparent text-foreground hover:bg-canvas-soft-2",
        link:
          "text-link underline-offset-4 hover:underline hover:text-link-deep",
        destructive:
          "bg-error text-on-primary shadow-level-1 hover:bg-error-deep",
      },
      size: {
        // In-app / nav scale (Design.md --geist-radius 6px)
        sm: "h-8 rounded-sm px-3 text-[13px]",
        default: "h-9 rounded-sm px-3.5 text-sm",
        md: "h-10 rounded-sm px-4 text-sm",
        // Marketing scale (Design.md --geist-marketing-radius 8px)
        lg: "h-11 rounded-lg px-5 text-base",
        // Icon-only
        icon: "h-9 w-9 rounded-sm",
        "icon-sm": "h-8 w-8 rounded-sm",
        "icon-lg": "h-10 w-10 rounded-sm",
        // Pill — 100 px marketing CTA
        pill: "h-10 rounded-pill px-5 text-sm",
        "pill-lg": "h-12 rounded-pill px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
