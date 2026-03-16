"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/services/query-client";
import { apiClient } from "@/services/api-client";
import { useAssignMembership, useMembershipPlans } from "../hooks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/types";

const schema = z.object({
  plan_id: z.string().min(1, "Select a plan"),
  branch_id: z.string().min(1, "Select a branch"),
  start_date: z.string().optional(),
  auto_renew: z.boolean(),
  payment_method: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AssignMembershipDialogProps {
  memberId: string;
  memberName: string;
  defaultBranchId?: string;
  open: boolean;
  onClose: () => void;
}

export function AssignMembershipDialog({
  memberId,
  memberName,
  defaultBranchId,
  open,
  onClose,
}: AssignMembershipDialogProps) {
  const assignMutation = useAssignMembership(memberId);
  const { data: plans } = useMembershipPlans({ is_active: "true" });
  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      plan_id: "",
      branch_id: defaultBranchId ?? "",
      start_date: new Date().toISOString().split("T")[0],
      auto_renew: false,
      payment_method: "",
    },
  });

  const onSubmit = (data: FormData) => {
    assignMutation.mutate(
      {
        plan_id: data.plan_id,
        branch_id: data.branch_id,
        start_date: data.start_date || undefined,
        auto_renew: data.auto_renew,
        payment_method: data.payment_method || undefined,
      },
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
      <DialogContent className="bg-card border-border sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Assign Membership to {memberName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Plan */}
          <div>
            <Label>Plan *</Label>
            <Select value={watch("plan_id")} onValueChange={(v) => setValue("plan_id", v)}>
              <SelectTrigger className="mt-1.5 bg-muted border-border">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {(plans ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — ₹{Number(p.price).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.plan_id && <p className="mt-1 text-xs text-destructive">{errors.plan_id.message}</p>}
          </div>

          {/* Branch */}
          <div>
            <Label>Branch *</Label>
            <Select value={watch("branch_id")} onValueChange={(v) => setValue("branch_id", v)}>
              <SelectTrigger className="mt-1.5 bg-muted border-border">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {(branches ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.branch_id && <p className="mt-1 text-xs text-destructive">{errors.branch_id.message}</p>}
          </div>

          {/* Start Date */}
          <div>
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              {...register("start_date")}
              className="mt-1.5 bg-muted border-border"
            />
          </div>

          {/* Payment Method */}
          <div>
            <Label>Payment Method</Label>
            <Select value={watch("payment_method") || ""} onValueChange={(v) => setValue("payment_method", v)}>
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
          </div>

          {/* Auto Renew */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto Renew</Label>
              <p className="text-xs text-muted-foreground">Automatically renew on expiry</p>
            </div>
            <Switch
              checked={watch("auto_renew")}
              onCheckedChange={(checked) => setValue("auto_renew", checked)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={assignMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {assignMutation.isPending ? "Assigning..." : "Assign Membership"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
