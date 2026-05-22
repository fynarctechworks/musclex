import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { inventoryApi } from './api';
import { toast } from 'sonner';
import type {
  CreateProductPayload,
  UpdateProductPayload,
  AddProductImagePayload,
  AdjustInventoryPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateBatchPayload,
  AdjustBatchPayload,
  CreateTransferPayload,
  TransferFilters,
  UpsertBranchPricePayload,
  CreateBundlePayload,
  UpdateBundlePayload,
  BundleFilters,
  ProductFilters,
  InventoryFilters,
  TransactionFilters,
  BatchFilters,
  ExpiringBatchFilters,
} from './types';

// ── Products ──────────────────────────────────────────────────

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: queryKeys.inventory.products(filters),
    queryFn: () => inventoryApi.getProducts(filters),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.inventory.product(id),
    queryFn: () => inventoryApi.getProduct(id),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductPayload) => inventoryApi.createProduct(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Product created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductPayload }) =>
      inventoryApi.updateProduct(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Product updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Product images (gallery) ──────────────────────────────────

export function useProductImages(productId: string) {
  return useQuery({
    queryKey: queryKeys.inventory.productImages(productId),
    queryFn: () => inventoryApi.getProductImages(productId),
    enabled: !!productId,
  });
}

export function useAddProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: AddProductImagePayload }) =>
      inventoryApi.addProductImage(productId, data),
    onSuccess: (_res, { productId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.productImages(productId) });
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSetPrimaryProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, imageId }: { productId: string; imageId: string }) =>
      inventoryApi.setPrimaryProductImage(productId, imageId),
    onSuccess: (_res, { productId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.productImages(productId) });
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Primary image updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReorderProductImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, imageIds }: { productId: string; imageIds: string[] }) =>
      inventoryApi.reorderProductImages(productId, imageIds),
    onSuccess: (_res, { productId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.productImages(productId) });
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, imageId }: { productId: string; imageId: string }) =>
      inventoryApi.removeProductImage(productId, imageId),
    onSuccess: (_res, { productId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.productImages(productId) });
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Image removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Categories ────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.inventory.categories(),
    queryFn: () => inventoryApi.getCategories(),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryPayload) => inventoryApi.createCategory(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.categories() });
      toast.success('Category created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryPayload }) =>
      inventoryApi.updateCategory(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.categories() });
      toast.success('Category updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Inventory / Stock ─────────────────────────────────────────

export function useInventory(filters?: InventoryFilters) {
  return useQuery({
    queryKey: queryKeys.inventory.stock(filters),
    queryFn: () => inventoryApi.getInventory(filters),
  });
}

export function useLowStock(branchId?: string) {
  return useQuery({
    queryKey: queryKeys.inventory.lowStock(),
    queryFn: () => inventoryApi.getLowStock(branchId),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AdjustInventoryPayload) => inventoryApi.adjustStock(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Stock adjusted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSetReorderLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, reorder_level }: { productId: string; reorder_level: number }) =>
      inventoryApi.setReorderLevel(productId, reorder_level),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Reorder level updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useInventoryTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.inventory.transactions(filters),
    queryFn: () => inventoryApi.getTransactions(filters),
  });
}

// ── Batches (FIFO / expiry) ────────────────────────────────────

export function useBatches(filters?: BatchFilters) {
  return useQuery({
    queryKey: queryKeys.inventory.batches(filters),
    queryFn: () => inventoryApi.getBatches(filters),
  });
}

export function useExpiringBatches(filters?: ExpiringBatchFilters) {
  return useQuery({
    queryKey: queryKeys.inventory.expiringBatches(filters),
    queryFn: () => inventoryApi.getExpiringBatches(filters),
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBatchPayload) => inventoryApi.createBatch(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Batch added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAdjustBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdjustBatchPayload }) =>
      inventoryApi.adjustBatch(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Batch updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Stock transfers (Phase 3) ──────────────────────────────────

export function useTransfers(filters?: TransferFilters) {
  return useQuery({
    queryKey: queryKeys.inventory.transfers(filters),
    queryFn: () => inventoryApi.getTransfers(filters),
  });
}

export function useTransfer(id: string) {
  return useQuery({
    queryKey: queryKeys.inventory.transfer(id),
    queryFn: () => inventoryApi.getTransfer(id),
    enabled: !!id,
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransferPayload) => inventoryApi.createTransfer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Transfer dispatched');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReceiveTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, received_by }: { id: string; received_by?: string }) =>
      inventoryApi.receiveTransfer(id, received_by),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Transfer received');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.cancelTransfer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Transfer cancelled — stock returned to source');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Per-branch pricing (Phase 3) ───────────────────────────────

export function useBranchPrices(productId: string) {
  return useQuery({
    queryKey: queryKeys.inventory.branchPrices(productId),
    queryFn: () => inventoryApi.getBranchPrices(productId),
    enabled: !!productId,
  });
}

export function useUpsertBranchPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertBranchPricePayload) => inventoryApi.upsertBranchPrice(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Branch price saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBranchPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, branchId }: { productId: string; branchId: string }) =>
      inventoryApi.deleteBranchPrice(productId, branchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Branch price removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Bundles (Phase 5) ──────────────────────────────────────────

export function useBundles(filters?: BundleFilters) {
  return useQuery({
    queryKey: queryKeys.inventory.bundles(filters),
    queryFn: () => inventoryApi.getBundles(filters),
  });
}

export function useBundle(id: string) {
  return useQuery({
    queryKey: queryKeys.inventory.bundle(id),
    queryFn: () => inventoryApi.getBundle(id),
    enabled: !!id,
  });
}

export function useCreateBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBundlePayload) => inventoryApi.createBundle(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Bundle created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBundlePayload }) =>
      inventoryApi.updateBundle(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Bundle updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.deleteBundle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Bundle discontinued');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
