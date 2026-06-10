import { LoadingSkeleton, CardSkeleton } from "@/components/shared/loading-skeleton";

export default function SettingsSubscriptionLoading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <LoadingSkeleton className="h-7 w-44" />
          <LoadingSkeleton className="h-4 w-72" />
        </div>
        <div className="rounded-lg border border-hairline bg-card p-6 shadow-level-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <LoadingSkeleton className="h-6 w-40" />
              <LoadingSkeleton className="h-4 w-56" />
            </div>
            <LoadingSkeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2 space-y-3">
          <LoadingSkeleton className="h-4 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
