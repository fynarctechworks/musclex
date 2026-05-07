'use client';

import React, { useState } from 'react';
import { Package, Plus, Tags, ArrowUpDown } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { AccessDenied } from '@/components/shared/access-denied';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductTable } from '@/features/inventory/components/ProductTable';
import { StockTable } from '@/features/inventory/components/StockTable';
import { LowStockAlert } from '@/features/inventory/components/LowStockAlert';
import { ProductDialog } from '@/features/inventory/components/ProductDialog';
import { CategoryDialog } from '@/features/inventory/components/CategoryDialog';
import { useCategories } from '@/features/inventory/hooks';
import { useAuthStore } from '@/stores/auth-store';
import type { Product, ProductCategory } from '@/features/inventory/types';

export default function InventoryPage() {
  const { allowed, checked } = useRequirePermission('settings', 'view', 'deny');
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const branchId = activeBranchId || user?.branch_ids?.[0];
  const [tab, setTab] = useState('products');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<ProductCategory | null>(null);

  const { data: categories } = useCategories();

  const handleEditProduct = (product: Product) => {
    setEditProduct(product);
    setProductDialogOpen(true);
  };

  const handleCloseProductDialog = (open: boolean) => {
    if (!open) setEditProduct(null);
    setProductDialogOpen(open);
  };

  const handleEditCategory = (cat: ProductCategory) => {
    setEditCategory(cat);
    setCategoryDialogOpen(true);
  };

  const handleCloseCategoryDialog = (open: boolean) => {
    if (!open) setEditCategory(null);
    setCategoryDialogOpen(open);
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Inventory"
          description="Manage products, stock levels, and categories"
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCategoryDialogOpen(true)}
                className="border-border text-foreground"
              >
                <Tags className="mr-2 h-4 w-4" />
                Add Category
              </Button>
              <Button
                onClick={() => setProductDialogOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>
          }
        />

        {/* Low Stock Alert */}
        <LowStockAlert />

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted border border-border">
            <TabsTrigger value="products" className="data-[state=active]:bg-background data-[state=active]:text-foreground">
              <Package className="h-4 w-4 mr-1.5" />
              Products
            </TabsTrigger>
            <TabsTrigger value="stock" className="data-[state=active]:bg-background data-[state=active]:text-foreground">
              <ArrowUpDown className="h-4 w-4 mr-1.5" />
              Stock Levels
            </TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-background data-[state=active]:text-foreground">
              <Tags className="h-4 w-4 mr-1.5" />
              Categories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4">
            <ProductTable onEdit={handleEditProduct} />
          </TabsContent>

          <TabsContent value="stock" className="mt-4">
            <StockTable />
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <div className="space-y-3">
              {!categories || categories.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Tags className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No categories yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-border"
                    onClick={() => setCategoryDialogOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Category
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground">Products</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr key={cat.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{cat.description || '—'}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">
                            {cat._count?.products ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleEditCategory(cat)}
                            >
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={handleCloseProductDialog}
        product={editProduct}
        branchId={branchId}
      />
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={handleCloseCategoryDialog}
        category={editCategory}
      />
    </AppLayout>
  );
}
