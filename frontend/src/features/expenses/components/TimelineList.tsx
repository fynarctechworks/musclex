"use client";

import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import type { ExpenseTimelineGroup } from "@/types";
import { DayGroup } from "./DayGroup";

interface TimelineListProps {
  groups: ExpenseTimelineGroup[];
  isLoading?: boolean;
  emptyHint?: string;
}

export function TimelineList({
  groups,
  isLoading,
  emptyHint,
}: TimelineListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <LoadingSkeleton className="h-14" />
        <LoadingSkeleton className="h-14" />
        <LoadingSkeleton className="h-14" />
      </div>
    );
  }
  if (!groups || groups.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No expenses yet"
        description={emptyHint ?? "Use the quick-add bar to log your first expense."}
      />
    );
  }
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <DayGroup key={g.date} group={g} />
      ))}
    </div>
  );
}
