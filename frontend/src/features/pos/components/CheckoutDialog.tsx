'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { Input } from '@/components/ui/input';
import { Banknote, CreditCard, Smartphone, Wallet, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWallet, useLoyaltyConfig } from '@/features/wallet';
import type { CartItem } from '../types';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'wallet', label: 'Wallet', icon: Wallet },
] as const;

// rough UUID check so we only fetch a wallet for a plausible member id
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  discountAmount: number;
  onConfirm: (
    paymentMethod: 'cash' | 'card' | 'upi' | 'wallet',
    memberId?: string,
    redeemPoints?: number,
  ) => void;
  isPending?: boolean;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  cart,
  discountAmount,
  onConfirm,
  isPending,
}: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = React.useState<'cash' | 'card' | 'upi' | 'wallet'>('cash');
  const [memberId, setMemberId] = React.useState('');
  const [redeemPoints, setRedeemPoints] = React.useState('');

  const validMember = UUID_RE.test(memberId.trim());
  const { data: wallet } = useWallet(validMember ? memberId.trim() : '');
  const { data: loyalty } = useLoyaltyConfig();

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxTotal = cart.reduce((s, i) => s + i.price * i.quantity * (i.tax_rate / 100), 0);
  const baseTotal = Math.max(0, subtotal + taxTotal - discountAmount);

  // Points redemption preview
  const loyaltyActive = !!loyalty?.is_active;
  const pointsBalance = wallet?.points_balance ?? 0;
  const redeemPts = Math.min(Number(redeemPoints) || 0, pointsBalance);
  const redeemValue = loyaltyActive ? redeemPts * Number(loyalty?.redeem_value_per_point ?? 0) : 0;
  const cappedRedeemValue = Math.min(redeemValue, baseTotal);
  const total = Math.max(0, baseTotal - cappedRedeemValue);

  const walletBalance = Number(wallet?.balance ?? 0);
  const walletInsufficient = paymentMethod === 'wallet' && validMember && walletBalance < total;
  const walletNeedsMember = paymentMethod === 'wallet' && !validMember;

  // reset transient inputs when reopened
  React.useEffect(() => {
    if (open) setRedeemPoints('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Checkout</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="rounded-lg border border-border bg-canvas-soft p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="text-foreground">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="text-foreground">₹{taxTotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-success">-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {cappedRedeemValue > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Points redeemed ({redeemPts})</span>
                <span className="text-success">-₹{cappedRedeemValue.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold pt-1 border-t border-border">
              <span className="text-foreground">Total</span>
              <span className="text-primary">₹{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label className="text-foreground">Payment Method</Label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => setPaymentMethod(pm.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-2.5 transition-all',
                    paymentMethod === pm.value
                      ? 'border-primary bg-canvas-soft-2 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <pm.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{pm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Member */}
          <div className="space-y-2">
            <Label className="text-foreground">
              Member ID{' '}
              <span className="text-muted-foreground">
                {paymentMethod === 'wallet' ? '(required for wallet)' : '(optional)'}
              </span>
            </Label>
            <Input
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder="Link to a member..."
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {validMember && wallet && (
              <p className="text-xs text-muted-foreground">
                Wallet ₹{walletBalance.toFixed(2)} · {pointsBalance} points
              </p>
            )}
            {walletNeedsMember && (
              <p className="text-xs text-destructive">Wallet payment requires a valid member.</p>
            )}
            {walletInsufficient && (
              <p className="text-xs text-destructive">
                Insufficient wallet balance (₹{walletBalance.toFixed(2)}) for ₹{total.toFixed(2)}.
              </p>
            )}
          </div>

          {/* Points redemption — only when loyalty active + member has points */}
          {loyaltyActive && validMember && pointsBalance > 0 && (
            <div className="space-y-2">
              <Label className="text-foreground flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5" />
                Redeem points{' '}
                <span className="text-muted-foreground">
                  ({pointsBalance} available
                  {loyalty && loyalty.min_redeem_points > 0
                    ? `, min ${loyalty.min_redeem_points}`
                    : ''}
                  )
                </span>
              </Label>
              <Input
                type="number"
                min="0"
                max={pointsBalance}
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.value)}
                placeholder="0"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm(
                paymentMethod,
                memberId.trim() || undefined,
                redeemPts > 0 ? redeemPts : undefined,
              )
            }
            disabled={isPending || walletNeedsMember || walletInsufficient}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isPending ? 'Processing...' : `Pay ₹${total.toFixed(2)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
