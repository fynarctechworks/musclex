"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import {
  FormInput,
  FormSelect,
  FormTextarea,
} from "@/components/shared/form-fields";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import type { MembershipPlan, Branch } from "@/lib/types";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { AccessDenied } from "@/components/shared";
import { AccessScopeSection } from "./AccessScopeSection";
import { planMinPrice, planHasBranchPricing } from "@/lib/plan-pricing";

interface PlanFormData {
  name: string;
  description?: string;
  plan_type: string;
  duration_days?: number;
  total_classes?: number;
  max_classes_per_week?: number;
  price: number;
  is_active: boolean;
  auto_renew_enabled: boolean;
  branch_id?: string;
  // ── Multi-gym access scope ──
  access_type: string;
  tier: string;
  allowed_branch_ids: string[];
  allowed_city?: string;
  allowed_hours_start?: string;
  allowed_hours_end?: string;
  branch_price_overrides: Record<string, number | string>;
}

const planTypeOptions = [
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Half Yearly", value: "half_yearly" },
  { label: "Yearly", value: "yearly" },
  { label: "Class Pack", value: "class_pack" },
  { label: "Family", value: "family" },
  { label: "Custom", value: "custom" },
];

export default function MembershipPlansPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setDialogOpen(true);
    }
  }, [searchParams]);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => apiClient.get<MembershipPlan[]>("/membership-plans"),
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PlanFormData>({
    defaultValues: {
      name: "",
      description: "",
      plan_type: "monthly",
      duration_days: undefined,
      total_classes: undefined,
      max_classes_per_week: undefined,
      price: undefined,
      is_active: true,
      auto_renew_enabled: false,
      branch_id: "none",
      access_type: "single_branch",
      tier: "",
      allowed_branch_ids: [],
      allowed_city: "",
      allowed_hours_start: "",
      allowed_hours_end: "",
      branch_price_overrides: {},
    },
  });

  const planType = watch("plan_type");

  const buildPayload = (data: PlanFormData) => {
    const overrides: Record<string, number> = {};
    for (const [k, v] of Object.entries(data.branch_price_overrides ?? {})) {
      const n = typeof v === "string" ? parseFloat(v) : v;
      if (Number.isFinite(n) && (n as number) >= 0) overrides[k] = n as number;
    }
    const hours =
      data.access_type === "time_based" &&
      data.allowed_hours_start &&
      data.allowed_hours_end
        ? { start: data.allowed_hours_start, end: data.allowed_hours_end }
        : null;
    return {
      ...data,
      branch_id:
        data.branch_id && data.branch_id !== "none" ? data.branch_id : undefined,
      // Server-side fields only — drop UI scratch fields.
      allowed_branch_ids:
        data.access_type === "multi_branch" ? data.allowed_branch_ids : [],
      allowed_city:
        data.access_type === "city_access" ? data.allowed_city || null : null,
      allowed_hours_json: hours,
      branch_price_overrides: overrides,
      allowed_hours_start: undefined,
      allowed_hours_end: undefined,
    };
  };

  const createMutation = useMutation({
    mutationFn: (data: PlanFormData) => {
      const payload = buildPayload(data);
      return apiClient.post<MembershipPlan>("/membership-plans", payload);
    },
    onSuccess: () => {
      toast.success("Plan created successfully");
      queryClient.invalidateQueries({ queryKey: ["membership-plans"] });
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PlanFormData }) => {
      const payload = buildPayload(data);
      return apiClient.patch<MembershipPlan>(
        `/membership-plans/${id}`,
        payload
      );
    },
    onSuccess: () => {
      toast.success("Plan updated successfully");
      queryClient.invalidateQueries({ queryKey: ["membership-plans"] });
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch<MembershipPlan>(`/membership-plans/${id}`, { is_active }),
    onSuccess: () => {
      toast.success("Plan status updated");
      queryClient.invalidateQueries({ queryKey: ["membership-plans"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreateDialog = () => {
    setEditingPlan(null);
    reset({
      name: "",
      description: "",
      plan_type: "monthly",
      duration_days: undefined,
      total_classes: undefined,
      max_classes_per_week: undefined,
      price: undefined,
      is_active: true,
      auto_renew_enabled: false,
      branch_id: "none",
      access_type: "single_branch",
      tier: "",
      allowed_branch_ids: [],
      allowed_city: "",
      allowed_hours_start: "",
      allowed_hours_end: "",
      branch_price_overrides: {},
    });
    setDialogOpen(true);
  };

  const openEditDialog = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    const hours = plan.allowed_hours_json as
      | { start?: string; end?: string }
      | null
      | undefined;
    reset({
      name: plan.name,
      description: plan.description || "",
      plan_type: plan.plan_type,
      duration_days: plan.duration_days ?? undefined,
      total_classes: plan.total_classes ?? undefined,
      max_classes_per_week: plan.max_classes_per_week ?? undefined,
      price: plan.price,
      is_active: plan.is_active,
      auto_renew_enabled: plan.auto_renew_enabled,
      branch_id: plan.branch_id || "none",
      access_type: plan.access_type ?? "single_branch",
      tier: plan.tier ?? "",
      allowed_branch_ids: plan.allowed_branch_ids ?? [],
      allowed_city: plan.allowed_city ?? "",
      allowed_hours_start: hours?.start ?? "",
      allowed_hours_end: hours?.end ?? "",
      branch_price_overrides:
        (plan.branch_price_overrides as Record<string, number>) ?? {},
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const onSubmit = (data: PlanFormData) => {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;


  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Membership Plans
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your gym membership plans and pricing
            </p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Plan
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : !plans || plans.length === 0 ? (
          <EmptyState
            title="No membership plans"
            description="Create your first membership plan to start enrolling members."
            action={
              <Button
                onClick={openCreateDialog}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Plan
              </Button>
            }
          />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Plan Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Max Classes/Week
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="border-b border-border bg-card hover:bg-muted transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {plan.name}
                          </p>
                          {plan.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                              {plan.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">
                        {plan.plan_type.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {plan.duration_days
                          ? `${plan.duration_days} days`
                          : "--"}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {planHasBranchPricing(plan) && (
                          <span className="text-xs text-muted-foreground font-normal mr-1">from</span>
                        )}
                        ₹{planMinPrice(plan).toFixed(2)}
                        {planHasBranchPricing(plan) && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            branch pricing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {plan.max_classes_per_week ?? "Unlimited"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {plan.branch?.name || "All Branches"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          variant={plan.is_active ? "active" : "expired"}
                          label={plan.is_active ? "Active" : "Inactive"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(plan)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Switch
                            checked={plan.is_active}
                            disabled={toggleActiveMutation.isPending}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({
                                id: plan.id,
                                is_active: checked,
                              })
                            }
                            aria-label={
                              plan.is_active
                                ? "Deactivate plan"
                                : "Activate plan"
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingPlan ? "Edit Plan" : "Create New Plan"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormInput
              label="Plan Name *"
              placeholder="e.g., Monthly Unlimited"
              error={errors.name?.message}
              {...register("name")}
            />

            <FormTextarea
              label="Description"
              placeholder="Brief description of this plan..."
              {...register("description")}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="plan_type"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    label="Plan Type *"
                    value={field.value}
                    onValueChange={field.onChange}
                    options={planTypeOptions}
                    error={errors.plan_type?.message}
                  />
                )}
              />
              <FormInput
                label="Price *"
                type="number"
                step="0.01"
                placeholder="0.00"
                error={errors.price?.message}
                {...register("price")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Duration (days)"
                type="number"
                placeholder="e.g., 30"
                error={errors.duration_days?.message}
                {...register("duration_days")}
              />
              {planType === "class_pack" && (
                <FormInput
                  label="Total Classes"
                  type="number"
                  placeholder="e.g., 20"
                  error={errors.total_classes?.message}
                  {...register("total_classes")}
                />
              )}
            </div>

            <FormInput
              label="Max Classes/Week"
              type="number"
              placeholder="Leave empty for unlimited"
              error={errors.max_classes_per_week?.message}
              {...register("max_classes_per_week")}
            />

            {/* Branch access + tier + per-branch pricing.
                This section now owns branch selection (home branch for
                single-branch plans, multi-select for multi-branch) — the old
                standalone "Branch Scope" dropdown was redundant and removed. */}
            <AccessScopeSection
              register={register}
              watch={watch}
              setValue={setValue}
              branches={branches}
              basePrice={watch("price")}
            />

            {/* Toggles */}
            <div className="space-y-3 rounded-lg border border-border bg-background p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-muted-foreground">Active</span>
                <Controller
                  name="is_active"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(!field.value)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        field.value ? "bg-primary" : "bg-border"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-canvas transition-transform ${
                          field.value ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  )}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-muted-foreground">
                  Auto-Renew Enabled
                </span>
                <Controller
                  name="auto_renew_enabled"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(!field.value)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        field.value ? "bg-primary" : "bg-border"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-canvas transition-transform ${
                          field.value ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  )}
                />
              </label>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={closeDialog}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isMutating}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isMutating
                  ? "Saving..."
                  : editingPlan
                  ? "Update Plan"
                  : "Create Plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
