import { LoadingSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton";

export default function MembersLoading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <LoadingSkeleton className="h-7 w-36" />
            <LoadingSkeleton className="h-4 w-64" />
          </div>
          <LoadingSkeleton className="h-9 w-32" />
        </div>
        <div className="flex gap-2">
          <LoadingSkeleton className="h-9 w-64" />
          <LoadingSkeleton className="h-9 w-32" />
          <LoadingSkeleton className="h-9 w-32" />
        </div>
        <TableSkeleton rows={10} />
      </div>
    </div>
  );
}
