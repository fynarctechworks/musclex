'use client';

import { ShieldAlert } from 'lucide-react';

export function AccessDenied({ module }: { module?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Access denied</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-md">
        You don&apos;t have permission to view {module ? `the ${module} module` : 'this page'}.
        Contact your studio owner if you believe this is a mistake.
      </p>
    </div>
  );
}
