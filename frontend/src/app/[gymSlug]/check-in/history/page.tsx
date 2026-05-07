"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
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

const methodLabels: Record<string, string> = {
  manual: "Manual",
  qr: "QR Code",
  facial: "Facial",
  rfid: "RFID",
};

const columns: ColumnDef<CheckIn, unknown>[] = [
  {
    accessorKey: "checked_in_at",
    header: "Date & Time",
    cell: ({ row }) => (
      <span className="text-sm text-foreground">
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
        <p className="text-xs text-muted-foreground font-mono">
          {row.original.member?.member_code}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "checkin_method",
    header: "Method",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground capitalize">
        {methodLabels[row.original.checkin_method] ??
          row.original.checkin_method}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        variant={
          row.original.status === "success"
            ? "active"
            : row.original.status === "pending"
            ? "expiring"
            : "expired"
        }
        label={row.original.status}
      />
    ),
  },
  {
    accessorKey: "failure_reason",
    header: "Details",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.failure_reason ?? "—"}
      </span>
    ),
  },
];

export default function CheckInHistoryPage() {
  const { allowed, checked } = useRequirePermission("check_ins", "view", "deny");
  const { gymPath } = useGymSlug();
  const { activeBranchId } = useAuthStore();
  const [branchFilter, setBranchFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Branch: use local filter override, then nav selector
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
        {/* Header */}
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
            <h1 className="text-xl font-semibold text-foreground">
              Check-in History
            </h1>
            <p className="text-sm text-muted-foreground">
              {checkInsResponse?.total ?? 0} total check-ins
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[200px] bg-secondary border-border text-foreground text-sm">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Branches</SelectItem>
              {(branches ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px] bg-secondary border-border text-foreground text-sm h-9"
              placeholder="From"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px] bg-secondary border-border text-foreground text-sm h-9"
              placeholder="To"
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
