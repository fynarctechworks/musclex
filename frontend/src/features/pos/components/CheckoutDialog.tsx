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
import { Banknote, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CartItem } from '../types';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'wallet', label: 'Wallet', icon: Wallet },
] as const;

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  discountAmount: number;
  onConfirm: (paymentMethod: 'cash' | 'card' | 'upi' | 'wallet', memberId?: string) => void;
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

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxTotal = cart.reduce((s, i) => s + i.price * i.quantity * (i.tax_rate / 100), 0);
  const total = Math.max(0, subtotal + taxTotal - discountAmount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Checkout</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
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
                      ? 'border-primary bg-primary/10 text-primary'
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
              Member ID <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder="Link to a member..."
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
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
            onClick={() => onConfirm(paymentMethod, memberId || undefined)}
            disabled={isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isPending ? 'Processing...' : `Pay ₹${total.toFixed(2)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
