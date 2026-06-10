import { LoadingSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton";

export default function SettingsPermissionsLoading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <LoadingSkeleton className="h-7 w-44" />
          <LoadingSkeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <LoadingSkeleton className="h-9 w-48" />
          <LoadingSkeleton className="h-9 w-32" />
        </div>
        <TableSkeleton rows={10} />
      </div>
    </div>
  );
}
