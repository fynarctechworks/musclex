import { apiClient } from '@/services/api-client';
import type {
  PosSale,
  ProductReturn,
  DailySalesReport,
  TopSellingProduct,
  CreatePosSalePayload,
  CreateReturnPayload,
  SalesFilters,
  PaginatedSales,
} from './types';

export const posApi = {
  createSale: (data: CreatePosSalePayload) =>
    apiClient.post<PosSale>('/pos/sales', data),

  getSales: (filters?: SalesFilters) =>
    apiClient.get<PaginatedSales>('/pos/sales', { params: filters }),

  getSale: (id: string) =>
    apiClient.get<PosSale>(`/pos/sales/${id}`),

  getDailyReport: (branchId: string, date?: string) =>
    apiClient.get<DailySalesReport>('/pos/sales/daily-report', {
      params: { branch_id: branchId, date },
    }),

  getTopProducts: (filters?: { branch_id?: string; start_date?: string; end_date?: string; limit?: number }) =>
    apiClient.get<TopSellingProduct[]>('/pos/sales/top-products', { params: filters }),

  createReturn: (data: CreateReturnPayload) =>
    apiClient.post<ProductReturn>('/pos/returns', data),
};
