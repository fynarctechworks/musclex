import { LoadingSkeleton, CardSkeleton } from "@/components/shared/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <LoadingSkeleton className="h-7 w-56" />
          <LoadingSkeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2 lg:col-span-2 space-y-3">
            <LoadingSkeleton className="h-4 w-32" />
            <LoadingSkeleton className="h-64 w-full" />
          </div>
          <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2 space-y-3">
            <LoadingSkeleton className="h-4 w-32" />
            <LoadingSkeleton className="h-64 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-hairline bg-card p-5 shadow-level-2 space-y-3">
              <LoadingSkeleton className="h-4 w-40" />
              {Array.from({ length: 4 }).map((_, j) => (
                <LoadingSkeleton key={j} className="h-10 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
