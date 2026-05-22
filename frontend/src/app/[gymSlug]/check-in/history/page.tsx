"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Clock, Calendar, CheckCircle2, XCircle, AlertCircle, QrCode, ScanFace, Search, Wifi } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api";
import type { CheckIn, Branch, PaginatedResponse } from "@/lib/types";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import { lookupDenial } from "@/features/checkins/denial-catalog";

const methodLabels: Record<string, string> = {
  manual: "Manual",
  qr: "QR Code",
  facial: "Face ID",
  rfid: "RFID",
};

const methodIcons: Record<string, React.ReactNode> = {
  manual: <Search className="h-3.5 w-3.5" aria-hidden="true" />,
  qr: <QrCode className="h-3.5 w-3.5" aria-hidden="true" />,
  facial: <ScanFace className="h-3.5 w-3.5" aria-hidden="true" />,
  rfid: <Wifi className="h-3.5 w-3.5" aria-hidden="true" />,
};

const columns: ColumnDef<CheckIn, unknown>[] = [
  {
    accessorKey: "checked_in_at",
    header: "Date & Time",
    cell: ({ row }) => (
      <span className="text-body-sm text-foreground tabular-nums">
        {format(new Date(row.original.checked_in_at), "MMM d, yyyy h:mm a")}
      </span>
    ),
  },
  {
    accessorKey: "member",
    header: "Member",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">
          {row.original.member?.full_name ?? "Unknown"}
        </p>
        <p className="text-body-sm text-muted-foreground font-mono">
          {row.original.member?.member_code ?? '—'}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "checkin_method",
    header: "Method",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground">
        {methodIcons[row.original.checkin_method] ?? null}
        {methodLabels[row.original.checkin_method] ?? row.original.checkin_method}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Outcome",
    cell: ({ row }) => <OutcomePill status={row.original.status} />,
  },
  {
    accessorKey: "failure_reason",
    header: "Reason",
    cell: ({ row }) => {
      if (!row.original.failure_reason) return <span className="text-body-sm text-muted-foreground">—</span>;
      const entry = lookupDenial(row.original.failure_reason);
      return (
        <div className="flex items-center gap-2">
          <span className="text-body-sm text-foreground">{entry.title}</span>
          <span className="rounded-md bg-canvas-soft px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {row.original.failure_reason}
          </span>
        </div>
      );
    },
  },
];

function OutcomePill({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-body-sm text-success">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Success
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-body-sm text-warning">
        <AlertCircle className="h-3 w-3" aria-hidden="true" /> Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-error/15 px-2 py-0.5 text-body-sm text-error">
      <XCircle className="h-3 w-3" aria-hidden="true" /> Denied
    </span>
  );
}

export default function CheckInHistoryPage() {
  const { allowed, checked } = useRequirePermission("check_ins", "view", "deny");
  const { gymPath } = useGymSlug();
  const { activeBranchId } = useAuthStore();
  const [branchFilter, setBranchFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const effectiveBranch = branchFilter !== "all" ? branchFilter : activeBranchId || "";

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const { data: checkInsResponse, isLoading } = useQuery({
    queryKey: ["check-in-history", effectiveBranch, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (effectiveBranch) params.set("branch_id", effectiveBranch);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      return apiClient.get<PaginatedResponse<CheckIn>>(
        `/check-ins?${params.toString()}`
      );
    },
  });

  const checkIns = checkInsResponse?.data ?? [];

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="check_ins" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header — uses display-xs + body-sm to match the rest of the module */}
        <div className="flex items-center gap-4">
          <Link href={gymPath("/check-in")}>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-display-xs font-semibold tracking-[-0.01em] text-foreground">
              Check-in History
            </h1>
            <p className="text-body-sm text-muted-foreground">
              {checkInsResponse?.total ?? 0} total check-ins
            </p>
          </div>
        </div>

        {/* Filters — bg-card + border-hairline to match the design system */}
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4 sm:flex-row sm:items-center">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[200px] bg-canvas-soft border-hairline text-foreground text-body-sm">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {(branches ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px] bg-canvas-soft border-hairline text-foreground text-body-sm h-9"
              aria-label="Filter from date"
            />
            <span className="text-body-sm text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px] bg-canvas-soft border-hairline text-foreground text-body-sm h-9"
              aria-label="Filter to date"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : checkIns.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No check-ins found"
            description="Adjust your filters or check in your first member."
          />
        ) : (
          <DataTable columns={columns} data={checkIns} />
        )}
      </div>
    </AppLayout>
  );
}
