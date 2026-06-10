'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  stack?: string | null;
  defaultOpen?: boolean;
}

export function StackTrace({ stack, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  if (!stack) {
    return <p className="text-[13px] text-muted-foreground">No stack trace captured.</p>;
  }

  return (
    <div className="rounded-md border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-[13px] font-medium text-foreground"
      >
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Stack trace
      </button>
      <pre
        className={cn(
          'overflow-x-auto border-t border-border px-3 py-2 text-[12px] leading-relaxed text-muted-foreground font-mono whitespace-pre',
          !open && 'hidden',
        )}
      >
        {stack}
      </pre>
    </div>
  );
}
