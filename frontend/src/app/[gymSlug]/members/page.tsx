"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  Users,
  Plus,
  Download,
  Search,
  TrendingDown,
  ChevronDown,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/services/api-client";
import type { Member, Branch } from "@/types";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useMembers } from "@/features/members";
import { useAllTags } from "@/features/tags";
import { queryKeys } from "@/services/query-client";
import { AssignMembershipDialog, useMembershipPlans } from "@/features/memberships";
import { toast } from "sonner";

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

export default function MembersPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const filters = {
    search: debouncedSearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    branch_id: branchFilter !== "all" ? branchFilter : undefined,
    tag_id: tagFilter !== "all" ? tagFilter : undefined,
    plan_id: planFilter !== "all" ? planFilter : undefined,
  };

  const { data: membersResponse, isLoading } = useMembers(filters);

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const { data: allTags } = useAllTags();
  const { data: plansData } = useMembershipPlans();

  const members = membersResponse?.data ?? [];
  const totalCount = membersResponse?.total ?? 0;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map((m) => m.id)));
    }
  };

  const selectedMembers = members.filter((m) => selectedIds.has(m.id));

  const columns: ColumnDef<Member, unknown>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={members.length > 0 && selectedIds.size === members.length}
          onCheckedChange={() => toggleAll()}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={() => {
            toggleSelected(row.original.id);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.original.full_name}`}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "member_code",
      header: "Member ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-primary">{row.original.member_code}</span>
      ),
    },
    {
      accessorKey: "full_name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold">
            {row.original.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <span className="font-medium">{row.original.full_name}</span>
        </div>
      ),
    },
    { accessorKey: "phone", header: "Phone" },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.email || "--"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge variant={statusToVariant[row.original.status]} label={statusLabels[row.original.status]} />
      ),
    },
    {
      accessorKey: "branch.name",
      header: "Branch",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.branch?.name || "--"}</span>,
    },
    {
      id: "plan",
      header: "Plan",
      cell: ({ row }) => {
        const active = row.original.memberships?.find((m) => m.status === "active");
        return <span className="text-muted-foreground">{active?.plan?.name || "--"}</span>;
      },
    },
  ];

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
        <PageHeader
          title="Members"
          description={`${totalCount} total member${totalCount !== 1 ? "s" : ""}`}
          actions={
            <>
              <Link href={gymPath("/members/churn-risk")}>
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted">
                  <TrendingDown className="mr-2 h-4 w-4" /> Churn Risk
                </Button>
              </Link>
              <Button variant="ghost" onClick={handleExportCSV} className="text-muted-foreground hover:text-foreground hover:bg-muted">
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Link href={gymPath("/members/new")}>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" /> Add Member
                </Button>
              </Link>
            </>
          }
        />

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
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-sm">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem
                value="all"
                className="text-foreground focus:bg-muted"
              >
                All Tags
              </SelectItem>
              {(allTags ?? []).map((tag) => (
                <SelectItem
                  key={tag.id}
                  value={tag.id}
                  className="text-foreground focus:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tag.color || '#4A9FD4' }}
                    />
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-sm">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem
                value="all"
                className="text-foreground focus:bg-muted"
              >
                All Plans
              </SelectItem>
              {(plansData ?? []).map((plan) => (
                <SelectItem
                  key={plan.id}
                  value={plan.id}
                  className="text-foreground focus:bg-muted"
                >
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} selected
            </span>
            <div className="h-4 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="text-sm">
                  Bulk Actions <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onClick={() => setAssignDialogOpen(true)}>
                  Assign Membership
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Send renewal reminders — coming soon")}>
                  Send Renewal Reminder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" className="ml-auto text-xs text-muted-foreground" onClick={() => setSelectedIds(new Set())}>
              Clear Selection
            </Button>
          </div>
        )}

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

      {/* Bulk Assign Membership Dialog — assigns to first selected member */}
      {selectedMembers.length > 0 && (
        <AssignMembershipDialog
          memberId={selectedMembers[0].id}
          memberName={selectedMembers.length === 1 ? selectedMembers[0].full_name : `${selectedMembers.length} members`}
          defaultBranchId={selectedMembers[0].branch_id}
          open={assignDialogOpen}
          onClose={() => {
            setAssignDialogOpen(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </AppLayout>
  );
}
