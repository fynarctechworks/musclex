"use client";

import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api-client";
import { queryKeys } from "@/services/query-client";
import { useRenewMember } from "@/features/members";

interface RenewDialogProps {
  memberId: string;
  memberName: string;
  open: boolean;
  onClose: () => void;
}

export function RenewDialog({
  memberId,
  memberName,
  open,
  onClose,
}: RenewDialogProps) {
  const [planId, setPlanId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const renewMutation = useRenewMember(memberId);

  const { data: plans } = useQuery({
    queryKey: queryKeys.memberships.plans(),
    queryFn: () =>
      apiClient.get<{ id: string; name: string; price: number }[]>(
        "/membership-plans"
      ),
    enabled: open,
  });

  if (!open) return null;

  const handleRenew = () => {
    renewMutation.mutate(
      { plan_id: planId, payment_method: paymentMethod },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Renew Membership
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Select a plan and payment method to renew {memberName}&apos;s
          membership.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Membership Plan *
            </label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Select a plan...</option>
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{p.price}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Payment Method *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="razorpay">Razorpay</option>
              <option value="stripe">Stripe</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRenew}
            disabled={renewMutation.isPending || !planId}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {renewMutation.isPending ? "Renewing..." : "Renew"}
          </Button>
        </div>
      </div>
    </div>
  );
}
