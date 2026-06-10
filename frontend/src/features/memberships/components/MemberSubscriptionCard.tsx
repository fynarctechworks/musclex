'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  CreditCard,
  Calendar,
  Clock,
  ArrowUpRight,
  XCircle,
  RefreshCcw,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MembershipStatusBadge } from './MembershipStatusBadge';
import { ChangePlanDialog } from './ChangePlanDialog';
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog';
import { RenewMembershipDialog } from './RenewMembershipDialog';
import type { Member } from '@/types';
import { resolvePlanPrice } from '@/lib/plan-pricing';

interface MemberSubscriptionCardProps {
  member: Member;
}

export function MemberSubscriptionCard({ member }: MemberSubscriptionCardProps) {
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);

  const active = member.memberships?.find(
    (m) => m.status === 'active' || m.status === 'frozen',
  );
  const hasActive = !!active;

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Subscription
          </h3>
          {hasActive && (
            <MembershipStatusBadge status={active.status} />
          )}
        </div>

        {hasActive ? (
          <div className="space-y-3">
            {/* Plan Info */}
            <div className="rounded-lg bg-canvas-soft border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {active.plan?.name ?? 'Unknown Plan'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const price = resolvePlanPrice(active.plan, active.branch_id);
                      const label = `₹${price.toLocaleString()}`;
                      return `${label} / ${active.plan?.duration_days ?? 0} days`;
                    })()}
                  </p>
                </div>
                {active.plan?.plan_type && (
                  <span className="text-xs bg-canvas-soft-2 text-primary px-2 py-1 rounded-md font-medium capitalize">
                    {active.plan.plan_type.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-foreground">
                    {format(new Date(active.start_date), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
              {active.end_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Expires</p>
                    <p className="text-foreground">
                      {format(new Date(active.end_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              )}
              {active.classes_remaining != null && (
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Classes Left</p>
                    <p className="text-foreground">{active.classes_remaining}</p>
                  </div>
                </div>
              )}
              {active.remaining_visits != null && (
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Visits Left</p>
                    <p className="text-foreground">{active.remaining_visits}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Auto-Renew Indicator */}
            {active.auto_renew && (
              <p className="text-xs text-success flex items-center gap-1">
                <RefreshCcw className="h-3 w-3" />
                Auto-renew enabled
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setChangePlanOpen(true)}
              >
                <ArrowUpRight className="mr-1 h-3 w-3" />
                Change Plan
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setRenewOpen(true)}
              >
                <RefreshCcw className="mr-1 h-3 w-3" />
                Renew
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-destructive hover:text-destructive"
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="mr-1 h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">No active subscription</p>
            <p className="text-xs text-muted-foreground">
              Assign a membership plan to activate this member&apos;s subscription.
            </p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ChangePlanDialog
        memberId={member.id}
        memberName={member.full_name}
        currentMembership={active}
        open={changePlanOpen}
        onClose={() => setChangePlanOpen(false)}
      />
      <CancelSubscriptionDialog
        memberId={member.id}
        membershipId={active?.id ?? ''}
        memberName={member.full_name}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
      />
      <RenewMembershipDialog
        memberId={member.id}
        memberName={member.full_name}
        branchId={active?.branch_id}
        currentPlanId={active?.plan_id}
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
      />
    </>
  );
}
