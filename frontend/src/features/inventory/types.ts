export interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  _count?: { products: number };
}

export type ProductType =
  | 'physical'
  | 'digital'
  | 'service'
  | 'subscription'
  | 'consumable';

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  product_name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost_price: number;
  tax_rate: number;
  image_url: string | null;
  status: 'active' | 'inactive' | 'discontinued';
  product_type: ProductType;
  brand: string | null;
  unit_type: string | null;
  track_batches: boolean;
  category_id: string | null;
  branch_id: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  inventory?: InventoryRecord[] | InventoryRecord | null;
  images?: ProductImage[];
}

export interface AddProductImagePayload {
  image_url: string;
  alt_text?: string;
  is_primary?: boolean;
}

export type BatchStatus = 'active' | 'depleted' | 'expired';

export interface ProductBatch {
  id: string;
  product_id: string;
  branch_id: string;
  batch_number: string;
  quantity: number;
  cost_price: number;
  expiry_date: string | null;
  received_at: string;
  supplier_id: string | null;
  status: BatchStatus;
  created_at: string;
  updated_at: string;
  product?: { id: string; product_name: string; sku: string | null };
  branch?: { id: string; name: string } | null;
  // present only on the expiring-batches endpoint
  days_until_expiry?: number;
  is_expired?: boolean;
}

export interface CreateBatchPayload {
  product_id: string;
  branch_id: string;
  batch_number: string;
  quantity: number;
  cost_price?: number;
  expiry_date?: string;
  supplier_id?: string;
}

export interface AdjustBatchPayload {
  quantity: number; // positive add, negative remove
  reason?: string;
}

export interface BatchFilters {
  product_id?: string;
  branch_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ExpiringBatchFilters {
  branch_id?: string;
  days_ahead?: number;
}

// ── Stock transfers (Phase 3) ────────────────────────────────────

export type TransferStatus = 'pending' | 'in_transit' | 'received' | 'cancelled';

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  source_batch_id: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: number;
  product?: { id: string; product_name: string; sku: string | null };
}

export interface StockTransfer {
  id: string;
  transfer_number: string;
  from_branch_id: string;
  to_branch_id: string;
  status: TransferStatus;
  notes: string | null;
  initiated_by: string | null;
  received_by: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  from_branch?: { id: string; name: string } | null;
  to_branch?: { id: string; name: string } | null;
  items?: StockTransferItem[];
  _count?: { items: number };
}

export interface CreateTransferPayload {
  from_branch_id: string;
  to_branch_id: string;
  items: { product_id: string; quantity: number }[];
  notes?: string;
  initiated_by?: string;
}

export interface TransferFilters {
  from_branch_id?: string;
  to_branch_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// ── Per-branch pricing (Phase 3) ─────────────────────────────────

export interface BranchProductPrice {
  id: string;
  product_id: string;
  branch_id: string;
  price: number;
  tax_rate: number | null;
  created_at: string;
  updated_at: string;
  branch?: { id: string; name: string } | null;
}

export interface UpsertBranchPricePayload {
  product_id: string;
  branch_id: string;
  price: number;
  tax_rate?: number;
}

export interface InventoryRecord {
  id: string;
  product_id: string;
  branch_id: string;
  stock_quantity: number;
  reserved_quantity: number;
  reorder_level: number;
  last_updated: string | null;
  product?: {
    id: string;
    product_name: string;
    sku: string | null;
    barcode: string | null;
    price: number;
    cost_price: number;
    status: string;
    category?: { id: string; name: string } | null;
  };
  branch?: { id: string; name: string } | null;
  deficit?: number;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  branch_id: string;
  transaction_type: 'purchase' | 'sale' | 'adjustment' | 'return' | 'damage';
  quantity: number;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  product?: { id: string; product_name: string; sku: string | null };
  branch?: { id: string; name: string } | null;
}

export interface CreateProductPayload {
  product_name: string;
  description?: string;
  organization_id?: string;
  branch_id?: string;
  category_id?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost_price?: number;
  tax_rate?: number;
  image_url?: string;
  product_type?: ProductType;
  brand?: string;
  unit_type?: string;
  track_batches?: boolean;
  initial_stock?: number;
}

export interface UpdateProductPayload {
  product_name?: string;
  description?: string;
  category_id?: string;
  sku?: string;
  barcode?: string;
  price?: number;
  cost_price?: number;
  tax_rate?: number;
  image_url?: string;
  product_type?: ProductType;
  brand?: string;
  unit_type?: string;
  track_batches?: boolean;
  status?: 'active' | 'inactive' | 'discontinued';
}

export interface AdjustInventoryPayload {
  product_id: string;
  branch_id: string;
  quantity: number;
  transaction_type: 'adjustment' | 'damage' | 'return';
  notes?: string;
}

export interface ProductFilters {
  branch_id?: string;
  organization_id?: string;
  category_id?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface InventoryFilters {
  branch_id?: string;
  low_stock?: boolean;
  page?: number;
  limit?: number;
}

export interface TransactionFilters {
  product_id?: string;
  branch_id?: string;
  transaction_type?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  organization_id?: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string;
  is_active?: boolean;
}

// ── Bundles (Phase 5) ────────────────────────────────────────────

export interface BundleComponent {
  id: string;
  bundle_id: string;
  product_id: string;
  quantity: number;
  product?: {
    id: string;
    product_name: string;
    sku: string | null;
    price: number;
    tax_rate: number;
    track_batches: boolean;
  };
}

export interface Bundle {
  id: string;
  gym_id: string;
  organization_id: string | null;
  branch_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  tax_rate: number;
  image_url: string | null;
  status: 'active' | 'inactive' | 'discontinued';
  created_at: string;
  updated_at: string;
  items: BundleComponent[];
  branch?: { id: string; name: string } | null;
}

export interface BundleComponentPayload {
  product_id: string;
  quantity: number;
}

export interface CreateBundlePayload {
  name: string;
  description?: string;
  sku?: string;
  price: number;
  tax_rate?: number;
  image_url?: string;
  branch_id?: string;
  organization_id?: string;
  items: BundleComponentPayload[];
}

export interface UpdateBundlePayload {
  name?: string;
  description?: string;
  sku?: string;
  price?: number;
  tax_rate?: number;
  image_url?: string;
  status?: 'active' | 'inactive' | 'discontinued';
  items?: BundleComponentPayload[];
}

export interface BundleFilters {
  branch_id?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}
