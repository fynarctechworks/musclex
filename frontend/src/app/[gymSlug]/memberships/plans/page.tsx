"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, CreditCard } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/services/api-client";
import { queryKeys } from "@/services/query-client";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import type { Branch, MembershipPlan } from "@/types";
import Link from "next/link";
import {
  useMembershipPlans,
  useDuplicatePlan,
  PlanTable,
} from "@/features/memberships";

export default function MembershipPlansPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();

  const [branchFilter, setBranchFilter] = useState("all");
  const [cycleFilter, setCycleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [archivePlan, setArchivePlan] = useState<MembershipPlan | null>(null);

  const filters = {
    branch_id: branchFilter !== "all" ? branchFilter : undefined,
    plan_type: cycleFilter !== "all" ? cycleFilter : undefined,
    is_active: statusFilter !== "all" ? statusFilter : undefined,
  };

  const { data: plans, isLoading } = useMembershipPlans(filters);
  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const duplicateMutation = useDuplicatePlan();

  // For archive toggle we use updatePlan with inline id
  const handleArchiveConfirm = () => {
    if (!archivePlan) return;
    const id = archivePlan.id;
    const toggleActive = !archivePlan.is_active;
    // Use direct API call since useUpdatePlan needs id at hook level
    apiClient
      .patch(`/membership-plans/${id}`, { is_active: toggleActive })
      .then(() => {
        // Invalidate done by re-fetch
        window.location.reload();
      });
    setArchivePlan(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Membership Plans"
          description={`${plans?.length ?? 0} plan${(plans?.length ?? 0) !== 1 ? "s" : ""}`}
          actions={
            <Link href={gymPath("/memberships/plans/new")}>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" /> Create Plan
              </Button>
            </Link>
          }
        />

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-sm">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Branches</SelectItem>
              {(branches ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={cycleFilter} onValueChange={setCycleFilter}>
            <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-sm">
              <SelectValue placeholder="Cycle" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Cycles</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="half_yearly">Half Yearly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="class_pack">Class Pack</SelectItem>
              <SelectItem value="day_pass">Day Pass</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : !plans || plans.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No plans found"
            description="Create your first membership plan to start enrolling members."
            action={
              <Link href={gymPath("/memberships/plans/new")}>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" /> Create Plan
                </Button>
              </Link>
            }
          />
        ) : (
          <PlanTable
            plans={plans}
            onEdit={(plan) => router.push(gymPath(`/memberships/plans/${plan.id}/edit`))}
            onDuplicate={(plan) => duplicateMutation.mutate(plan.id)}
            onArchive={(plan) => setArchivePlan(plan)}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!archivePlan}
        onOpenChange={(open) => !open && setArchivePlan(null)}
        title={archivePlan?.is_active ? "Archive Plan" : "Restore Plan"}
        description={
          archivePlan?.is_active
            ? `Archive "${archivePlan.name}"? Members on this plan won't be affected, but no new enrollments will be allowed.`
            : `Restore "${archivePlan?.name}"? New members will be able to enroll in this plan.`
        }
        confirmLabel={archivePlan?.is_active ? "Archive" : "Restore"}
        variant={archivePlan?.is_active ? "danger" : "default"}
        onConfirm={handleArchiveConfirm}
      />
    </AppLayout>
  );
}
