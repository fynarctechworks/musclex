"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRenewMembership, useMembershipPlans } from "../hooks";
import { resolvePlanPrice, planMinPrice, planHasBranchPricing } from "@/lib/plan-pricing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  plan_id: z.string().min(1, "Select a plan"),
  payment_method: z.string().min(1, "Select payment method"),
});

type FormData = z.infer<typeof schema>;

interface RenewMembershipDialogProps {
  memberId: string;
  memberName: string;
  currentPlanId?: string;
  // Branch context for branch-tier pricing. When provided, the renewal preview
  // shows the branch-specific price; otherwise it falls back to base.
  branchId?: string | null;
  open: boolean;
  onClose: () => void;
}

export function RenewMembershipDialog({
  memberId,
  memberName,
  currentPlanId,
  branchId,
  open,
  onClose,
}: RenewMembershipDialogProps) {
  const renewMutation = useRenewMembership(memberId);
  const { data: plans } = useMembershipPlans({ is_active: "true" });

  const {
    setValue,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      plan_id: currentPlanId ?? "",
      payment_method: "",
    },
  });

  const selectedPlan = plans?.find((p) => p.id === watch("plan_id"));

  const onSubmit = (data: FormData) => {
    renewMutation.mutate(
      { plan_id: data.plan_id, payment_method: data.payment_method },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Renew Membership — {memberName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Plan */}
          <div>
            <Label>Plan *</Label>
            <Select value={watch("plan_id")} onValueChange={(v) => setValue("plan_id", v)}>
              <SelectTrigger className="mt-1.5 bg-muted border-border">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {(plans ?? []).map((p) => {
                  // If we know the branch, show branch price; else show "from"
                  // when there are any overrides.
                  const price = branchId
                    ? resolvePlanPrice(p, branchId)
                    : planMinPrice(p);
                  const fromLabel = !branchId && planHasBranchPricing(p) ? 'from ' : '';
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {fromLabel}₹{price.toLocaleString()}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.plan_id && <p className="mt-1 text-xs text-destructive">{errors.plan_id.message}</p>}
          </div>

          {/* Summary */}
          {selectedPlan && (
            <div className="rounded-md bg-canvas-soft border border-border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="text-foreground">{selectedPlan.duration_days ?? "--"} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium text-foreground">
                  ₹{resolvePlanPrice(selectedPlan, branchId ?? null).toLocaleString()}
                  {branchId && planHasBranchPricing(selectedPlan) && (
                    <span className="ml-1 text-xs text-muted-foreground">(this branch)</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <Label>Payment Method *</Label>
            <Select value={watch("payment_method")} onValueChange={(v) => setValue("payment_method", v)}>
              <SelectTrigger className="mt-1.5 bg-muted border-border">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="razorpay">Razorpay</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
              </SelectContent>
            </Select>
            {errors.payment_method && <p className="mt-1 text-xs text-destructive">{errors.payment_method.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={renewMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {renewMutation.isPending ? "Renewing..." : "Renew Membership"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
