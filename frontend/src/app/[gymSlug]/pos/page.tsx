'use client';

import React, { useState, useCallback } from 'react';
import { ShoppingCart, Receipt } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/shared/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductGrid } from '@/features/pos/components/ProductGrid';
import { CartPanel } from '@/features/pos/components/CartPanel';
import { CheckoutDialog } from '@/features/pos/components/CheckoutDialog';
import { SalesTable } from '@/features/pos/components/SalesTable';
import { useCreateSale } from '@/features/pos/hooks';
import type { CartItem } from '@/features/pos/types';
import type { Product } from '@/features/inventory/types';
import { useAuthStore } from '@/stores/auth-store';

export default function PosPage() {
  const [tab, setTab] = useState('terminal');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const user = useAuthStore((s) => s.user);
  const createSale = useCreateSale();

  const addToCart = useCallback((product: Product) => {
    const inv = Array.isArray(product.inventory)
      ? product.inventory[0]
      : product.inventory;
    const stockQty = inv?.stock_quantity ?? 0;

    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === product.id);
      if (existing) {
        if (existing.quantity >= stockQty) return prev;
        return prev.map((c) =>
          c.product_id === product.id
            ? { ...c, quantity: c.quantity + 1 }
            : c,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.product_name,
          price: Number(product.price),
          tax_rate: Number(product.tax_rate),
          quantity: 1,
          stock_quantity: stockQty,
        },
      ];
    });
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.product_id !== productId));
    } else {
      setCart((prev) =>
        prev.map((c) =>
          c.product_id === productId ? { ...c, quantity: qty } : c,
        ),
      );
    }
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountAmount(0);
  }, []);

  const handleCheckout = useCallback(
    (paymentMethod: 'cash' | 'card' | 'upi' | 'wallet', memberId?: string) => {
      createSale.mutate(
        {
          branch_id: user?.branch_ids?.[0] || '',
          staff_id: user?.id || '',
          items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
          payment_method: paymentMethod,
          discount_amount: discountAmount || undefined,
          member_id: memberId,
        },
        {
          onSuccess: () => {
            setCheckoutOpen(false);
            clearCart();
          },
        },
      );
    },
    [cart, discountAmount, user, createSale, clearCart],
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Point of Sale"
          description="Process sales, manage transactions, and track revenue"
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted border border-border">
            <TabsTrigger value="terminal" className="data-[state=active]:bg-background data-[state=active]:text-foreground">
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              Terminal
            </TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-background data-[state=active]:text-foreground">
              <Receipt className="h-4 w-4 mr-1.5" />
              Sales History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="mt-4">
            <div className="flex gap-4 h-[calc(100vh-280px)]">
              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto">
                <ProductGrid
                  cart={cart}
                  onAddToCart={addToCart}
                />
              </div>

              {/* Cart Panel */}
              <div className="w-[340px] shrink-0 rounded-lg border border-border bg-card">
                <CartPanel
                  cart={cart}
                  onUpdateQty={updateQty}
                  onRemove={removeFromCart}
                  onClear={clearCart}
                  discountAmount={discountAmount}
                  onDiscountChange={setDiscountAmount}
                  onCheckout={() => setCheckoutOpen(true)}
                  checkoutDisabled={cart.length === 0}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sales" className="mt-4">
            <SalesTable />
          </TabsContent>
        </Tabs>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        cart={cart}
        discountAmount={discountAmount}
        onConfirm={handleCheckout}
        isPending={createSale.isPending}
      />
    </AppLayout>
  );
}
