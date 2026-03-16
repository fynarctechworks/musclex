"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Member } from "@/types";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useChurnRisk } from "@/features/members";

type ChurnRisk = "high" | "medium" | "low";

const riskVariant: Record<ChurnRisk, "expired" | "expiring" | "active"> = {
  high: "expired",
  medium: "expiring",
  low: "active",
};

const riskLabels: Record<ChurnRisk, string> = {
  high: "High Risk",
  medium: "Medium Risk",
  low: "Low Risk",
};

const columns: ColumnDef<Member, unknown>[] = [
  {
    accessorKey: "member_code",
    header: "Member ID",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-primary">
        {row.original.member_code}
      </span>
    ),
  },
  {
    accessorKey: "full_name",
    header: "Name",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">
          {row.original.full_name}
        </p>
        {row.original.email && (
          <p className="text-xs text-muted-foreground">
            {row.original.email}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.phone}</span>
    ),
  },
  {
    accessorKey: "branch",
    header: "Branch",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.branch?.name ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "engagement_score",
    header: "Engagement",
    cell: ({ row }) => {
      const score = row.original.engagement_score;
      return (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${score}%`,
                backgroundColor:
                  score >= 70
                    ? "hsl(var(--primary))"
                    : score >= 40
                    ? "#F59E0B"
                    : "#EF4444",
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{score}%</span>
        </div>
      );
    },
  },
  {
    accessorKey: "churn_risk",
    header: "Risk Level",
    cell: ({ row }) => {
      const risk = row.original.churn_risk as ChurnRisk;
      return (
        <StatusBadge variant={riskVariant[risk]} label={riskLabels[risk]} />
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const statusMap: Record<string, "active" | "expiring" | "expired" | "frozen"> = {
        active: "active",
        expiring_soon: "expiring",
        expired: "expired",
        frozen: "frozen",
        inactive: "expired",
      };
      return (
        <StatusBadge
          variant={statusMap[row.original.status] ?? "expired"}
          label={row.original.status.replace("_", " ")}
        />
      );
    },
  },
  {
    accessorKey: "membership",
    header: "Current Plan",
    cell: ({ row }) => {
      const membership = row.original.memberships?.[0];
      return (
        <span className="text-sm text-muted-foreground">
          {membership?.plan?.name ?? "No active plan"}
        </span>
      );
    },
  },
];

export default function ChurnRiskPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const { data: members, isLoading } = useChurnRisk();

  const allMembers = (members ?? []) as Member[];
  const membersList = riskFilter === "all"
    ? allMembers
    : allMembers.filter((m) => m.churn_risk === riskFilter);

  // Summary counts
  const highCount = membersList.filter((m) => m.churn_risk === "high").length;
  const mediumCount = membersList.filter(
    (m) => m.churn_risk === "medium"
  ).length;
  const lowCount = membersList.filter((m) => m.churn_risk === "low").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              Churn Risk Monitor
            </h1>
            <p className="text-sm text-muted-foreground">
              Identify at-risk members and take proactive action
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="High Risk"
            count={highCount}
            color="#EF4444"
            active={riskFilter === "high"}
            onClick={() =>
              setRiskFilter(riskFilter === "high" ? "all" : "high")
            }
          />
          <SummaryCard
            label="Medium Risk"
            count={mediumCount}
            color="#F59E0B"
            active={riskFilter === "medium"}
            onClick={() =>
              setRiskFilter(riskFilter === "medium" ? "all" : "medium")
            }
          />
          <SummaryCard
            label="Low Risk"
            count={lowCount}
            color="hsl(var(--primary))"
            active={riskFilter === "low"}
            onClick={() =>
              setRiskFilter(riskFilter === "low" ? "all" : "low")
            }
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-[180px] bg-secondary border-border text-foreground text-sm">
              <SelectValue placeholder="Filter by risk" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Risk Levels</SelectItem>
              <SelectItem value="high">High Risk</SelectItem>
              <SelectItem value="medium">Medium Risk</SelectItem>
              <SelectItem value="low">Low Risk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : membersList.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No at-risk members"
            description="All your members are engaged and in good standing."
          />
        ) : (
          <DataTable
            columns={columns}
            data={membersList}
            onRowClick={(row) => router.push(gymPath(`/members/${row.id}`))}
          />
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all ${
        active
          ? "border-primary bg-card ring-1 ring-primary/30"
          : "border-border bg-card hover:border-primary/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <p className="text-2xl font-bold text-foreground mt-1">{count}</p>
    </button>
  );
}
