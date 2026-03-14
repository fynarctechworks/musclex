"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  Users,
  Plus,
  Download,
  Search,
  TrendingDown,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
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
import type { Member, Branch, PaginatedResponse } from "@/lib/types";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

type MemberStatus = Member["status"];

const statusToVariant: Record<
  MemberStatus,
  "active" | "expiring" | "expired" | "frozen"
> = {
  active: "active",
  expiring_soon: "expiring",
  expired: "expired",
  frozen: "frozen",
  inactive: "expired",
};

const statusLabels: Record<MemberStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring",
  expired: "Expired",
  frozen: "Frozen",
  inactive: "Inactive",
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
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold">
          {row.original.full_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)}
        </div>
        <span className="font-medium">{row.original.full_name}</span>
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.email || "--"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <StatusBadge
          variant={statusToVariant[status]}
          label={statusLabels[status]}
        />
      );
    },
  },
  {
    accessorKey: "branch.name",
    header: "Branch",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.branch?.name || "--"}
      </span>
    ),
  },
  {
    id: "plan",
    header: "Plan",
    cell: ({ row }) => {
      const activeMembership = row.original.memberships?.find(
        (m) => m.status === "active"
      );
      return (
        <span className="text-muted-foreground">
          {activeMembership?.plan?.name || "--"}
        </span>
      );
    },
  },
];

export default function MembersPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const { data: membersResponse, isLoading } = useQuery({
    queryKey: ["members", search, statusFilter, branchFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);
      if (branchFilter && branchFilter !== "all")
        params.set("branch_id", branchFilter);
      const query = params.toString();
      return apiClient.get<PaginatedResponse<Member>>(
        `/members${query ? `?${query}` : ""}`
      );
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const members = membersResponse?.data ?? [];
  const totalCount = membersResponse?.total ?? 0;

  const handleExportCSV = () => {
    const csvHeaders = [
      "Member ID",
      "Name",
      "Phone",
      "Email",
      "Status",
      "Branch",
    ];
    const csvRows = members.map((m) => [
      m.member_code,
      m.full_name,
      m.phone,
      m.email || "",
      m.status,
      m.branch?.name || "",
    ]);
    const csvContent = [csvHeaders, ...csvRows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `members-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Members</h1>
            <p className="text-sm text-muted-foreground">
              {totalCount} total member{totalCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={gymPath("/members/churn-risk")}>
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <TrendingDown className="mr-2 h-4 w-4" />
                Churn Risk
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={handleExportCSV}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Link href={gymPath("/members/new")}>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 bg-muted border-border pl-9 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem
                value="all"
                className="text-foreground focus:bg-muted"
              >
                All Statuses
              </SelectItem>
              <SelectItem
                value="active"
                className="text-foreground focus:bg-muted"
              >
                Active
              </SelectItem>
              <SelectItem
                value="expiring_soon"
                className="text-foreground focus:bg-muted"
              >
                Expiring
              </SelectItem>
              <SelectItem
                value="expired"
                className="text-foreground focus:bg-muted"
              >
                Expired
              </SelectItem>
              <SelectItem
                value="frozen"
                className="text-foreground focus:bg-muted"
              >
                Frozen
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-sm">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem
                value="all"
                className="text-foreground focus:bg-muted"
              >
                All Branches
              </SelectItem>
              {(branches ?? []).map((branch) => (
                <SelectItem
                  key={branch.id}
                  value={branch.id}
                  className="text-foreground focus:bg-muted"
                >
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members found"
            description="Add your first member to get started, or adjust your search filters."
            action={
              <Link href={gymPath("/members/new")}>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Member
                </Button>
              </Link>
            }
          />
        ) : (
          <DataTable
              columns={columns}
              data={members}
              searchKey="full_name"
              searchPlaceholder="Filter by name..."
              onRowClick={(member) => router.push(gymPath(`/members/${member.id}`))}
            />
        )}
      </div>
    </AppLayout>
  );
}
