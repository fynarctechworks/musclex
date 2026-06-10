import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Input — Design.md `form-input` family.
 *
 * Heights match the brand's --geist-form-height ladder:
 *   sm  → 32 px (--geist-form-small-height)
 *   md  → 40 px (default --geist-form-height)
 *   lg  → 48 px (--geist-form-large-height) — for hero CTA forms
 *
 * Surface is canvas with a 1 px hairline border, 6 px radius, body-sm label.
 * Focus ring is the ink color (matches buttons).
 */
const inputVariants = cva(
  [
    "flex w-full rounded-sm border bg-card text-foreground",
    "placeholder:text-muted-foreground",
    "border-hairline",
    "transition-[border-color,box-shadow] duration-fast ease-out",
    "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-canvas-soft",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
    "aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:ring-error/20",
  ].join(" "),
  {
    variants: {
      inputSize: {
        sm: "h-8 px-2.5 text-[13px]",
        md: "h-10 px-3 text-sm",
        lg: "h-12 px-3.5 text-base",
      },
    },
    defaultVariants: {
      inputSize: "md",
    },
  }
)

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ inputSize }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }
