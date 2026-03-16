'use client';

import React, { useState } from 'react';
import { Receipt, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSales } from '../hooks';
import type { SalesFilters, PosSale } from '../types';
import { format } from 'date-fns';

const paymentMethodLabel: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  wallet: 'Wallet',
};

interface SalesTableProps {
  branchId?: string;
  onView?: (sale: PosSale) => void;
}

export function SalesTable({ branchId, onView }: SalesTableProps) {
  const [filters, setFilters] = useState<SalesFilters>({
    branch_id: branchId,
    page: 1,
    limit: 20,
  });

  const { data, isLoading } = useSales(filters);

  const sales = data?.data || [];
  const total = data?.total || 0;
  const page = data?.page || 1;
  const limit = data?.limit || 20;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filters.payment_method || 'all'}
          onValueChange={(v) => setFilters((f) => ({ ...f, payment_method: v === 'all' ? undefined : v, page: 1 }))}
        >
          <SelectTrigger className="w-[140px] bg-muted border-border text-foreground">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="wallet">Wallet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Items</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Payment</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No sales yet</p>
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {sale.invoice_number}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(sale.created_at), 'dd MMM yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {sale.member?.full_name || 'Walk-in'}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {sale._count?.items ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="bg-muted text-foreground text-xs">
                        {paymentMethodLabel[sale.payment_method] || sale.payment_method}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      ₹{Number(sale.total_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {onView && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onView(sale)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))}
              className="border-border"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}
              className="border-border"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
