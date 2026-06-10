'use client';

import React from 'react';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CartItem } from '../types';

interface CartPanelProps {
  cart: CartItem[];
  onUpdateQty: (cartKey: string, qty: number) => void;
  onRemove: (cartKey: string) => void;
  onClear: () => void;
  discountAmount: number;
  onDiscountChange: (amount: number) => void;
  onCheckout: () => void;
  checkoutDisabled?: boolean;
}

export function CartPanel({
  cart,
  onUpdateQty,
  onRemove,
  onClear,
  discountAmount,
  onDiscountChange,
  onCheckout,
  checkoutDisabled,
}: CartPanelProps) {
  const subtotal = cart.reduce((s, item) => s + item.price * item.quantity, 0);
  const taxTotal = cart.reduce(
    (s, item) => s + item.price * item.quantity * (item.tax_rate / 100),
    0,
  );
  const total = subtotal + taxTotal - discountAmount;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
          </h3>
        </div>
        {cart.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={onClear}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingCart className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Cart is empty</p>
            <p className="text-xs text-muted-foreground mt-1">Click products to add</p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-lg border border-border bg-canvas-soft p-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.product_name}
                  {item.kind === 'bundle' && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-primary">bundle</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  ₹{item.price.toFixed(2)} × {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 border-border"
                  onClick={() => onUpdateQty(item.key, item.quantity - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium text-foreground">
                  {item.quantity}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 border-border"
                  disabled={Number.isFinite(item.stock_quantity) && item.quantity >= item.stock_quantity}
                  onClick={() => onUpdateQty(item.key, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(item.key)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-sm font-medium text-foreground w-16 text-right">
                ₹{(item.price * item.quantity).toFixed(0)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {cart.length > 0 && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="text-foreground">₹{taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Discount</span>
            <Input
              type="number"
              min="0"
              step="1"
              value={discountAmount || ''}
              onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
              className="w-20 h-7 text-right bg-muted border-border text-foreground text-sm"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between text-base font-semibold pt-1 border-t border-border">
            <span className="text-foreground">Total</span>
            <span className="text-primary">₹{Math.max(0, total).toFixed(2)}</span>
          </div>
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-2"
            disabled={checkoutDisabled}
            onClick={onCheckout}
          >
            Checkout
          </Button>
        </div>
      )}
    </div>
  );
}
