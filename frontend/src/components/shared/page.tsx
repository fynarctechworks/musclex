"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Page layout primitives — every in-product page should compose from these.
 *
 * The standard recipe is:
 *
 *   <Page>
 *     <PageHeader title="..." description="..." actions={...} />
 *     <PageBody>
 *       <Card> ... </Card>
 *     </PageBody>
 *   </Page>
 *
 * Or, for a denser dashboard:
 *
 *   <Page>
 *     <PageHeader ... />
 *     <DashboardGrid>
 *       <KPICard ... />
 *       <KPICard ... />
 *     </DashboardGrid>
 *   </Page>
 *
 * AppLayout already provides the outer max-w-1400 container, so Page only
 * controls the vertical rhythm between Header + Body sections.
 */

interface PageProps {
  className?: string;
  children: React.ReactNode;
}
export function Page({ className, children }: PageProps) {
  return (
    <div className={cn("flex flex-col gap-design-lg", className)}>
      {children}
    </div>
  );
}

interface PageBodyProps {
  className?: string;
  children: React.ReactNode;
  /** Tighter vertical rhythm between body sections. */
  dense?: boolean;
}
export function PageBody({ className, children, dense }: PageBodyProps) {
  return (
    <div
      className={cn(
        "flex flex-col",
        dense ? "gap-design-md" : "gap-design-lg",
        className
      )}
    >
      {children}
    </div>
  );
}

interface FormGridProps {
  className?: string;
  children: React.ReactNode;
  /** Column count at lg breakpoint. Mobile is always 1. */
  cols?: 1 | 2 | 3;
}
export function FormGrid({ className, children, cols = 2 }: FormGridProps) {
  const colsCls = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
  }[cols];
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-design-md gap-y-design-sm",
        colsCls,
        className
      )}
    >
      {children}
    </div>
  );
}

interface DashboardGridProps {
  className?: string;
  children: React.ReactNode;
  /** Card count target per row at xl breakpoint. */
  cols?: 2 | 3 | 4 | 6;
}
export function DashboardGrid({
  className,
  children,
  cols = 4,
}: DashboardGridProps) {
  const colsCls = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    6: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
  }[cols];
  return (
    <div className={cn("grid grid-cols-1 gap-design-md", colsCls, className)}>
      {children}
    </div>
  );
}

interface FilterRowProps {
  className?: string;
  children: React.ReactNode;
}
/**
 * FilterRow — horizontal cluster of filter pills + select + search.
 * Replaces ad-hoc `flex gap-2` chains in list pages.
 */
export function FilterRow({ className, children }: FilterRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-design-xs py-design-xs",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardGroupProps {
  className?: string;
  children: React.ReactNode;
}
/**
 * CardGroup — two-up / three-up card cluster used inside sections.
 */
export function CardGroup({ className, children }: CardGroupProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-design-md sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}
