-- Migration: Inventory & POS System
-- Module 9: Product catalog, stock management, POS billing, supplier management

-- ══════════════════════════════════════════════════════════════════
-- Product Categories
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES studio_template.organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_categories_org ON studio_template.product_categories(organization_id);

-- ══════════════════════════════════════════════════════════════════
-- Products
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES studio_template.organizations(id),
    branch_id UUID REFERENCES studio_template.branches(id),
    category_id UUID REFERENCES studio_template.product_categories(id),
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100) UNIQUE,
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_org ON studio_template.products(organization_id);
CREATE INDEX idx_products_branch ON studio_template.products(branch_id);
CREATE INDEX idx_products_category ON studio_template.products(category_id);
CREATE INDEX idx_products_sku ON studio_template.products(sku);
CREATE INDEX idx_products_barcode ON studio_template.products(barcode);
CREATE INDEX idx_products_status ON studio_template.products(status);

-- ══════════════════════════════════════════════════════════════════
-- Inventory (1:1 with product per branch)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE REFERENCES studio_template.products(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES studio_template.branches(id),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 5,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_branch ON studio_template.inventory(branch_id);
CREATE INDEX idx_inventory_product ON studio_template.inventory(product_id);

-- ══════════════════════════════════════════════════════════════════
-- Inventory Transactions (audit trail)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES studio_template.products(id),
    branch_id UUID NOT NULL REFERENCES studio_template.branches(id),
    transaction_type VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_txn_product ON studio_template.inventory_transactions(product_id);
CREATE INDEX idx_inv_txn_branch ON studio_template.inventory_transactions(branch_id);
CREATE INDEX idx_inv_txn_type ON studio_template.inventory_transactions(transaction_type);
CREATE INDEX idx_inv_txn_created ON studio_template.inventory_transactions(created_at);

-- ══════════════════════════════════════════════════════════════════
-- Suppliers
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES studio_template.organizations(id),
    supplier_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_org ON studio_template.suppliers(organization_id);

-- ══════════════════════════════════════════════════════════════════
-- Purchase Orders
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES studio_template.suppliers(id),
    branch_id UUID NOT NULL REFERENCES studio_template.branches(id),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ordered_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_supplier ON studio_template.purchase_orders(supplier_id);
CREATE INDEX idx_po_branch ON studio_template.purchase_orders(branch_id);
CREATE INDEX idx_po_status ON studio_template.purchase_orders(status);
CREATE INDEX idx_po_order_number ON studio_template.purchase_orders(order_number);

-- ══════════════════════════════════════════════════════════════════
-- Purchase Order Items
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES studio_template.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES studio_template.products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    received_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_poi_order ON studio_template.purchase_order_items(purchase_order_id);
CREATE INDEX idx_poi_product ON studio_template.purchase_order_items(product_id);

-- ══════════════════════════════════════════════════════════════════
-- POS Sales
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.pos_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES studio_template.branches(id),
    member_id UUID REFERENCES studio_template.members(id),
    staff_id UUID NOT NULL REFERENCES studio_template.staff(id),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_sales_branch_date ON studio_template.pos_sales(branch_id, created_at);
CREATE INDEX idx_pos_sales_member ON studio_template.pos_sales(member_id);
CREATE INDEX idx_pos_sales_staff ON studio_template.pos_sales(staff_id);
CREATE INDEX idx_pos_sales_invoice ON studio_template.pos_sales(invoice_number);

-- ══════════════════════════════════════════════════════════════════
-- POS Sale Items
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.pos_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES studio_template.pos_sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES studio_template.products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_psi_sale ON studio_template.pos_sale_items(sale_id);
CREATE INDEX idx_psi_product ON studio_template.pos_sale_items(product_id);

-- ══════════════════════════════════════════════════════════════════
-- Product Returns
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.product_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES studio_template.pos_sales(id),
    product_id UUID NOT NULL REFERENCES studio_template.products(id),
    quantity INTEGER NOT NULL,
    refund_amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    processed_by UUID REFERENCES studio_template.staff(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_returns_sale ON studio_template.product_returns(sale_id);
CREATE INDEX idx_returns_product ON studio_template.product_returns(product_id);

-- ══════════════════════════════════════════════════════════════════
-- Triggers for updated_at
-- ══════════════════════════════════════════════════════════════════

CREATE TRIGGER set_updated_at_product_categories
    BEFORE UPDATE ON studio_template.product_categories
    FOR EACH ROW EXECUTE FUNCTION studio_template.set_updated_at();

CREATE TRIGGER set_updated_at_products
    BEFORE UPDATE ON studio_template.products
    FOR EACH ROW EXECUTE FUNCTION studio_template.set_updated_at();

CREATE TRIGGER set_updated_at_suppliers
    BEFORE UPDATE ON studio_template.suppliers
    FOR EACH ROW EXECUTE FUNCTION studio_template.set_updated_at();

CREATE TRIGGER set_updated_at_purchase_orders
    BEFORE UPDATE ON studio_template.purchase_orders
    FOR EACH ROW EXECUTE FUNCTION studio_template.set_updated_at();
