'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMembershipPlans } from '../hooks';
import type { MembershipPlan } from '@/types';
import { planMinPrice, planHasBranchPricing } from '@/lib/plan-pricing';

interface PlanComparisonViewProps {
  currentPlanId?: string;
  onSelect?: (plan: MembershipPlan) => void;
}

export function PlanComparisonView({ currentPlanId, onSelect }: PlanComparisonViewProps) {
  const { data: plansData, isLoading } = useMembershipPlans();
  const plans = (plansData ?? []).filter((p) => p.is_active);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-72 rounded-lg bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No active plans available.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {plans.map((plan) => {
        const isCurrent = plan.id === currentPlanId;
        return (
          <div
            key={plan.id}
            className={`relative rounded-lg border p-5 flex flex-col ${
              isCurrent
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/40'
            } transition-colors`}
          >
            {isCurrent && (
              <span className="absolute -top-2.5 left-4 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                Current Plan
              </span>
            )}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {plan.name}
              </h3>
              <p className="text-xs text-muted-foreground capitalize mt-1">
                {plan.plan_type.replace('_', ' ')}
              </p>
            </div>

            <div className="mb-4">
              {planHasBranchPricing(plan) && (
                <span className="text-xs text-muted-foreground block">from</span>
              )}
              <span className="text-2xl font-semibold text-foreground">
                ₹{planMinPrice(plan).toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                / {plan.duration_days} days
              </span>
              {planHasBranchPricing(plan) && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Price varies by branch
                </p>
              )}
            </div>

            {plan.description && (
              <p className="text-xs text-muted-foreground mb-4">
                {plan.description}
              </p>
            )}

            <div className="space-y-2 flex-1">
              <Feature
                label={`${plan.duration_days} day${plan.duration_days !== 1 ? 's' : ''} duration`}
                included
              />
              {plan.total_classes != null && (
                <Feature
                  label={`${plan.total_classes} class${plan.total_classes !== 1 ? 'es' : ''} included`}
                  included
                />
              )}
              {plan.max_classes_per_week != null && (
                <Feature
                  label={`Up to ${plan.max_classes_per_week} classes/week`}
                  included
                />
              )}
              {plan.max_visits != null && (
                <Feature
                  label={`${plan.max_visits} visits included`}
                  included
                />
              )}
              <Feature
                label="Multi-branch access"
                included={!!plan.multi_branch_access}
              />
              <Feature
                label="Auto-renew"
                included={!!plan.auto_renew_enabled}
              />
              {plan.grace_period_days != null && plan.grace_period_days > 0 && (
                <Feature
                  label={`${plan.grace_period_days} day grace period`}
                  included
                />
              )}
            </div>

            {onSelect && !isCurrent && (
              <Button
                className="mt-4 w-full"
                onClick={() => onSelect(plan)}
              >
                Select Plan
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Feature({ label, included }: { label: string; included: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {included ? (
        <Check className="h-3.5 w-3.5 text-success shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className={included ? 'text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  );
}
