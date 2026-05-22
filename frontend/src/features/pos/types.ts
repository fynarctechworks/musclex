export interface PosSaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  total_price: number;
  product?: { id: string; product_name: string; sku: string | null; barcode?: string | null };
}

export interface PosSale {
  id: string;
  invoice_number: string;
  branch_id: string;
  member_id: string | null;
  staff_id: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'upi' | 'wallet';
  status: string;
  points_earned?: number;
  points_redeemed?: number;
  wallet_amount?: number;
  created_at: string;
  updated_at: string;
  items?: PosSaleItem[];
  member?: { id: string; full_name: string; email?: string; phone?: string } | null;
  staff?: { id: string; full_name: string } | null;
  branch?: { id: string; name: string } | null;
  returns?: ProductReturn[];
  _count?: { items: number };
}

export interface ProductReturn {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  refund_amount: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'completed';
  processed_by: string | null;
  created_at: string;
  product?: { id: string; product_name: string };
  sale?: { id: string; invoice_number: string };
}

// Each item is either a standalone product or a bundle (mutually exclusive).
export type PosSaleItemPayload =
  | { product_id: string; quantity: number; bundle_id?: never }
  | { bundle_id: string; quantity: number; product_id?: never };

export interface CreatePosSalePayload {
  branch_id: string;
  member_id?: string;
  staff_id: string;
  items: PosSaleItemPayload[];
  payment_method: 'cash' | 'card' | 'upi' | 'wallet';
  discount_amount?: number;
  redeem_points?: number;
}

export interface CreateReturnPayload {
  sale_id: string;
  product_id: string;
  quantity: number;
  reason?: string;
  processed_by?: string;
}

export interface DailySalesReport {
  date: string;
  branch_id: string;
  total_sales: number;
  total_revenue: number;
  total_tax: number;
  total_discount: number;
  net_revenue: number;
  payment_breakdown: Record<string, { count: number; amount: number }>;
}

export interface TopSellingProduct {
  product: { id: string; product_name: string; sku: string | null; price: number } | null;
  total_quantity_sold: number | null;
  total_revenue: number | null;
}

export interface SalesFilters {
  branch_id?: string;
  member_id?: string;
  staff_id?: string;
  payment_method?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedSales {
  data: PosSale[];
  total: number;
  page: number;
  limit: number;
}

// Cart types for POS UI state. A cart item is either a standalone product or
// a bundle. `key` is the stable identity for cart operations (product id, or
// `bundle:<id>` for bundles). One of product_id / bundle_id is set.
export interface CartItem {
  key: string;
  kind: 'product' | 'bundle';
  product_id?: string;
  bundle_id?: string;
  product_name: string; // display name (product or bundle)
  price: number;
  tax_rate: number;
  quantity: number;
  // For products: branch stock. For bundles: max sellable units (min of component availability)
  // or Infinity when we can't cheaply pre-compute it. UI uses this to cap +.
  stock_quantity: number;
}
