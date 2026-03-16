"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Copy, Archive } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MembershipPlan } from "@/types";

interface PlanTableProps {
  plans: (MembershipPlan & { _count?: { memberships: number } })[];
  onEdit: (plan: MembershipPlan) => void;
  onDuplicate: (plan: MembershipPlan) => void;
  onArchive: (plan: MembershipPlan) => void;
}

const billingCycleLabel: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half Yearly",
  yearly: "Yearly",
  class_pack: "Class Pack",
  custom: "Custom",
  day_pass: "Day Pass",
  corporate: "Corporate",
  family: "Family",
  global_access: "Global Access",
};

export function PlanTable({ plans, onEdit, onDuplicate, onArchive }: PlanTableProps) {
  const columns: ColumnDef<MembershipPlan & { _count?: { memberships: number } }, unknown>[] = [
    {
      accessorKey: "name",
      header: "Plan Name",
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.currency === "USD" ? "$" : "₹"}
          {Number(row.original.price).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "plan_type",
      header: "Billing Cycle",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {billingCycleLabel[row.original.plan_type] ?? row.original.plan_type}
        </span>
      ),
    },
    {
      id: "visit_limit",
      header: "Visit Limit",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.max_visits ?? "Unlimited"}
        </span>
      ),
    },
    {
      id: "branch",
      header: "Branch",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.branch?.name ?? (row.original.multi_branch_access ? "All" : "--")}
        </span>
      ),
    },
    {
      id: "active_members",
      header: "Active Members",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original._count?.memberships ?? 0}
        </span>
      ),
    },
    {
      accessorKey: "auto_renew_enabled",
      header: "Auto Renew",
      cell: ({ row }) => (
        <span className={row.original.auto_renew_enabled ? "text-primary" : "text-muted-foreground"}>
          {row.original.auto_renew_enabled ? "Yes" : "No"}
        </span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          variant={row.original.is_active ? "active" : "inactive"}
          label={row.original.is_active ? "Active" : "Archived"}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(row.original)}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive(row.original)}>
              <Archive className="mr-2 h-3.5 w-3.5" />
              {row.original.is_active ? "Archive" : "Restore"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={plans}
      searchKey="name"
      searchPlaceholder="Filter plans..."
    />
  );
}
