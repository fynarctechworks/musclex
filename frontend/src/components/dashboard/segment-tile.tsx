"use client";

import { useState } from "react";
import { type LucideIcon, Users, ArrowRight } from "lucide-react";
import { LoadingSkeleton } from "@/components/shared";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Segment, SegmentMemberSample } from "@/types";

export interface SegmentTileProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** "good" surfaces success accents; "bad" surfaces destructive accents. */
  tone?: "neutral" | "good" | "bad";
  segment?: Segment;
  isLoading?: boolean;
  className?: string;
  currency?: string;
}

/**
 * Wave 11 — Segment summary tile.
 *
 * Visual contract: count + revenue-at-risk (if present) + a small "View members"
 * affordance. The list of sample members is intentionally NOT rendered inline —
 * those rows used to consume ~280px of vertical space across 6 tiles, which the
 * operator's eye couldn't scan at-a-glance. Clicking the tile (or the View
 * members link) opens a modal with the same data.
 */
export function SegmentTile({
  title,
  description,
  icon: Icon = Users,
  tone = "neutral",
  segment,
  isLoading,
  className,
  currency = "₹",
}: SegmentTileProps) {
  const [open, setOpen] = useState(false);

  const accentClass =
    tone === "good"
      ? "bg-success/10 text-success"
      : tone === "bad"
        ? "bg-destructive/10 text-destructive"
        : "bg-canvas-soft-2 text-primary";

  const hasMembers = !!segment && segment.count > 0;
  const hasSamples = !!segment && segment.sample.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => hasSamples && setOpen(true)}
        disabled={!hasSamples}
        aria-label={hasSamples ? `View ${segment?.count} ${title}` : title}
        className={cn(
          "group flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-5 text-left shadow-level-2 transition-all",
          hasSamples && "cursor-pointer hover:border-border/80 hover:shadow-level-3",
          !hasSamples && "cursor-default",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                accentClass,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-tight text-foreground truncate">
                {title}
              </h3>
              {description && (
                <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          {isLoading || !segment ? (
            <LoadingSkeleton className="h-9 w-24" />
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tabular-nums text-foreground">
                {segment.count.toLocaleString()}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {segment.count === 1 ? "member" : "members"}
              </span>
            </div>
          )}

          {hasSamples && (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              View members <ArrowRight className="h-3 w-3" />
            </span>
          )}
        </div>

        {segment?.members_at_risk_amount !== undefined &&
          segment.members_at_risk_amount > 0 && (
            <p className="text-[12px] font-medium text-destructive">
              {currency}
              {segment.members_at_risk_amount.toLocaleString()} at risk
            </p>
          )}

        {!isLoading && segment && !hasMembers && (
          <p className="text-[12px] text-muted-foreground">
            No members match yet
          </p>
        )}
      </button>

      <SegmentMembersDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        members={segment?.sample ?? []}
        totalCount={segment?.count ?? 0}
      />
    </>
  );
}

interface SegmentMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  members: SegmentMemberSample[];
  totalCount: number;
}

function SegmentMembersDialog({
  open,
  onOpenChange,
  title,
  description,
  members,
  totalCount,
}: SegmentMembersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="mt-2 -mx-1 max-h-[60vh] overflow-y-auto px-1">
          {members.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No members to show in this segment yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photo_url}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[12px] font-medium text-muted-foreground">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-foreground">
                      {m.name}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {m.signal}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {totalCount > members.length && (
          <p className="mt-2 text-[11px] text-muted-foreground text-center">
            Showing {members.length} of {totalCount.toLocaleString()} ·
            <span className="ml-1">View the rest in the Members module</span>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
