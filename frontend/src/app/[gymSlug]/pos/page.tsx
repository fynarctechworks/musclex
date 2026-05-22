'use client';

import React, { useState, useCallback } from 'react';
import { ShoppingCart, Receipt, Printer, Download, Mail, MessageCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { AccessDenied } from '@/components/shared/access-denied';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { PageHeader } from '@/components/shared/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductGrid } from '@/features/pos/components/ProductGrid';
import { CartPanel } from '@/features/pos/components/CartPanel';
import { CheckoutDialog } from '@/features/pos/components/CheckoutDialog';
import { SalesTable } from '@/features/pos/components/SalesTable';
import { useCreateSale } from '@/features/pos/hooks';
import { usePosReceiptPdfLink, useSendPosReceipt } from '@/features/payments';
import type { CartItem } from '@/features/pos/types';
import type { Product, Bundle } from '@/features/inventory/types';
import { useAuthStore } from '@/stores/auth-store';

export default function PosPage() {
  const { allowed, checked } = useRequirePermission('payments', 'view', 'deny');
  const [tab, setTab] = useState('terminal');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const user = useAuthStore((s) => s.user);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const createSale = useCreateSale();

  // Last sale → success card with receipt actions
  const [lastSale, setLastSale] = useState<{ id: string; invoice_number: string; total_amount: number } | null>(null);
  const pdfMut = usePosReceiptPdfLink();
  const sendMut = useSendPosReceipt();
  const [busy, setBusy] = useState<string | null>(null);

  const openReceipt = async (saleId: string, format: 'a4' | 'thermal_80mm') => {
    setBusy(`pdf:${format}`);
    try {
      const res = (await pdfMut.mutateAsync({ saleId, format })) as { signed_url?: string };
      if (res?.signed_url) window.open(res.signed_url, '_blank', 'noopener');
    } finally {
      setBusy(null);
    }
  };

  const sendReceipt = async (saleId: string, channel: 'email' | 'whatsapp') => {
    setBusy(`send:${channel}`);
    try {
      await sendMut.mutateAsync({ saleId, channels: [channel] });
    } finally {
      setBusy(null);
    }
  };

  const addToCart = useCallback((product: Product) => {
    const inv = Array.isArray(product.inventory)
      ? product.inventory[0]
      : product.inventory;
    const stockQty = inv?.stock_quantity ?? 0;
    const key = product.id;

    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        if (existing.quantity >= stockQty) return prev;
        return prev.map((c) => (c.key === key ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          key,
          kind: 'product',
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

  const addBundleToCart = useCallback((bundle: Bundle) => {
    // Bundle stock is component-bounded; backend re-validates atomically. UI uses
    // Infinity here so the +/- buttons don't artificially cap, and surfaces backend
    // shortfall errors as toasts.
    const key = `bundle:${bundle.id}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => (c.key === key ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          key,
          kind: 'bundle',
          bundle_id: bundle.id,
          product_name: bundle.name,
          price: Number(bundle.price),
          tax_rate: Number(bundle.tax_rate),
          quantity: 1,
          stock_quantity: Number.POSITIVE_INFINITY,
        },
      ];
    });
  }, []);

  const updateQty = useCallback((key: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.key !== key));
    } else {
      setCart((prev) => prev.map((c) => (c.key === key ? { ...c, quantity: qty } : c)));
    }
  }, []);

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountAmount(0);
  }, []);

  const handleCheckout = useCallback(
    (
      paymentMethod: 'cash' | 'card' | 'upi' | 'wallet',
      memberId?: string,
      redeemPoints?: number,
    ) => {
      createSale.mutate(
        {
          branch_id: activeBranchId || user?.branch_ids?.[0] || '',
          staff_id: user?.id || '',
          items: cart.map((c) =>
            c.kind === 'bundle'
              ? { bundle_id: c.bundle_id!, quantity: c.quantity }
              : { product_id: c.product_id!, quantity: c.quantity },
          ),
          payment_method: paymentMethod,
          discount_amount: discountAmount || undefined,
          member_id: memberId,
          redeem_points: redeemPoints,
        },
        {
          onSuccess: (sale: unknown) => {
            const s = sale as { id?: string; invoice_number?: string; total_amount?: number };
            if (s?.id && s?.invoice_number) {
              setLastSale({
                id: s.id,
                invoice_number: s.invoice_number,
                total_amount: Number(s.total_amount ?? 0),
              });
            }
            setCheckoutOpen(false);
            clearCart();
          },
        },
      );
    },
    [cart, discountAmount, user, createSale, clearCart],
  );

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="payments" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Point of Sale"
          description="Process sales, manage transactions, and track revenue"
        />

        {lastSale && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Sale completed</p>
                  <p className="text-[12px] text-muted-foreground font-mono mt-0.5">{lastSale.invoice_number}</p>
                </div>
                <button
                  onClick={() => setLastSale(null)}
                  className="p-1 rounded hover:bg-canvas-soft-2 text-muted-foreground hover:text-foreground"
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openReceipt(lastSale.id, 'thermal_80mm')}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
                  title="Print 80mm thermal receipt"
                >
                  {busy === 'pdf:thermal_80mm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                  Print thermal
                </button>
                <button
                  onClick={() => openReceipt(lastSale.id, 'a4')}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-foreground text-[12px] font-medium hover:bg-canvas-soft-2 disabled:opacity-50"
                >
                  {busy === 'pdf:a4' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download A4
                </button>
                <button
                  onClick={() => sendReceipt(lastSale.id, 'email')}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-foreground text-[12px] font-medium hover:bg-canvas-soft-2 disabled:opacity-50"
                >
                  {busy === 'send:email' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  Email
                </button>
                <button
                  onClick={() => sendReceipt(lastSale.id, 'whatsapp')}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-foreground text-[12px] font-medium hover:bg-canvas-soft-2 disabled:opacity-50"
                >
                  {busy === 'send:whatsapp' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

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
                  onAddBundleToCart={addBundleToCart}
                  branchId={activeBranchId || user?.branch_ids?.[0]}
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
            <SalesTable branchId={activeBranchId || user?.branch_ids?.[0]} />
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
