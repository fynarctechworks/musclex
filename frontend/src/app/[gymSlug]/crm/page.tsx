"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/services/query-client";
import { useAuthStore } from "@/stores/auth-store";
import { ColumnDef } from "@tanstack/react-table";
import {
  BookUser,
  Mail,
  Phone,
  TrendingUp,
  TrendingDown,
  Users,
  UserCheck,
  AlertTriangle,
  Search,
  Filter,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CrmMember {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  member_code: string;
  status: string;
  churn_risk: string;
  engagement_score: number;
  join_date: string;
  created_at: string;
  branch?: { name: string };
  memberships?: { status: string; plan: { name: string }; end_date?: string }[];
  _count?: { check_ins: number; payments: number };
}

const statusVariant: Record<string, string> = {
  active: "active",
  expired: "expired",
  frozen: "frozen",
  inactive: "inactive",
};

export default function CrmPage() {
  const { allowed, checked } = useRequirePermission("members", "view", "deny");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const user = useAuthStore((s) => s.user);

  // Debounce search input by 400ms to avoid API call on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: [
      ...queryKeys.members.list(),
      { search: debouncedSearch, status: statusFilter, churn_risk: riskFilter, limit: 200 },
    ],
    queryFn: () =>
      apiClient.get<{ data: CrmMember[]; total: number }>("/members", {
        params: {
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          churn_risk: riskFilter || undefined,
          limit: 200,
        },
      }),
  });

  const members = data?.data ?? [];
  const total = data?.total ?? 0;

  // Quick stats
  const activeCount = members.filter((m) => m.status === "active").length;
  const atRiskCount = members.filter((m) => m.churn_risk === "high").length;
  const avgEngagement =
    members.length > 0
      ? Math.round(members.reduce((s, m) => s + (m.engagement_score || 0), 0) / members.length)
      : 0;

  const columns: ColumnDef<CrmMember>[] = [
    {
      header: "Customer",
      accessorKey: "full_name",
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div>
            <p className="font-medium text-foreground">{m.full_name}</p>
            <p className="text-xs text-muted-foreground">{m.member_code}</p>
          </div>
        );
      },
    },
    {
      header: "Contact",
      id: "contact",
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="text-sm space-y-0.5">
            {m.phone && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3 h-3" /> {m.phone}
              </span>
            )}
            {m.email && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="w-3 h-3" /> {m.email}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Plan",
      id: "plan",
      cell: ({ row }) => {
        const m = row.original;
        const active = m.memberships?.find((ms) => ms.status === "active");
        return active ? (
          <div>
            <p className="text-sm text-foreground">{active.plan?.name}</p>
            {active.end_date && (
              <p className="text-xs text-muted-foreground">
                Expires {formatDistanceToNow(new Date(active.end_date), { addSuffix: true })}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No active plan</span>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge status={statusVariant[row.original.status] || row.original.status} />
      ),
    },
    {
      header: "Engagement",
      accessorKey: "engagement_score",
      cell: ({ row }) => {
        const score = row.original.engagement_score ?? 0;
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, score)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{score}%</span>
          </div>
        );
      },
    },
    {
      header: "Churn Risk",
      accessorKey: "churn_risk",
      cell: ({ row }) => {
        const risk = row.original.churn_risk;
        return (
          <StatusBadge
            status={risk === "low" ? "active" : risk === "medium" ? "expiring" : "expired"}
            label={risk ? risk.charAt(0).toUpperCase() + risk.slice(1) : "—"}
          />
        );
      },
    },
    {
      header: "Branch",
      id: "branch",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.branch?.name ?? "—"}
        </span>
      ),
    },
    {
      header: "Joined",
      accessorKey: "created_at",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.created_at
            ? format(new Date(row.original.created_at), "MMM dd, yyyy")
            : "—"}
        </span>
      ),
    },
  ];

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="members" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="CRM"
        description="Customer relationship management — all members at a glance"
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs">Total Customers</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{total}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <UserCheck className="w-4 h-4 text-green-500" />
            <span className="text-xs">Active</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs">High Churn Risk</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{atRiskCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs">Avg Engagement</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{avgEngagement}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, email, or GYM ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-card border-border"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="frozen">Frozen</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
        >
          <option value="">All Risk Levels</option>
          <option value="low">Low Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="high">High Risk</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          title="No customers found"
          description="Adjust your filters or add new members"
          icon={BookUser}
        />
      ) : (
        <DataTable columns={columns} data={members} />
      )}
    </AppLayout>
  );
}
