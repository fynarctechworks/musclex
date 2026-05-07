"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DashboardBriefing {
  date: string;
  headline: string | null;
  summary: string;
  recommendations: Array<{
    title: string;
    why: string;
    action_id?: string | null;
  }>;
  metrics: Record<string, unknown>;
  generated_at: string;
  model: string | null;
}

interface BriefingCardProps {
  branchId?: string;
  className?: string;
}

/**
 * Daily AI Briefing — compact pill button on the dashboard. Click opens a
 * modal with the full headline, summary, and recommendations.
 */
export function BriefingCard({ branchId, className }: BriefingCardProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const params = branchId ? { branch_id: branchId } : undefined;

  const { data, isLoading } = useQuery<DashboardBriefing>({
    queryKey: ["dashboard", "briefing", branchId],
    queryFn: () => apiClient.get("/dashboard/briefing", { params }),
    staleTime: 5 * 60_000,
  });

  const regenerate = useMutation({
    mutationFn: () =>
      apiClient.post("/dashboard/briefing/regenerate", {
        branch_id: branchId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "briefing", branchId] });
    },
  });

  if (isLoading) {
    return (
      <div className={cn("mb-6 h-9 w-44 animate-pulse rounded-full bg-muted/50", className)} />
    );
  }
  if (!data || (!data.summary && !data.headline)) return null;

  const ageMin = Math.max(
    0,
    Math.round((Date.now() - new Date(data.generated_at).getTime()) / 60000),
  );
  const ageLabel = ageMin < 60 ? `${ageMin}m ago` : `${Math.round(ageMin / 60)}h ago`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:border-primary/40 hover:from-primary/15",
          className,
        )}
        aria-label="Open today's AI briefing"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-primary font-semibold uppercase tracking-wide text-[11px]">
          AI briefing
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="max-w-[260px] truncate text-foreground/80">
          {data.headline || data.summary}
        </span>
        <span className="text-muted-foreground/70 text-[11px]">· {ageLabel}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-[15px]">Today&apos;s AI briefing</DialogTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Generated {ageLabel}
                    {data.model === null && (
                      <span className="ml-1 uppercase tracking-wide text-amber-500">
                        · fallback
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => regenerate.mutate()}
                disabled={regenerate.isPending}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                aria-label="Regenerate briefing"
                title="Regenerate"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", regenerate.isPending && "animate-spin")}
                />
              </button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {data.headline && (
              <h3 className="text-[16px] font-semibold leading-snug text-foreground">
                {data.headline}
              </h3>
            )}
            <p className="text-[13px] leading-relaxed text-foreground/90">
              {data.summary}
            </p>

            {data.recommendations.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recommendations
                </p>
                <ul className="space-y-2">
                  {data.recommendations.map((r, i) => (
                    <li
                      key={r.action_id ?? i}
                      className="rounded-md border border-border/60 bg-background/40 px-3 py-2"
                    >
                      <p className="text-[13px] font-medium text-foreground">{r.title}</p>
                      {r.why && (
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{r.why}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
