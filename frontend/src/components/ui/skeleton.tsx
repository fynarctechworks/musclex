import { cn } from "@/lib/utils"

/**
 * Skeleton — perceived-progress placeholder.
 *
 * Uses the shared `.shimmer` keyframe (defined in globals.css) for a calm,
 * non-distracting sweep across canvas-soft-2. Honors `prefers-reduced-motion`
 * via the global rule. For static placeholders, pass `static` to disable
 * the animation (useful inside Storybook / screenshot tests).
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { static?: boolean }) {
  const { static: isStatic, ...rest } = props as { static?: boolean } & React.HTMLAttributes<HTMLDivElement>
  return (
    <div
      className={cn(
        "rounded-sm bg-canvas-soft-2",
        !isStatic && "shimmer",
        className
      )}
      {...rest}
    />
  )
}

export { Skeleton }
