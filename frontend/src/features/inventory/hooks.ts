import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { inventoryApi } from './api';
import { toast } from 'sonner';
import type {
  CreateProductPayload,
  UpdateProductPayload,
  AdjustInventoryPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  ProductFilters,
  InventoryFilters,
  TransactionFilters,
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
