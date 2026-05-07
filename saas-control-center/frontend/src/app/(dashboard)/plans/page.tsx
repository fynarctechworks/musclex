'use client';

import { useState } from 'react';
import {
  usePlans,
  useTogglePlan,
  useToggleFeatured,
  useDeletePlan,
} from '@/hooks/use-plans';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/shared/loading-skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  Plus,
  Users,
  Building,
  UserCog,
  Pencil,
  Trash2,
  Star,
  Percent,
  PackageOpen,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import type { SubscriptionPlan } from '@/types';
import { PlanFormModal } from './plan-form-modal';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PlansPage() {
  const { data: plans, isLoading, isError, error } = usePlans(true);
  const togglePlan = useTogglePlan();
  const toggleFeatured = useToggleFeatured();
  const deletePlan = useDeletePlan();

  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);

  const handleCreate = () => {
    setEditingPlan(null);
    setFormOpen(true);
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deletePlan.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Subscription Plans"
        description="Manage pricing plans, discounts, and features. Changes sync to onboarding within 60 seconds."
        action={
          <Button size="sm" className="text-[13px]" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create Plan
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        /* Error State */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h3 className="text-[15px] font-semibold text-foreground mb-1">Failed to load plans</h3>
          <p className="text-[13px] text-muted-foreground max-w-xs mb-4">
            {(error as any)?.message || 'Could not connect to the server. Please try again.'}
          </p>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : !plans || plans.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <PackageOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-[16px] font-semibold text-foreground mb-1.5">No plans yet</h3>
          <p className="text-[13px] text-muted-foreground max-w-sm mb-6">
            Create your first subscription plan. Plans will immediately appear in the onboarding flow for new gyms signing up.
          </p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Plan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-lg border border-border bg-card p-5 transition-colors hover:border-border/80 ${
                !plan.is_active ? 'opacity-60' : ''
              }`}
            >
              {/* Featured badge */}
              {plan.is_featured && (
                <div className="absolute -top-2.5 left-4">
                  <Badge variant="default" className="text-[10px] px-2 py-0.5 bg-primary">
                    <Star className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                </div>
              )}

              {/* Discount badge */}
              {plan.is_discount_active && plan.discount_label && (
                <div className="absolute -top-2.5 right-4">
                  <Badge variant="default" className="text-[10px] px-2 py-0.5 bg-green-600">
                    <Percent className="h-3 w-3 mr-1" />
                    {plan.discount_label}
                  </Badge>
                </div>
              )}

              <div className="flex items-start justify-between mb-3 mt-1">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
                    <h3 className="text-[15px] font-semibold text-foreground">
                      {plan.display_name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">{plan.name}</p>
                  {plan.description && (
                    <p className="text-[12px] text-muted-foreground mt-1">{plan.description}</p>
                  )}
                </div>
                <Switch
                  checked={plan.is_active}
                  onCheckedChange={() => togglePlan.mutate(plan.id)}
                />
              </div>

              {/* Pricing */}
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  {plan.is_discount_active && plan.discount_percent ? (
                    <>
                      <span className="text-sm text-muted-foreground line-through">
                        {formatCurrency(plan.monthly_price)}
                      </span>
                      <span className="text-2xl font-semibold text-foreground tracking-tight">
                        {formatCurrency(plan.effective_monthly_price)}
                      </span>
                    </>
                  ) : (
                    <span className="text-2xl font-semibold text-foreground tracking-tight">
                      {plan.monthly_price === 0 ? 'Free' : formatCurrency(plan.monthly_price)}
                    </span>
                  )}
                  {plan.monthly_price > 0 && (
                    <span className="text-[13px] font-normal text-muted-foreground">/mo</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  {plan.is_discount_active && plan.discount_percent ? (
                    <>
                      <span className="text-[11px] text-muted-foreground line-through">
                        {formatCurrency(plan.annual_price)}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        {formatCurrency(plan.effective_annual_price)}/year
                      </span>
                    </>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">
                      {plan.annual_price === 0 ? 'Free forever' : `${formatCurrency(plan.annual_price)}/year`}
                    </span>
                  )}
                </div>
              </div>

              {/* Limits */}
              <div className="space-y-1.5 text-[12px] mb-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{plan.max_members >= 99999 ? 'Unlimited' : plan.max_members.toLocaleString()} Members</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building className="h-3.5 w-3.5" />
                  <span>{plan.max_branches >= 999 ? 'Unlimited' : plan.max_branches} Branches</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserCog className="h-3.5 w-3.5" />
                  <span>{plan.max_staff >= 999 ? 'Unlimited' : plan.max_staff} Staff</span>
                </div>
              </div>

              {/* Features — only for regular plans */}
              {plan.plan_type === 'regular' && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {Object.entries(plan.features || {})
                    .filter(([, enabled]) => enabled)
                    .slice(0, 8)
                    .map(([key]) => (
                      <span
                        key={key}
                        className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border-primary/20"
                      >
                        {key.replace(/_/g, ' ')}
                      </span>
                    ))}
                  {Object.values(plan.features || {}).filter(Boolean).length > 8 && (
                    <span className="text-[11px] text-muted-foreground">
                      +{Object.values(plan.features).filter(Boolean).length - 8} more
                    </span>
                  )}
                </div>
              )}

              {/* Sort order + actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-[11px] text-muted-foreground">Order: {plan.sort_order}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => toggleFeatured.mutate(plan.id)}
                    title={plan.is_featured ? 'Remove featured' : 'Set as featured'}
                  >
                    <Star className={`h-3.5 w-3.5 ${plan.is_featured ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleEdit(plan)}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setDeleteTarget(plan)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        editingPlan={editingPlan}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Deactivate Plan"
        description={`This will deactivate "${deleteTarget?.display_name}". It will be hidden from onboarding but existing subscribers won't be affected.`}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Deactivate"
        variant="destructive"
      />
    </div>
  );
}
