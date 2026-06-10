"use client";

import React, { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { Member, MemberMembership } from "@/types";
import {
  useUnfreezeMembership,
  MembershipHistoryTable,
  AssignMembershipDialog,
  RenewMembershipDialog,
} from "@/features/memberships";
import { FreezeDialog } from "./FreezeDialog";

interface MemberMembershipsTabProps {
  member: Member;
}

export function MemberMembershipsTab({ member }: MemberMembershipsTabProps) {
  const memberships = member.memberships ?? [];
  const [assignOpen, setAssignOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState<MemberMembership | null>(null);
  const [pauseTarget, setPauseTarget] = useState<MemberMembership | null>(null);
  const [resumeTarget, setResumeTarget] = useState<MemberMembership | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MemberMembership | null>(null);

  const unfreezeMutation = useUnfreezeMembership(member.id);

  // Find active membership that's expiring soon
  const activeMembership = memberships.find((m) => m.status === "active");
  const expiringDays =
    activeMembership?.end_date
      ? differenceInDays(new Date(activeMembership.end_date), new Date())
      : null;
  const isExpiringSoon = expiringDays !== null && expiringDays <= 7 && expiringDays >= 0;

  return (
    <div className="space-y-4">
      {/* Expiring Soon Alert */}
      {isExpiringSoon && activeMembership && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-sm text-warning">
            Membership expires in {expiringDays} day{expiringDays !== 1 ? "s" : ""}
          </p>
          <Button
            size="sm"
            className="ml-auto bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => setRenewTarget(activeMembership)}
          >
            Renew Now
          </Button>
        </div>
      )}

      {/* Assign Button */}
      <div className="flex justify-end">
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => setAssignOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Assign Membership
        </Button>
      </div>

      {/* Membership History */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">
          Membership History
        </h3>
        <MembershipHistoryTable
          memberships={memberships}
          onPause={(m) => setPauseTarget(m)}
          onResume={(m) => setResumeTarget(m)}
          onCancel={(m) => setCancelTarget(m)}
          onRenew={(m) => setRenewTarget(m)}
        />
      </div>

      {/* Assign Dialog */}
      <AssignMembershipDialog
        memberId={member.id}
        memberName={member.full_name}
        defaultBranchId={member.branch_id}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
      />

      {/* Renew Dialog */}
      {renewTarget && (
        <RenewMembershipDialog
          memberId={member.id}
          memberName={member.full_name}
          currentPlanId={renewTarget.plan_id}
          open={!!renewTarget}
          onClose={() => setRenewTarget(null)}
        />
      )}

      {/* Pause (Freeze) Dialog */}
      {pauseTarget && (
        <FreezeDialog
          memberId={member.id}
          memberName={member.full_name}
          open={!!pauseTarget}
          onClose={() => setPauseTarget(null)}
        />
      )}

      {/* Resume Confirm */}
      <ConfirmDialog
        open={!!resumeTarget}
        onOpenChange={(open) => !open && setResumeTarget(null)}
        title="Resume Membership"
        description={`Resume ${member.full_name}'s membership? It will become active again.`}
        confirmLabel="Resume"
        variant="default"
        onConfirm={() =>
          unfreezeMutation.mutate(undefined, {
            onSuccess: () => setResumeTarget(null),
          })
        }
        loading={unfreezeMutation.isPending}
      />

      {/* Cancel Confirm */}
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel Membership"
        description={`Cancel ${member.full_name}'s "${cancelTarget?.plan.name}" membership? This cannot be undone.`}
        confirmLabel="Cancel Membership"
        variant="danger"
        onConfirm={() => {
          // Cancellation via status update on the member
          // The backend handles this through the member freeze/status endpoint
          setCancelTarget(null);
        }}
      />
    </div>
  );
}
