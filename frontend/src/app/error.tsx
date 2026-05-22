"use client";

import { useEffect } from "react";
import { RefreshCw, LayoutDashboard } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
      style={{ background: "#0D1B2A", color: "#FFFFFF" }}
    >
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg"
        style={{ background: "#1E3450", border: "1px solid #2A4A6A" }}
      >
        <span className="text-2xl font-semibold" style={{ color: "#EF4444" }}>!</span>
      </div>

      <h1 className="mb-2 text-2xl font-semibold">Something went wrong</h1>
      <p className="mb-2 max-w-sm text-sm" style={{ color: "#B0C8E0" }}>
        An unexpected error occurred. Our team has been notified automatically.
      </p>
      {error.digest && (
        <p className="mb-8 text-xs font-mono" style={{ color: "#5A7A9A" }}>
          Error ID: {error.digest}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          style={{ background: "#1E3450", border: "1px solid #2A4A6A", color: "#B0C8E0" }}
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <a
          href="/workspace-select"
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
          style={{ background: "#4A9FD4", color: "#FFFFFF" }}
        >
          <LayoutDashboard className="h-4 w-4" />
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
