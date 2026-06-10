"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionItem, ActionKind } from "./action-stack";

const KIND_ICON: Partial<Record<ActionKind, LucideIcon>> = {
  renewal_at_risk: UserCheck,
  renewal_imminent: UserCheck,
  payment_failed: CreditCard,
  dues_overdue: AlertTriangle,
  trainer_no_show: UserMinus,
  class_overfill: Users,
  lead_cold: Sparkles,
  inactive_member: UserMinus,
  branch_underperform: AlertTriangle,
  anomaly_check_ins_low: TrendingDown,
  anomaly_check_ins_high: TrendingUp,
  anomaly_revenue_low: TrendingDown,
  anomaly_revenue_high: TrendingUp,
  info: Sparkles,
};

const SEVERITY_BAR: Record<"high" | "medium" | "low", string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-primary",
};

const SWIPE_THRESHOLD = 80; // px

interface Props {
  item: ActionItem;
}

/**
 * Mobile Action row with swipe-to-act. Drag right to resolve, drag left to
 * snooze 24h, tap the body to follow the CTA. Uses pointer events so it
 * works on touch + mouse + stylus uniformly. Reveals coloured intent
 * surfaces under the row as the user drags so the action is obvious
 * before they release.
 */
export function SwipeableActionRow({ item }: Props) {
  const Icon = KIND_ICON[item.kind] ?? Sparkles;
  const severityBar = SEVERITY_BAR[item.severity];

  const [dx, setDx] = useState(0);
  const [committed, setCommitted] = useState<null | "resolve" | "snooze">(null);
  const [removed, setRemoved] = useState(false);
  const startX = useRef<number | null>(null);
  const containerRef = useRef<HTMLLIElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (committed || removed) return;
    startX.current = e.clientX;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null || committed) return;
    setDx(e.clientX - startX.current);
  };

  const onPointerUp = () => {
    if (startX.current === null) {
      return;
    }
    const move = dx;
    startX.current = null;
    if (Math.abs(move) >= SWIPE_THRESHOLD) {
      const action = move > 0 ? "resolve" : "snooze";
      setCommitted(action);
      // animate off-screen then trigger handler + remove from DOM
      const off = move > 0 ? 1.5 : -1.5;
      setDx(off * (containerRef.current?.clientWidth ?? 320));
      window.setTimeout(() => {
        if (action === "resolve") item.on_resolve?.(item.id);
        else item.on_snooze?.(item.id, 24);
        setRemoved(true);
      }, 180);
    } else {
      setDx(0);
    }
  };

  // Once removed, we collapse the row so the list reflows.
  useEffect(() => {
    if (removed && containerRef.current) {
      containerRef.current.style.height = "0px";
      containerRef.current.style.marginTop = "0px";
      containerRef.current.style.marginBottom = "0px";
    }
  }, [removed]);

  if (removed) return null;

  const intent =
    dx > 20 ? "resolve" : dx < -20 ? "snooze" : null;

  return (
    <li
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-lg transition-[height,margin] duration-fast",
      )}
    >
      {/* Intent backdrop */}
      <div
        className={cn(
          "absolute inset-0 flex items-center px-4 text-[12px] font-medium",
          intent === "resolve"
            ? "justify-start bg-success/15 text-success"
            : intent === "snooze"
              ? "justify-end bg-warning/15 text-warning"
              : "bg-transparent",
        )}
        aria-hidden
      >
        {intent === "resolve" && (
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-4 w-4" /> Resolve
          </span>
        )}
        {intent === "snooze" && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Snooze 24h
          </span>
        )}
      </div>

      {/* Foreground row — slides on drag */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "relative flex items-stretch overflow-hidden rounded-lg border border-border bg-card transition-transform",
          committed && "transition-transform duration-fast ease-out",
        )}
        style={{
          transform: `translateX(${dx}px)`,
          touchAction: "pan-y",
        }}
      >
        <span className={cn("w-1 shrink-0", severityBar)} aria-hidden />
        <div className="flex flex-1 items-center gap-3 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-canvas-soft-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-foreground line-clamp-2">
              {item.title}
            </p>
            {item.reason && (
              <p className="mt-0.5 text-[12px] text-muted-foreground line-clamp-1">
                {item.reason}
              </p>
            )}
          </div>
          {item.impact_amount !== undefined && item.impact_amount > 0 && (
            <span className="shrink-0 text-right">
              <span className="block text-[10px] text-muted-foreground">
                at stake
              </span>
              <span className="block text-[12px] font-semibold tabular-nums text-foreground">
                {item.currency ?? "₹"}
                {item.impact_amount.toLocaleString()}
              </span>
            </span>
          )}
          {item.cta_href && (
            <a
              href={item.cta_href}
              className="shrink-0 rounded-md p-1 text-muted-foreground"
              aria-label="Open"
            >
              <ChevronRight className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
