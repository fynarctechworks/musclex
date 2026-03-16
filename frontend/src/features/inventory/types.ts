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
  category_id: string | null;
  branch_id: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  inventory?: InventoryRecord[] | InventoryRecord | null;
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
