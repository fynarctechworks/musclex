"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { queryKeys } from "@/services/query-client";
import { apiClient } from "@/services/api-client";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import type { Branch } from "@/types";
import { useMembershipPlan, useUpdatePlan, PlanForm } from "@/features/memberships";

export default function EditPlanPage() {
  const { allowed, checked } = useRequirePermission("members", "edit", "deny");
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const params = useParams<{ planId: string }>();
  const planId = params.planId;

  const { data: plan, isLoading } = useMembershipPlan(planId);
  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const updateMutation = useUpdatePlan(planId);

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="members" />
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl space-y-6">
          <LoadingSkeleton className="h-8 w-48" />
          <LoadingSkeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title={`Edit Plan — ${plan?.name ?? ""}`} />
        <PlanForm
          defaultValues={plan ?? undefined}
          branches={branches}
          onSubmit={(data) => {
            const cleaned = {
              ...data,
              duration_days: data.duration_days ? Number(data.duration_days) : undefined,
              total_classes: data.total_classes ? Number(data.total_classes) : undefined,
              max_classes_per_week: data.max_classes_per_week ? Number(data.max_classes_per_week) : undefined,
              max_visits: data.max_visits ? Number(data.max_visits) : undefined,
              grace_period_days: data.grace_period_days ? Number(data.grace_period_days) : undefined,
              branch_id: data.branch_id || undefined,
            };
            updateMutation.mutate(cleaned as Parameters<typeof updateMutation.mutate>[0], {
              onSuccess: () => router.push(gymPath("/memberships/plans")),
            });
          }}
          onCancel={() => router.push(gymPath("/memberships/plans"))}
          isSubmitting={updateMutation.isPending}
        />
      </div>
    </AppLayout>
  );
}
