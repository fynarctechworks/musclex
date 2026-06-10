import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

export default function CheckInLoading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <LoadingSkeleton className="h-7 w-44" />
          <LoadingSkeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2 lg:col-span-2 space-y-3">
            <LoadingSkeleton className="h-4 w-32" />
            <LoadingSkeleton className="aspect-video w-full" />
            <div className="flex gap-2">
              <LoadingSkeleton className="h-9 w-28" />
              <LoadingSkeleton className="h-9 w-28" />
            </div>
          </div>
          <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2 space-y-3">
            <LoadingSkeleton className="h-4 w-32" />
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
