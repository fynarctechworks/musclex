import { apiClient } from '@/services/api-client';
import type {
  Product,
  ProductCategory,
  InventoryRecord,
  InventoryTransaction,
  CreateProductPayload,
  UpdateProductPayload,
  AdjustInventoryPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  ProductFilters,
  InventoryFilters,
  TransactionFilters,
  PaginatedResponse,
} from './types';

export const inventoryApi = {
  // ── Products ──────────────────────────────────────────────
  getProducts: (filters?: ProductFilters) =>
    apiClient.get<PaginatedResponse<Product>>('/products', { params: filters }),

  getProduct: (id: string) =>
    apiClient.get<Product>(`/products/${id}`),

  createProduct: (data: CreateProductPayload) =>
    apiClient.post<Product>('/products', data),

  updateProduct: (id: string, data: UpdateProductPayload) =>
    apiClient.patch<Product>(`/products/${id}`, data),

  getByBarcode: (barcode: string) =>
    apiClient.get<Product>(`/products/barcode/${barcode}`),

  getBySku: (sku: string) =>
    apiClient.get<Product>(`/products/sku/${sku}`),

  // ── Categories ────────────────────────────────────────────
  getCategories: (organizationId?: string) =>
    apiClient.get<ProductCategory[]>('/product-categories', {
      params: organizationId ? { organization_id: organizationId } : undefined,
    }),

  createCategory: (data: CreateCategoryPayload) =>
    apiClient.post<ProductCategory>('/product-categories', data),

  updateCategory: (id: string, data: UpdateCategoryPayload) =>
    apiClient.patch<ProductCategory>(`/product-categories/${id}`, data),

  // ── Inventory / Stock ─────────────────────────────────────
  getInventory: (filters?: InventoryFilters) =>
    apiClient.get<PaginatedResponse<InventoryRecord>>('/inventory', { params: filters }),

  adjustStock: (data: AdjustInventoryPayload) =>
    apiClient.post<InventoryRecord>('/inventory/adjust', data),

  setReorderLevel: (productId: string, reorder_level: number) =>
    apiClient.patch<InventoryRecord>(`/inventory/${productId}/reorder-level`, { reorder_level }),

  getTransactions: (filters?: TransactionFilters) =>
    apiClient.get<PaginatedResponse<InventoryTransaction>>('/inventory/transactions', { params: filters }),

  getLowStock: (branchId?: string) =>
    apiClient.get<InventoryRecord[]>('/inventory/low-stock', {
      params: branchId ? { branch_id: branchId } : undefined,
    }),
};
