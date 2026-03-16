'use client';

import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useChangePlan, useMembershipPlans } from '../hooks';
import type { MemberMembership } from '@/types';

interface ChangePlanDialogProps {
  memberId: string;
  memberName: string;
  currentMembership: MemberMembership | undefined;
  open: boolean;
  onClose: () => void;
}

export function ChangePlanDialog({
  memberId,
  memberName,
  currentMembership,
  open,
  onClose,
}: ChangePlanDialogProps) {
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const changePlan = useChangePlan(memberId);
  const { data: plans } = useMembershipPlans({ is_active: 'true' });

  const currentPlan = currentMembership?.plan;
  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);
  const isUpgrade = selectedPlan && currentPlan ? selectedPlan.price > currentPlan.price : false;

  const handleSubmit = () => {
    if (!selectedPlanId) return;
    changePlan.mutate(
      { plan_id: selectedPlanId, payment_method: paymentMethod },
      {
        onSuccess: () => {
          setSelectedPlanId('');
          setPaymentMethod('cash');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Change Plan
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isUpgrade ? 'Upgrade' : 'Change'} the membership plan for{' '}
            <span className="font-medium text-foreground">{memberName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Plan */}
          {currentPlan && (
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Current Plan</p>
              <p className="text-sm font-medium text-foreground">{currentPlan.name}</p>
              <p className="text-xs text-muted-foreground">
                ₹{currentPlan.price.toLocaleString()} / {currentPlan.duration_days} days
              </p>
            </div>
          )}

          {/* New Plan Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">New Plan</label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {(plans ?? [])
                  .filter((p) => p.id !== currentPlan?.id)
                  .map((plan) => (
                    <SelectItem
                      key={plan.id}
                      value={plan.id}
                      className="text-foreground focus:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        {currentPlan && plan.price > currentPlan.price ? (
                          <ArrowUpRight className="h-3 w-3 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 text-amber-500" />
                        )}
                        {plan.name} — ₹{plan.price.toLocaleString()}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Difference */}
          {selectedPlan && currentPlan && (
            <div
              className={`rounded-lg border p-3 ${
                isUpgrade
                  ? 'border-green-500/30 bg-green-500/10'
                  : 'border-amber-500/30 bg-amber-500/10'
              }`}
            >
              <div className="flex items-center gap-2">
                {isUpgrade ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {isUpgrade ? 'Upgrade' : 'Downgrade'}:{' '}
                  ₹{Math.abs(selectedPlan.price - currentPlan.price).toLocaleString()}{' '}
                  {isUpgrade ? 'more' : 'less'} per cycle
                </span>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Payment Method</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="cash" className="text-foreground focus:bg-muted">Cash</SelectItem>
                <SelectItem value="card" className="text-foreground focus:bg-muted">Card</SelectItem>
                <SelectItem value="upi" className="text-foreground focus:bg-muted">UPI</SelectItem>
                <SelectItem value="bank_transfer" className="text-foreground focus:bg-muted">Bank Transfer</SelectItem>
                <SelectItem value="razorpay" className="text-foreground focus:bg-muted">Razorpay</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedPlanId || changePlan.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {changePlan.isPending ? 'Changing...' : 'Change Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
