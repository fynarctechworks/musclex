"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Optional mono caption above the title (Design.md section eyebrow). */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Page header — Design.md display-sm title, mono eyebrow above, body-sm
 * description below. Right-aligned action cluster wraps on mobile.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 pb-6 border-b border-hairline sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-caption-mono mb-1.5 uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-display-sm text-foreground truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground leading-5 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
