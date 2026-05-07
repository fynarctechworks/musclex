"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { Activity, Clock, CreditCard, StickyNote, CreditCard as MembershipIcon, BarChart3, TrendingUp, FileText, UserPlus } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CheckIn, Payment } from "@/types";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import {
  useMember,
  useUnfreezeMember,
  useDeactivateMember,
  useActivateMember,
} from "@/features/members";
import {
  MemberHeader,
  MemberActions,
  MemberOverview,
  MemberAttendance,
  MemberPayments,
  MemberNotes,
  FreezeDialog,
  RenewDialog,
  MemberMembershipsTab,
  MembershipAnalytics,
  MemberVisitsTab,
  MemberProgressTab,
  MemberDocumentsTab,
} from "./components";
import { MemberReferralsTab } from "@/features/referrals";
import { MemberSubscriptionCard } from "@/features/memberships";

export default function MemberProfilePage() {
  const { allowed, checked } = useRequirePermission("members", "view", "deny");
  const { gymPath } = useGymSlug();
  const params = useParams<{ id: string }>();
  const memberId = params.id;

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [unfreezeOpen, setUnfreezeOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);

  const { data: member, isLoading, isError } = useMember(memberId);
  const unfreezeMutation = useUnfreezeMember(memberId);
  const deactivateMutation = useDeactivateMember(memberId);
  const activateMutation = useActivateMember(memberId);

  // Extract embedded relations from the member response
  const memberWithRelations = member as typeof member & { check_ins?: CheckIn[]; payments?: Payment[] } | undefined;
  const checkIns = memberWithRelations?.check_ins;
  const payments = memberWithRelations?.payments;

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
        <div className="space-y-6">
          <LoadingSkeleton className="h-8 w-64" />
          <LoadingSkeleton className="h-48 w-full" />
          <LoadingSkeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !member) {
    return (
      <AppLayout>
        <EmptyState
          title="Member not found"
          description="The member you are looking for does not exist or has been removed."
          action={
            <Link href={gymPath("/members")}>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Back to Members
              </Button>
            </Link>
          }
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header + Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <MemberHeader member={member} backHref={gymPath("/members")} />
          <MemberActions
            member={member}
            editHref={gymPath(`/members/${memberId}/edit`)}
            onRenew={() => setRenewOpen(true)}
            onFreeze={() => setFreezeOpen(true)}
            onUnfreeze={() => setUnfreezeOpen(true)}
            onActivate={() => setActivateOpen(true)}
            onDeactivate={() => setDeactivateOpen(true)}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="bg-muted border border-border p-1">
            <TabsTrigger
              value="overview"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <Activity className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="memberships"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <MembershipIcon className="mr-2 h-4 w-4" />
              Memberships
            </TabsTrigger>
            <TabsTrigger
              value="visits"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Visits
            </TabsTrigger>
            <TabsTrigger
              value="progress"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Progress
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger
              value="referrals"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Referrals
            </TabsTrigger>
            <TabsTrigger
              value="attendance"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <Clock className="mr-2 h-4 w-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <StickyNote className="mr-2 h-4 w-4" />
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <MemberOverview member={member} checkIns={checkIns} />
                </div>
                <div>
                  <MemberSubscriptionCard member={member} />
                </div>
              </div>
              <MembershipAnalytics member={member} />
            </div>
          </TabsContent>

          <TabsContent value="memberships" className="mt-4">
            <MemberMembershipsTab member={member} />
          </TabsContent>

          <TabsContent value="visits" className="mt-4">
            <MemberVisitsTab memberId={memberId} />
          </TabsContent>

          <TabsContent value="progress" className="mt-4">
            <MemberProgressTab memberId={memberId} />
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <MemberDocumentsTab memberId={memberId} />
          </TabsContent>

          <TabsContent value="referrals" className="mt-4">
            <MemberReferralsTab memberId={memberId} />
          </TabsContent>

          <TabsContent value="attendance" className="mt-4">
            <MemberAttendance checkIns={checkIns} />
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <MemberPayments payments={payments} />
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <MemberNotes memberId={memberId} initialNotes={member.notes ?? ""} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Deactivate Dialog */}
      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deactivate Member"
        description={`Are you sure you want to deactivate ${member.full_name}? They will no longer be able to check in or access the gym.`}
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={() => deactivateMutation.mutate(undefined, { onSuccess: () => setDeactivateOpen(false) })}
        loading={deactivateMutation.isPending}
      />

      {/* Activate Dialog */}
      <ConfirmDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        title="Activate Member"
        description={`Are you sure you want to reactivate ${member.full_name}? They will be able to check in and access the gym again.`}
        confirmLabel="Activate"
        variant="default"
        onConfirm={() => activateMutation.mutate(undefined, { onSuccess: () => setActivateOpen(false) })}
        loading={activateMutation.isPending}
      />

      {/* Unfreeze Dialog */}
      <ConfirmDialog
        open={unfreezeOpen}
        onOpenChange={setUnfreezeOpen}
        title="Unfreeze Membership"
        description={`Are you sure you want to unfreeze ${member.full_name}'s membership? Their membership will become active again.`}
        confirmLabel="Unfreeze"
        variant="default"
        onConfirm={() => unfreezeMutation.mutate(undefined, { onSuccess: () => setUnfreezeOpen(false) })}
        loading={unfreezeMutation.isPending}
      />

      {/* Freeze Dialog — sends correct { reason, end_date } DTO */}
      <FreezeDialog
        memberId={memberId}
        memberName={member.full_name}
        open={freezeOpen}
        onClose={() => setFreezeOpen(false)}
      />

      {/* Renew Dialog */}
      <RenewDialog
        memberId={memberId}
        memberName={member.full_name}
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
      />
    </AppLayout>
  );
}
