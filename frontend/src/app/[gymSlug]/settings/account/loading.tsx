import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

export default function SettingsAccountLoading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <LoadingSkeleton className="h-7 w-44" />
          <LoadingSkeleton className="h-4 w-72" />
        </div>
        {Array.from({ length: 3 }).map((_, section) => (
          <div key={section} className="rounded-lg border border-hairline bg-card p-6 shadow-level-2 space-y-4">
            <LoadingSkeleton className="h-5 w-40" />
            <LoadingSkeleton className="h-3 w-64" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <LoadingSkeleton className="h-3 w-24" />
                  <LoadingSkeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
