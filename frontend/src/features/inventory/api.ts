import { apiClient } from '@/services/api-client';
import type {
  Product,
  ProductImage,
  AddProductImagePayload,
  ProductCategory,
  InventoryRecord,
  InventoryTransaction,
  ProductBatch,
  CreateProductPayload,
  UpdateProductPayload,
  AdjustInventoryPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateBatchPayload,
  AdjustBatchPayload,
  StockTransfer,
  CreateTransferPayload,
  TransferFilters,
  BranchProductPrice,
  UpsertBranchPricePayload,
  Bundle,
  CreateBundlePayload,
  UpdateBundlePayload,
  BundleFilters,
  ProductFilters,
  InventoryFilters,
  TransactionFilters,
  BatchFilters,
  ExpiringBatchFilters,
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

  // ── Product images (gallery) ──────────────────────────────
  getProductImages: (productId: string) =>
    apiClient.get<ProductImage[]>(`/products/${productId}/images`),

  addProductImage: (productId: string, data: AddProductImagePayload) =>
    apiClient.post<ProductImage>(`/products/${productId}/images`, data),

  setPrimaryProductImage: (productId: string, imageId: string) =>
    apiClient.patch<ProductImage>(`/products/${productId}/images/${imageId}/primary`, {}),

  reorderProductImages: (productId: string, imageIds: string[]) =>
    apiClient.patch<ProductImage[]>(`/products/${productId}/images/reorder`, {
      image_ids: imageIds,
    }),

  removeProductImage: (productId: string, imageId: string) =>
    apiClient.delete<{ success: boolean }>(`/products/${productId}/images/${imageId}`),

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

  // ── Batches (FIFO / expiry) ───────────────────────────────
  getBatches: (filters?: BatchFilters) =>
    apiClient.get<PaginatedResponse<ProductBatch>>('/batches', { params: filters }),

  getExpiringBatches: (filters?: ExpiringBatchFilters) =>
    apiClient.get<ProductBatch[]>('/batches/expiring', { params: filters }),

  createBatch: (data: CreateBatchPayload) =>
    apiClient.post<ProductBatch>('/batches', data),

  adjustBatch: (id: string, data: AdjustBatchPayload) =>
    apiClient.patch<ProductBatch>(`/batches/${id}/adjust`, data),

  // ── Stock transfers (Phase 3) ─────────────────────────────
  getTransfers: (filters?: TransferFilters) =>
    apiClient.get<PaginatedResponse<StockTransfer>>('/transfers', { params: filters }),

  getTransfer: (id: string) =>
    apiClient.get<StockTransfer>(`/transfers/${id}`),

  createTransfer: (data: CreateTransferPayload) =>
    apiClient.post<StockTransfer>('/transfers', data),

  receiveTransfer: (id: string, received_by?: string) =>
    apiClient.patch<StockTransfer>(`/transfers/${id}/receive`, received_by ? { received_by } : {}),

  cancelTransfer: (id: string) =>
    apiClient.patch<StockTransfer>(`/transfers/${id}/cancel`, {}),

  // ── Per-branch pricing (Phase 3) ──────────────────────────
  getBranchPrices: (productId: string) =>
    apiClient.get<BranchProductPrice[]>(`/products/${productId}/branch-prices`),

  upsertBranchPrice: (data: UpsertBranchPricePayload) =>
    apiClient.post<BranchProductPrice>('/branch-prices', data),

  deleteBranchPrice: (productId: string, branchId: string) =>
    apiClient.delete<{ deleted: boolean }>(`/products/${productId}/branch-prices/${branchId}`),

  // ── Bundles (Phase 5) ─────────────────────────────────────
  getBundles: (filters?: BundleFilters) =>
    apiClient.get<PaginatedResponse<Bundle>>('/bundles', { params: filters }),

  getBundle: (id: string) =>
    apiClient.get<Bundle>(`/bundles/${id}`),

  createBundle: (data: CreateBundlePayload) =>
    apiClient.post<Bundle>('/bundles', data),

  updateBundle: (id: string, data: UpdateBundlePayload) =>
    apiClient.patch<Bundle>(`/bundles/${id}`, data),

  deleteBundle: (id: string) =>
    apiClient.delete<Bundle>(`/bundles/${id}`),
};
