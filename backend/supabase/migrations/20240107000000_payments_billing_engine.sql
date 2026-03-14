-- Migration: Payments, Billing & Financial Engine
-- Creates tables for member invoices, invoice items, payment gateway configs,
-- refunds, discounts, tax rates, financial transactions, and payment retry logs.
-- Also adds invoice_id FK column to existing payments table.

-- ============================================================
-- Discounts (must be before member_invoices since it's referenced)
-- ============================================================
CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) UNIQUE,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
  value DECIMAL(10,2) NOT NULL,
  min_purchase DECIMAL(10,2),
  max_discount DECIMAL(10,2),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  applicable_to VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discounts_code ON discounts(code);
CREATE INDEX idx_discounts_active ON discounts(is_active);

-- ============================================================
-- Tax Rates (must be before member_invoices since it's referenced)
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  tax_name VARCHAR(100) NOT NULL,
  rate DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_rates_country ON tax_rates(country);

-- ============================================================
-- Member Invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS member_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL,
  tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_invoices_member ON member_invoices(member_id);
CREATE INDEX idx_member_invoices_branch_date ON member_invoices(branch_id, created_at);
CREATE INDEX idx_member_invoices_status ON member_invoices(status);
CREATE INDEX idx_member_invoices_number ON member_invoices(invoice_number);

-- ============================================================
-- Invoice Items
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES member_invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL,
  item_id UUID,
  description TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ============================================================
-- Payment Gateway Configs
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_gateway_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_name VARCHAR(50) UNIQUE NOT NULL,
  api_key TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  webhook_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_test_mode BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Alter existing payments table — add invoice_id FK
-- ============================================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES member_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- ============================================================
-- Refunds
-- ============================================================
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  refund_amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  gateway_refund_id VARCHAR(255),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_member ON refunds(member_id);

-- ============================================================
-- Financial Transactions (Ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  reference_type VARCHAR(50) NOT NULL,
  reference_id UUID NOT NULL,
  transaction_type VARCHAR(10) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_txns_branch ON financial_transactions(branch_id);
CREATE INDEX idx_financial_txns_ref ON financial_transactions(reference_type, reference_id);
CREATE INDEX idx_financial_txns_created ON financial_transactions(created_at);

-- ============================================================
-- Payment Retry Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_retry_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  attempt INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'failed',
  error_message TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_retry_payment ON payment_retry_logs(payment_id);
CREATE INDEX idx_payment_retry_member ON payment_retry_logs(member_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER set_updated_at_member_invoices
  BEFORE UPDATE ON member_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_discounts
  BEFORE UPDATE ON discounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_tax_rates
  BEFORE UPDATE ON tax_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_payment_gateway_configs
  BEFORE UPDATE ON payment_gateway_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
