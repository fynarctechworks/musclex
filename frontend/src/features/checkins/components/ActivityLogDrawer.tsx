"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ScrollText,
  Search,
  QrCode,
  ScanFace,
  Wifi,
  LogIn,
  LogOut,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api-client";
import { useCheckInRealtime } from "../realtime";

interface CheckInRow {
  id: string;
  member_id: string;
  branch_id: string;
  checkin_method: string;
  status: string;
  checked_in_at: string;
  check_out_at?: string | null;
  failure_reason?: string | null;
  member?: {
    full_name?: string;
    member_code?: string;
    profile_photo_url?: string | null;
  };
}

/**
 * ActivityLogDrawer — live drawer of today's check-ins and check-outs.
 *
 * Hooked to the same realtime channel as the kiosk feed so new entries stream
 * in without polling. "View all" deep-links to the full history page for
 * filtering, exports, and date ranges.
 */
export function ActivityLogDrawer({
  open,
  onOpenChange,
  branchId,
  historyHref,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  historyHref: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["check-ins-recent", branchId],
    queryFn: () =>
      apiClient.get<{ data: CheckInRow[] }>("/check-ins", {
        params: { branch_id: branchId, limit: 30 },
      }),
    enabled: open && !!branchId,
    refetchInterval: open ? 30_000 : false,
  });

  const { status: rtStatus } = useCheckInRealtime({
    branchId: branchId || null,
    enabled: open && Boolean(branchId),
  });

  const rows = data?.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-hairline">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            Activity Log
            <RtBadge status={rtStatus} />
          </SheetTitle>
          <SheetDescription className="text-xs">
            Today&apos;s check-ins and check-outs at this branch.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <p className="py-12 text-sm text-muted-foreground text-center">
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <p className="py-12 text-sm text-muted-foreground text-center">
              No activity yet today.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {rows.map((r) => (
                <ActivityRow key={r.id} row={r} />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-hairline px-5 py-3">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={historyHref} onClick={() => onOpenChange(false)}>
              View all
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActivityRow({ row }: { row: CheckInRow }) {
  const isCheckedOut = !!row.check_out_at;
  const isFailure = row.status !== "success";
  const time = new Date(isCheckedOut ? row.check_out_at! : row.checked_in_at);
  const Icon = isFailure ? XCircle : isCheckedOut ? LogOut : CheckCircle2;
  const iconColor = isFailure
    ? "text-error"
    : isCheckedOut
      ? "text-link"
      : "text-success";

  return (
    <li className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-canvas-soft/60 transition-colors">
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {row.member?.full_name ?? "Unknown"}
          </p>
          <MethodChip method={row.checkin_method} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>
            {isFailure
              ? `Denied · ${row.failure_reason ?? "unknown"}`
              : isCheckedOut
                ? "Checked out"
                : "Checked in"}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {formatDistanceToNow(time, { addSuffix: true })}
          </span>
        </div>
      </div>
    </li>
  );
}

function MethodChip({ method }: { method: string }) {
  const map: Record<string, { icon: React.ElementType; label: string }> = {
    manual: { icon: Search, label: "Manual" },
    qr: { icon: QrCode, label: "QR" },
    facial: { icon: ScanFace, label: "Face" },
    rfid: { icon: Wifi, label: "RFID" },
    kiosk: { icon: LogIn, label: "Kiosk" },
  };
  const m = map[method] ?? { icon: Search, label: method };
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-hairline bg-canvas-soft px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

function RtBadge({ status }: { status: string }) {
  const live = status === "connected";
  return (
    <span className="ml-auto flex items-center gap-1.5 text-[10px] font-normal text-muted-foreground">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          live ? "bg-success animate-pulse" : "bg-hairline-strong"
        }`}
      />
      {live ? "Live" : "Idle"}
    </span>
  );
}
