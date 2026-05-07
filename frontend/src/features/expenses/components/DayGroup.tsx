"use client";

import { format, parseISO, isToday, isYesterday } from "date-fns";
import { useCurrency } from "@/lib/hooks/use-currency";
import type { ExpenseTimelineGroup } from "@/types";
import { ExpenseRow } from "./ExpenseRow";

interface DayGroupProps {
  group: ExpenseTimelineGroup;
}

function formatDay(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, MMM d");
}

export function DayGroup({ group }: DayGroupProps) {
  const CURRENCY = useCurrency();
  const total = Number(group.total);
  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {formatDay(group.date)}
        </h3>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {CURRENCY}
            {Math.abs(total).toLocaleString("en-IN")}
          </span>
          <span> · {group.count} entries</span>
        </p>
      </header>
      <div className="space-y-2">
        {group.expenses.map((e) => (
          <ExpenseRow key={e.id} expense={e} />
        ))}
      </div>
    </section>
  );
}
