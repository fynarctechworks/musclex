import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Textarea — Design.md `form-input` adapted for multiline.
 * Same chrome as Input: canvas surface, hairline border, 6 px radius, ink focus.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-sm border border-hairline bg-card px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "transition-[border-color,box-shadow] duration-fast ease-out",
        "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-canvas-soft",
        "aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:ring-error/20",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
