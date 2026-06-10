import { LoadingSkeleton, CardSkeleton } from "@/components/shared/loading-skeleton";

export default function StaffDetailLoading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <LoadingSkeleton className="h-4 w-32" />
        <div className="flex items-start gap-4">
          <LoadingSkeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton className="h-7 w-56" />
            <LoadingSkeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="flex gap-2 border-b border-hairline pb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-9 w-24" />
          ))}
        </div>
        <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
