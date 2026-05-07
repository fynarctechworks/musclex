"use client";

// FIXME: Wave 8 will replace with shared <TileCard>

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/services/query-client";
import { TodaysClass } from "@/types";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { cn } from "@/lib/utils";

interface TodaysClassesTileProps {
  branchId?: string;
}

function formatTimeChip(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function fillBarTone(pct: number): string {
  if (pct >= 100) return "bg-destructive";
  if (pct >= 85) return "bg-amber-500";
  if (pct >= 60) return "bg-primary";
  return "bg-emerald-500";
}

function statusPill(status: TodaysClass["status"]): {
  label: string;
  cls: string;
} {
  switch (status) {
    case "in_progress":
      return {
        label: "Live",
        cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
      };
    case "completed":
      return {
        label: "Done",
        cls: "bg-muted/40 text-muted-foreground border-border",
      };
    default:
      return {
        label: "Upcoming",
        cls: "bg-primary/10 text-primary border-primary/30",
      };
  }
}

export function TodaysClassesTile({ branchId }: TodaysClassesTileProps) {
  const { gymPath } = useGymSlug();

  const { data, isLoading, isError } = useQuery<TodaysClass[]>({
    queryKey: queryKeys.dashboard.todaysClasses(branchId),
    queryFn: () =>
      apiClient.get<TodaysClass[]>(
        `/dashboard/today-classes${branchId ? `?branch_id=${branchId}` : ""}`,
      ),
    refetchInterval: 60_000,
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          Today&apos;s Classes
        </h2>
        <Link
          href={gymPath("/schedule")}
          className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1"
        >
          View all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Could not load classes.
        </div>
      ) : !data || data.length === 0 ? (
        <div className="py-8 text-center">
          <CalendarDays className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-[13px] text-muted-foreground">
            No classes scheduled today.
          </p>
        </div>
      ) : (
        <ul className="space-y-1">
          {data.map((c) => {
            const pill = statusPill(c.status);
            const tone = fillBarTone(c.fill_pct);
            return (
              <li key={c.id}>
                <Link
                  href={gymPath(`/classes/${c.id}`)}
                  className={cn(
                    "flex items-center gap-3 py-2 px-2 rounded-lg",
                    "hover:bg-accent/40 transition-colors",
                  )}
                >
                  <span className="text-[12px] font-medium tabular-nums text-foreground bg-muted/50 border border-border rounded-md px-2 py-0.5 whitespace-nowrap">
                    {formatTimeChip(c.start_time)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {c.name}
                      </p>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full border",
                          pill.cls,
                        )}
                      >
                        {pill.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.trainer_name ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="w-28 shrink-0">
                    <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground mb-1">
                      <span className="tabular-nums">
                        <span className="text-foreground font-medium">
                          {c.booked}
                        </span>
                        /{c.capacity || "—"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", tone)}
                        style={{ width: `${Math.min(100, c.fill_pct)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
