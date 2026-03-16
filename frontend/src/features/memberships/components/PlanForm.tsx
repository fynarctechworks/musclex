"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { MembershipPlan, Branch } from "@/types";

const numOrUndef = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : Number(v));

const planSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional(),
  plan_type: z.string().min(1, "Billing cycle is required"),
  price: z.number().min(0, "Price must be positive"),
  duration_days: z.number().min(1).optional(),
  total_classes: z.number().min(0).optional(),
  max_classes_per_week: z.number().min(0).optional(),
  max_visits: z.number().min(0).optional(),
  grace_period_days: z.number().min(0).optional(),
  auto_renew_enabled: z.boolean(),
  branch_id: z.string().optional(),
});

type PlanFormData = z.infer<typeof planSchema>;

interface PlanFormProps {
  defaultValues?: Partial<MembershipPlan>;
  branches?: Branch[];
  onSubmit: (data: PlanFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const planTypes = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half Yearly" },
  { value: "yearly", label: "Yearly" },
  { value: "class_pack", label: "Class Pack" },
  { value: "day_pass", label: "Day Pass" },
  { value: "custom", label: "Custom" },
];

export function PlanForm({ defaultValues, branches, onSubmit, onCancel, isSubmitting }: PlanFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      plan_type: defaultValues?.plan_type ?? "",
      price: defaultValues?.price ?? 0,
      duration_days: defaultValues?.duration_days ?? undefined,
      total_classes: defaultValues?.total_classes ?? undefined,
      max_classes_per_week: defaultValues?.max_classes_per_week ?? undefined,
      max_visits: defaultValues?.max_visits ?? undefined,
      grace_period_days: defaultValues?.grace_period_days ?? undefined,
      auto_renew_enabled: defaultValues?.auto_renew_enabled ?? false,
      branch_id: defaultValues?.branch_id ?? "",
    },
  });

  const autoRenew = watch("auto_renew_enabled");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Plan Details */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Plan Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Plan Name *</Label>
            <Input
              id="name"
              {...register("name")}
              className="mt-1.5 bg-muted border-border"
              placeholder="e.g. Gold Monthly"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              className="mt-1.5 bg-muted border-border min-h-[80px]"
              placeholder="What's included in this plan..."
            />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Pricing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="price">Price (₹) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              {...register("price", { valueAsNumber: true })}
              className="mt-1.5 bg-muted border-border"
              placeholder="0.00"
            />
            {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price.message}</p>}
          </div>
          <div>
            <Label htmlFor="plan_type">Billing Cycle *</Label>
            <Select
              value={watch("plan_type")}
              onValueChange={(val) => setValue("plan_type", val)}
            >
              <SelectTrigger className="mt-1.5 bg-muted border-border">
                <SelectValue placeholder="Select cycle" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {planTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.plan_type && <p className="mt-1 text-xs text-destructive">{errors.plan_type.message}</p>}
          </div>
        </div>
      </div>

      {/* Limits */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Limits</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="duration_days">Duration (days)</Label>
            <Input
              id="duration_days"
              type="number"
              {...register("duration_days", { setValueAs: numOrUndef })}
              className="mt-1.5 bg-muted border-border"
              placeholder="30"
            />
          </div>
          <div>
            <Label htmlFor="max_visits">Visit Limit</Label>
            <Input
              id="max_visits"
              type="number"
              {...register("max_visits", { setValueAs: numOrUndef })}
              className="mt-1.5 bg-muted border-border"
              placeholder="Unlimited"
            />
          </div>
          <div>
            <Label htmlFor="total_classes">Total Classes</Label>
            <Input
              id="total_classes"
              type="number"
              {...register("total_classes", { setValueAs: numOrUndef })}
              className="mt-1.5 bg-muted border-border"
              placeholder="Unlimited"
            />
          </div>
          <div>
            <Label htmlFor="max_classes_per_week">Max Classes / Week</Label>
            <Input
              id="max_classes_per_week"
              type="number"
              {...register("max_classes_per_week", { setValueAs: numOrUndef })}
              className="mt-1.5 bg-muted border-border"
              placeholder="Unlimited"
            />
          </div>
          <div>
            <Label htmlFor="grace_period_days">Grace Period (days)</Label>
            <Input
              id="grace_period_days"
              type="number"
              {...register("grace_period_days", { setValueAs: numOrUndef })}
              className="mt-1.5 bg-muted border-border"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Options</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto Renew</Label>
              <p className="text-xs text-muted-foreground">Automatically renew when membership expires</p>
            </div>
            <Switch
              checked={autoRenew}
              onCheckedChange={(checked) => setValue("auto_renew_enabled", checked)}
            />
          </div>
          {branches && branches.length > 0 && (
            <div>
              <Label htmlFor="branch_id">Branch</Label>
              <Select
                value={watch("branch_id") || ""}
                onValueChange={(val) => setValue("branch_id", val === "all" ? "" : val)}
              >
                <SelectTrigger className="mt-1.5 bg-muted border-border">
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          {isSubmitting ? "Saving..." : defaultValues?.id ? "Update Plan" : "Create Plan"}
        </Button>
      </div>
    </form>
  );
}
