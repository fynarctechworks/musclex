import { LoadingSkeleton, CardSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton";

export default function ReportsLoading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <LoadingSkeleton className="h-7 w-40" />
            <LoadingSkeleton className="h-4 w-72" />
          </div>
          <LoadingSkeleton className="h-9 w-28" />
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
        <TableSkeleton rows={8} />
      </div>
    </div>
  );
}
