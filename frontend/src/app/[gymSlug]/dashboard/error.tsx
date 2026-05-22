"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-level-2">
        <h2 className="mb-2 text-base font-semibold text-foreground">
          Dashboard failed to load
        </h2>
        <p className="mb-6 text-[13px] text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-6 py-3 text-[13px] font-semibold text-primary-foreground transition-all hover:opacity-90"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
