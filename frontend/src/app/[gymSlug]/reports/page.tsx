'use client';

import { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  ChevronDown,
  ShoppingCart,
  IndianRupee,
  Package,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader, AccessDenied, KPICard, EmptyState } from '@/components/shared';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useSales, useDailyReport, useTopProducts } from '@/features/pos';
import { useInventory, useLowStock, useExpiringBatches } from '@/features/inventory';
import { useAuthStore } from '@/stores/auth-store';
import { exportReport, type ExportFormat, type ReportColumn } from '@/features/reports/utils/export';
import { ReportTable } from '@/features/reports/components/ReportTable';
import { toast } from 'sonner';
import type { PosSale, TopSellingProduct } from '@/features/pos/types';
import type { InventoryRecord, ProductBatch } from '@/features/inventory/types';

type StoreReportTab = 'overview' | 'sales' | 'products' | 'inventory';

interface BuiltExport {
  title: string;
  filename: string;
  columns: ReportColumn<Record<string, unknown>>[];
  rows: Record<string, unknown>[];
  totals?: Record<string, string | number>;
}

export default function ReportsPage() {
  const { allowed, checked } = useRequirePermission('reports', 'view', 'deny');
  const { activeBranchId } = useAuthStore();
  const [activeTab, setActiveTab] = useState<StoreReportTab>('overview');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const branchId = activeBranchId || undefined;

  const sales = useSales({
    branch_id: branchId,
    start_date: startDate,
    end_date: endDate,
    limit: 100,
  });
  const dailyReport = useDailyReport(activeBranchId || '', endDate);
  const topProducts = useTopProducts({
    branch_id: branchId,
    start_date: startDate,
    end_date: endDate,
    limit: 20,
  });
  const inventory = useInventory({ branch_id: branchId, limit: 200 });
  const lowStock = useLowStock(branchId);
  const expiring = useExpiringBatches({ branch_id: branchId, days_ahead: 30 });

  const salesRows: PosSale[] = useMemo(
    () => (sales.data?.data ?? []) as PosSale[],
    [sales.data],
  );

  const periodTotals = useMemo(() => {
    const totalSales = salesRows.length;
    const totalRevenue = salesRows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    const totalTax = salesRows.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
    const totalDiscount = salesRows.reduce((s, r) => s + Number(r.discount_amount ?? 0), 0);
    const netRevenue = totalRevenue - totalTax;
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    return { totalSales, totalRevenue, totalTax, totalDiscount, netRevenue, avgTicket };
  }, [salesRows]);

  const inventoryRows: InventoryRecord[] = useMemo(
    () => (inventory.data?.data ?? []) as InventoryRecord[],
    [inventory.data],
  );

  const stockValue = useMemo(
    () =>
      inventoryRows.reduce(
        (s, r) => s + Number(r.stock_quantity ?? 0) * Number(r.product?.cost_price ?? 0),
        0,
      ),
    [inventoryRows],
  );

  const buildExport = (tab: StoreReportTab): BuiltExport | null => {
    const period = `${startDate} to ${endDate}`;

    if (tab === 'overview') {
      const breakdown = dailyReport.data?.payment_breakdown ?? {};
      return {
        title: 'Store Overview',
        filename: `store-overview-${startDate}-to-${endDate}`,
        columns: [
          { key: 'metric', label: 'Metric' },
          { key: 'value', label: 'Value', numeric: true },
        ],
        rows: [
          { metric: 'Period', value: period },
          { metric: 'Total Sales', value: periodTotals.totalSales },
          { metric: 'Total Revenue', value: `₹${periodTotals.totalRevenue.toLocaleString()}` },
          { metric: 'Net Revenue (ex-tax)', value: `₹${periodTotals.netRevenue.toLocaleString()}` },
          { metric: 'Total Tax', value: `₹${periodTotals.totalTax.toLocaleString()}` },
          { metric: 'Total Discount', value: `₹${periodTotals.totalDiscount.toLocaleString()}` },
          { metric: 'Average Ticket', value: `₹${periodTotals.avgTicket.toFixed(2)}` },
          { metric: 'Stock Value (at cost)', value: `₹${stockValue.toLocaleString()}` },
          { metric: 'Low-Stock Items', value: (lowStock.data ?? []).length },
          ...Object.entries(breakdown).map(([m, v]) => ({
            metric: `Payment — ${m}`,
            value: `${v.count} × ₹${Number(v.amount).toLocaleString()}`,
          })),
        ] as Record<string, unknown>[],
      };
    }

    if (tab === 'sales') {
      return {
        title: `Sales Report — ${period}`,
        filename: `sales-report-${startDate}-to-${endDate}`,
        columns: [
          { key: 'invoice_number', label: 'Invoice' },
          { key: 'created_at', label: 'Date', format: (r) => format(new Date(String((r as { created_at: string }).created_at)), 'yyyy-MM-dd HH:mm') },
          { key: 'customer', label: 'Customer', format: (r) => (r as { member?: { full_name: string } }).member?.full_name ?? 'Walk-in' },
          { key: 'items_count', label: 'Items', numeric: true },
          { key: 'payment_method', label: 'Payment' },
          { key: 'subtotal', label: 'Subtotal (₹)', numeric: true, format: (r) => `₹${Number((r as { subtotal: number }).subtotal).toLocaleString()}` },
          { key: 'tax_amount', label: 'Tax (₹)', numeric: true, format: (r) => `₹${Number((r as { tax_amount: number }).tax_amount).toLocaleString()}` },
          { key: 'discount_amount', label: 'Discount (₹)', numeric: true, format: (r) => `₹${Number((r as { discount_amount: number }).discount_amount).toLocaleString()}` },
          { key: 'total_amount', label: 'Total (₹)', numeric: true, format: (r) => `₹${Number((r as { total_amount: number }).total_amount).toLocaleString()}` },
          { key: 'status', label: 'Status' },
        ],
        rows: salesRows.map((s) => ({
          ...s,
          items_count: s._count?.items ?? s.items?.length ?? 0,
        })) as unknown as Record<string, unknown>[],
        totals: {
          invoice_number: 'Total',
          created_at: '',
          customer: '',
          items_count: '',
          payment_method: '',
          subtotal: '',
          tax_amount: `₹${periodTotals.totalTax.toLocaleString()}`,
          discount_amount: `₹${periodTotals.totalDiscount.toLocaleString()}`,
          total_amount: `₹${periodTotals.totalRevenue.toLocaleString()}`,
          status: '',
        },
      };
    }

    if (tab === 'products') {
      const rows = (topProducts.data ?? []) as TopSellingProduct[];
      const totalQty = rows.reduce((s, r) => s + Number(r.total_quantity_sold ?? 0), 0);
      const totalRev = rows.reduce((s, r) => s + Number(r.total_revenue ?? 0), 0);
      return {
        title: `Top Products — ${period}`,
        filename: `top-products-${startDate}-to-${endDate}`,
        columns: [
          { key: 'product_name', label: 'Product', format: (r) => (r as unknown as TopSellingProduct).product?.product_name ?? '—' },
          { key: 'sku', label: 'SKU', format: (r) => (r as unknown as TopSellingProduct).product?.sku ?? '—' },
          { key: 'price', label: 'Unit Price (₹)', numeric: true, format: (r) => `₹${Number((r as unknown as TopSellingProduct).product?.price ?? 0).toLocaleString()}` },
          { key: 'total_quantity_sold', label: 'Qty Sold', numeric: true },
          { key: 'total_revenue', label: 'Revenue (₹)', numeric: true, format: (r) => `₹${Number((r as unknown as TopSellingProduct).total_revenue ?? 0).toLocaleString()}` },
        ],
        rows: rows as unknown as Record<string, unknown>[],
        totals: {
          product_name: 'Total',
          sku: '',
          price: '',
          total_quantity_sold: totalQty.toLocaleString(),
          total_revenue: `₹${totalRev.toLocaleString()}`,
        },
      };
    }

    if (tab === 'inventory') {
      const rows = inventoryRows;
      return {
        title: 'Inventory Report',
        filename: `inventory-report-${endDate}`,
        columns: [
          { key: 'product_name', label: 'Product', format: (r) => (r as unknown as InventoryRecord).product?.product_name ?? '—' },
          { key: 'sku', label: 'SKU', format: (r) => (r as unknown as InventoryRecord).product?.sku ?? '—' },
          { key: 'category', label: 'Category', format: (r) => (r as unknown as InventoryRecord).product?.category?.name ?? '—' },
          { key: 'stock_quantity', label: 'In Stock', numeric: true },
          { key: 'reserved_quantity', label: 'Reserved', numeric: true },
          { key: 'reorder_level', label: 'Reorder At', numeric: true },
          { key: 'cost_price', label: 'Cost (₹)', numeric: true, format: (r) => `₹${Number((r as unknown as InventoryRecord).product?.cost_price ?? 0).toLocaleString()}` },
          { key: 'stock_value', label: 'Stock Value (₹)', numeric: true, format: (r) => {
            const rec = r as unknown as InventoryRecord;
            const v = Number(rec.stock_quantity ?? 0) * Number(rec.product?.cost_price ?? 0);
            return `₹${v.toLocaleString()}`;
          } },
        ],
        rows: rows as unknown as Record<string, unknown>[],
        totals: {
          product_name: 'Total',
          sku: '',
          category: '',
          stock_quantity: rows.reduce((s, r) => s + Number(r.stock_quantity ?? 0), 0).toLocaleString(),
          reserved_quantity: rows.reduce((s, r) => s + Number(r.reserved_quantity ?? 0), 0).toLocaleString(),
          reorder_level: '',
          cost_price: '',
          stock_value: `₹${stockValue.toLocaleString()}`,
        },
      };
    }

    return null;
  };

  const handleExport = (fmt: ExportFormat) => {
    const built = buildExport(activeTab);
    if (!built || built.rows.length === 0) {
      toast.error('No data to export for the selected period');
      return;
    }
    try {
      exportReport(fmt, {
        title: built.title,
        filename: built.filename,
        subtitle: `Generated ${format(new Date(), 'PPpp')}`,
        columns: built.columns,
        rows: built.rows,
        totals: built.totals,
      });
      if (fmt !== 'print') toast.success(`Exported as ${fmt.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="reports" />
      </AppLayout>
    );
  }

  const lowStockRows = (lowStock.data ?? []) as InventoryRecord[];
  const expiringRows = (expiring.data ?? []) as ProductBatch[];
  const paymentBreakdown = dailyReport.data?.payment_breakdown ?? {};

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Store Reports"
          description="Sales, products, and inventory insights for your store"
          actions={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-36 h-9"
                  aria-label="Start date"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-36 h-9"
                  aria-label="End date"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => handleExport('xls')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-success" />
                    Excel (.xls)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    <FileText className="h-4 w-4 mr-2 text-link" />
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('print')}>
                    <Printer className="h-4 w-4 mr-2 text-muted-foreground" />
                    Print
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StoreReportTab)}>
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="products">Top Products</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="Total Sales"
                value={periodTotals.totalSales.toLocaleString()}
                icon={ShoppingCart}
              />
              <KPICard
                label="Total Revenue"
                value={`₹${periodTotals.totalRevenue.toLocaleString()}`}
                icon={IndianRupee}
              />
              <KPICard
                label="Avg Ticket"
                value={`₹${periodTotals.avgTicket.toFixed(0)}`}
                icon={TrendingUp}
              />
              <KPICard
                label="Stock Value"
                value={`₹${stockValue.toLocaleString()}`}
                icon={Package}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2">
                <h3 className="text-sm font-semibold mb-4">Payment Method Breakdown (Today)</h3>
                {Object.keys(paymentBreakdown).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales recorded today.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {Object.entries(paymentBreakdown).map(([method, val]) => (
                      <li
                        key={method}
                        className="flex justify-between border-b border-hairline pb-2 last:border-0"
                      >
                        <span className="capitalize text-muted-foreground">{method}</span>
                        <span className="font-medium">
                          {val.count} × ₹{Number(val.amount).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Stock & Tax Snapshot
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Low-stock items</span>
                    <span className="font-medium">{lowStockRows.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Batches expiring in 30 days</span>
                    <span className="font-medium">{expiringRows.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Tax (period)</span>
                    <span className="font-medium">₹{periodTotals.totalTax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Discount (period)</span>
                    <span className="font-medium">₹{periodTotals.totalDiscount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sales">
            <ReportTable<PosSale>
              title="Sales Transactions"
              description="Every POS sale in the selected period"
              searchable
              paginated
              isLoading={sales.isLoading}
              isError={sales.isError}
              rows={salesRows}
              rowKey={(r) => r.id}
              columns={[
                { key: 'invoice_number', label: 'Invoice' },
                {
                  key: 'created_at',
                  label: 'Date',
                  format: (r) => format(new Date(r.created_at), 'yyyy-MM-dd HH:mm'),
                },
                {
                  key: 'member',
                  label: 'Customer',
                  format: (r) => r.member?.full_name ?? 'Walk-in',
                },
                { key: 'payment_method', label: 'Payment' },
                {
                  key: 'total_amount',
                  label: 'Total',
                  numeric: true,
                  format: (r) => `₹${Number(r.total_amount).toLocaleString()}`,
                },
                { key: 'status', label: 'Status' },
              ]}
            />
          </TabsContent>

          <TabsContent value="products">
            <ReportTable<TopSellingProduct>
              title="Top Selling Products"
              description="Ranked by units sold in the period"
              paginated
              isLoading={topProducts.isLoading}
              isError={topProducts.isError}
              rows={(topProducts.data ?? []) as TopSellingProduct[]}
              rowKey={(r, i) => r.product?.id ?? i}
              columns={[
                {
                  key: 'product_name',
                  label: 'Product',
                  format: (r) => r.product?.product_name ?? '—',
                },
                { key: 'sku', label: 'SKU', format: (r) => r.product?.sku ?? '—' },
                {
                  key: 'price',
                  label: 'Unit Price',
                  numeric: true,
                  format: (r) => `₹${Number(r.product?.price ?? 0).toLocaleString()}`,
                },
                { key: 'total_quantity_sold', label: 'Qty Sold', numeric: true },
                {
                  key: 'total_revenue',
                  label: 'Revenue',
                  numeric: true,
                  format: (r) => `₹${Number(r.total_revenue ?? 0).toLocaleString()}`,
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <ReportTable<InventoryRecord>
              title="Stock Levels"
              description="Current inventory across products"
              searchable
              paginated
              isLoading={inventory.isLoading}
              isError={inventory.isError}
              rows={inventoryRows}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: 'product_name',
                  label: 'Product',
                  format: (r) => r.product?.product_name ?? '—',
                },
                { key: 'sku', label: 'SKU', format: (r) => r.product?.sku ?? '—' },
                {
                  key: 'category',
                  label: 'Category',
                  format: (r) => r.product?.category?.name ?? '—',
                },
                { key: 'stock_quantity', label: 'In Stock', numeric: true },
                { key: 'reserved_quantity', label: 'Reserved', numeric: true },
                { key: 'reorder_level', label: 'Reorder At', numeric: true },
              ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Low Stock ({lowStockRows.length})
                </h3>
                {lowStockRows.length === 0 ? (
                  <EmptyState title="All stocked up" description="No items below reorder level." />
                ) : (
                  <ul className="space-y-2 text-sm max-h-72 overflow-auto">
                    {lowStockRows.slice(0, 20).map((r) => (
                      <li
                        key={r.id}
                        className="flex justify-between border-b border-hairline pb-2 last:border-0"
                      >
                        <span>{r.product?.product_name ?? '—'}</span>
                        <span className="text-error font-medium">
                          {r.stock_quantity} / {r.reorder_level}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Expiring Soon ({expiringRows.length})
                </h3>
                {expiringRows.length === 0 ? (
                  <EmptyState title="Nothing expiring" description="No batches expiring in the next 30 days." />
                ) : (
                  <ul className="space-y-2 text-sm max-h-72 overflow-auto">
                    {expiringRows.slice(0, 20).map((b) => (
                      <li
                        key={b.id}
                        className="flex justify-between border-b border-hairline pb-2 last:border-0"
                      >
                        <span>
                          {b.product?.product_name ?? '—'}{' '}
                          <span className="text-muted-foreground">#{b.batch_number}</span>
                        </span>
                        <span className="text-warning font-medium">
                          {b.days_until_expiry ?? '—'}d
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
