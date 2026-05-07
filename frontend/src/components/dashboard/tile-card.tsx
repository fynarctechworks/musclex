"use client";

import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FreshnessPill } from "./freshness-pill";

export type TileSize = 1 | 2 | 3;

export interface TileCardProps {
  title: string;
  /** Optional one-line subtitle under the title — used for context like "Last 30 days". */
  subtitle?: string;
  /** Optional icon shown left of the title in the primary accent color. */
  icon?: ComponentType<LucideProps>;
  /** As-of timestamp from the server. Renders <FreshnessPill> when provided. */
  freshness?: Date | string | number;
  /**
   * Deprecated: previously rendered a magnifier that opened a SQL/formula
   * inspector. Hidden from end users — this prop is now a no-op kept only
   * for backwards compatibility with existing callers.
   */
  onInspect?: () => void;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  error?: string | null;
  /** Width in 12-col grid units (1=third, 2=two-thirds, 3=full). Defaults to 1. */
  size?: TileSize;
  /** Optional element rendered on the right side of the header (e.g. a CTA link). */
  headerAction?: ReactNode;
  className?: string;
  children?: ReactNode;
}

const sizeToColSpan: Record<TileSize, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
};

/**
 * Reusable wrapper every dashboard tile must use.
 * Visual contract matches the existing Revenue Trend block on the dashboard:
 *   bg-card border border-border rounded-xl p-5
 *
 * Provides loading / empty / error states inline so each tile file does not
 * have to re-implement them. Reuses tokens only — no new colors or radii.
 */
export function TileCard({
  title,
  subtitle,
  icon: Icon,
  freshness,
  onInspect: _onInspect,
  loading,
  empty,
  emptyTitle = "No data yet",
  emptyDescription,
  error,
  size = 1,
  headerAction,
  className,
  children,
}: TileCardProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 bg-card border border-border rounded-xl p-5 shadow-sm transition-shadow hover:shadow-md",
        sizeToColSpan[size],
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {Icon ? (
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <h2 className="text-[17px] font-semibold leading-tight text-foreground truncate">
              {title}
            </h2>
            {freshness ? (
              <FreshnessPill
                asOf={
                  freshness instanceof Date ? freshness.toISOString() : freshness
                }
              />
            ) : null}
          </div>
          {subtitle && (
            <p className="mt-1 text-[12px] text-muted-foreground truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerAction}
        </div>
      </header>

      <div className="min-h-0">
        {loading ? (
          <LoadingSkeleton className="h-40 w-full" />
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : empty ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}
