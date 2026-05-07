"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import {
  useExpenseCategories,
  useExpenseTimeline,
} from "@/features/payments";
import {
  ExportMenu,
  IntelligencePanel,
  QuickAddBar,
  StickySummary,
  TimelineList,
} from "@/features/expenses/components";
import type {
  ExpenseCategory,
  ExpenseTimelineResponse,
} from "@/types";

export default function ExpensesPage() {
  const { allowed, checked } = useRequirePermission("payments", "view", "deny");
  const { gymPath } = useGymSlug();
  const { activeBranchId } = useAuthStore();
  const searchParams = useSearchParams();
  const composeMode = searchParams?.get("compose") === "1";

  const { data: categoriesRaw } = useExpenseCategories(activeBranchId ?? undefined);
  const categories = (categoriesRaw as ExpenseCategory[] | undefined) ?? [];

  const { data: timelineRaw, isLoading } = useExpenseTimeline(
    activeBranchId
      ? { branch_id: activeBranchId, limit: 100 }
      : undefined,
  );
  const timeline = timelineRaw as ExpenseTimelineResponse | undefined;
  const groups = timeline?.groups ?? [];

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="payments" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Expenses"
        description="Branch spending timeline with live financial intelligence"
        actions={
          <div className="flex gap-2">
            <Link href={gymPath("/finance/expenses/categories")}>
              <Button variant="outline" className="h-10 gap-2 border-border">
                <Settings className="h-4 w-4" /> Categories
              </Button>
            </Link>
            <ExportMenu
              filters={{ branch_id: activeBranchId ?? undefined }}
            />
          </div>
        }
        className="mb-5"
      />

      {!activeBranchId ? (
        <EmptyState
          title="Pick a branch"
          description="Select a branch from the top bar to view and record expenses."
        />
      ) : (
        <>
          <QuickAddBar
            branchId={activeBranchId}
            categories={categories}
            autoFocus={composeMode}
          />
          <StickySummary branchId={activeBranchId} />
          <IntelligencePanel branchId={activeBranchId} />
          <TimelineList groups={groups} isLoading={isLoading} />
        </>
      )}
    </AppLayout>
  );
}
