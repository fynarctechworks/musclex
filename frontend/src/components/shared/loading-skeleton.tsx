"use client";

import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
}

/**
 * LoadingSkeleton — canvas-soft-2 shimmer (matches Design.md surface ladder).
 */
export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div
      className={cn(
        "shimmer rounded-sm bg-canvas-soft-2",
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2 space-y-3">
      <LoadingSkeleton className="h-9 w-9 rounded-sm" />
      <LoadingSkeleton className="h-3.5 w-24" />
      <LoadingSkeleton className="h-7 w-32" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-hairline overflow-hidden">
      <LoadingSkeleton className="h-10 w-full rounded-none" />
      <div className="divide-y divide-hairline">
        {Array.from({ length: rows }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
