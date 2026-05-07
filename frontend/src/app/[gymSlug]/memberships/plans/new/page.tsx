"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { PageHeader } from "@/components/shared/page-header";
import { queryKeys } from "@/services/query-client";
import { apiClient } from "@/services/api-client";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import type { Branch } from "@/types";
import { useCreatePlan, PlanForm } from "@/features/memberships";

export default function CreatePlanPage() {
  const { allowed, checked } = useRequirePermission("members", "create", "deny");
  const { gymPath } = useGymSlug();
  const router = useRouter();

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const createMutation = useCreatePlan();

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="members" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title="Create Membership Plan" />
        <PlanForm
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
            createMutation.mutate(cleaned as Parameters<typeof createMutation.mutate>[0], {
              onSuccess: () => router.push(gymPath("/memberships/plans")),
            });
          }}
          onCancel={() => router.push(gymPath("/memberships/plans"))}
          isSubmitting={createMutation.isPending}
        />
      </div>
    </AppLayout>
  );
}
