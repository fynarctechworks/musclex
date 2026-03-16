"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, TrendingDown, Phone, Mail, MessageSquare } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { KPICard } from "@/components/shared/kpi-card";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAtRiskMembers } from "@/features/visits";
import type { AtRiskMember } from "@/features/visits";

type ChurnRisk = "high" | "medium" | "low";

const riskVariant: Record<ChurnRisk, "expired" | "expiring" | "active"> = {
  high: "expired",
  medium: "expiring",
  low: "active",
};

function getSuggestedAction(risk: ChurnRisk, daysAbsent: number): string {
  if (risk === "high" && daysAbsent > 60) return "Personal call — win back offer";
  if (risk === "high") return "Priority follow-up call";
  if (risk === "medium" && daysAbsent > 30) return "WhatsApp check-in + incentive";
  if (risk === "medium") return "Send motivation message";
  return "Engagement nudge email";
}

function getDaysAbsent(lastVisit: string | null): number {
  if (!lastVisit) return 999;
  return Math.floor((Date.now() - parseISO(lastVisit).getTime()) / (1000 * 60 * 60 * 24));
}

export default function AtRiskMembersPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const [riskFilter, setRiskFilter] = useState<ChurnRisk | "all">("all");

  const { data: members, isLoading } = useAtRiskMembers();

  const allMembers = useMemo(() => (members ?? []) as AtRiskMember[], [members]);

  const filteredMembers = useMemo(() => {
    const list = riskFilter === "all"
      ? allMembers
      : allMembers.filter((m) => m.churn_risk === riskFilter);
    // Sort by engagement_score ascending (worst first)
    return [...list].sort((a, b) => a.engagement_score - b.engagement_score);
  }, [allMembers, riskFilter]);

  const highCount = allMembers.filter((m) => m.churn_risk === "high").length;
  const mediumCount = allMembers.filter((m) => m.churn_risk === "medium").length;
  const avgDaysAbsent = filteredMembers.length > 0
    ? Math.round(filteredMembers.reduce((sum, m) => sum + getDaysAbsent(m.last_visit_at), 0) / filteredMembers.length)
    : 0;

  const columns: ColumnDef<AtRiskMember, unknown>[] = [
    {
      accessorKey: "member_code",
      header: "ID",
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
          <p className="font-medium text-foreground">{row.original.full_name}</p>
          <p className="text-xs text-muted-foreground">{row.original.phone}</p>
        </div>
      ),
    },
    {
      accessorKey: "last_visit_at",
      header: "Last Visit",
      cell: ({ row }) => {
        const lv = row.original.last_visit_at;
        return (
          <span className="text-muted-foreground text-sm">
            {lv ? formatDistanceToNow(parseISO(lv), { addSuffix: true }) : "Never"}
          </span>
        );
      },
    },
    {
      id: "days_absent",
      header: "Days Absent",
      cell: ({ row }) => {
        const days = getDaysAbsent(row.original.last_visit_at);
        return (
          <span className={
            days > 60 ? "text-destructive font-medium" :
            days > 30 ? "text-yellow-500 font-medium" :
            "text-muted-foreground"
          }>
            {days > 900 ? "N/A" : `${days}d`}
          </span>
        );
      },
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
                    score >= 70 ? "hsl(var(--primary))" :
                    score >= 40 ? "#F59E0B" : "#EF4444",
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
      header: "Risk",
      cell: ({ row }) => {
        const risk = row.original.churn_risk as ChurnRisk;
        return (
          <StatusBadge
            variant={riskVariant[risk]}
            label={risk.charAt(0).toUpperCase() + risk.slice(1)}
          />
        );
      },
    },
    {
      id: "action",
      header: "Suggested Action",
      cell: ({ row }) => {
        const risk = row.original.churn_risk as ChurnRisk;
        const days = getDaysAbsent(row.original.last_visit_at);
        const action = getSuggestedAction(risk, days);
        return (
          <div className="flex items-center gap-2">
            {risk === "high" ? (
              <Phone className="h-3.5 w-3.5 text-destructive shrink-0" />
            ) : risk === "medium" ? (
              <MessageSquare className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
            ) : (
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="text-xs text-muted-foreground">{action}</span>
          </div>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="At-Risk Members"
        description="Members showing declining engagement who need attention."
        actions={
          <Link href={gymPath("/members/churn-risk")}>
            <Button variant="outline" size="sm" className="text-xs">
              <TrendingDown className="mr-1.5 h-3.5 w-3.5" />
              Churn Risk Monitor
            </Button>
          </Link>
        }
        className="mb-6"
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard
          label="High Risk"
          value={highCount}
          icon={AlertTriangle}
        />
        <KPICard
          label="Medium Risk"
          value={mediumCount}
          icon={TrendingDown}
        />
        <KPICard
          label="Avg Days Absent"
          value={avgDaysAbsent}
          icon={TrendingDown}
        />
      </div>

      {/* Risk Filter Buttons */}
      <div className="flex gap-2 mb-4">
        {(["all", "high", "medium", "low"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRiskFilter(r)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              riskFilter === r
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {r === "all" ? "All" : `${r.charAt(0).toUpperCase()}${r.slice(1)} Risk`}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : filteredMembers.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No at-risk members"
          description="Great news! All members are actively engaged."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredMembers}
          onRowClick={(row) => router.push(gymPath(`/members/${row.id}`))}
        />
      )}
    </AppLayout>
  );
}
