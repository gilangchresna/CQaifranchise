-- POS Webhook Fields - Phase 1 & 2
-- Add payment, people, and financial fields

ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'dine_in';
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS staff_id VARCHAR(100);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS tax DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS net_amount DECIMAL(12,2);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS platform VARCHAR(50);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS platform_order_id VARCHAR(100);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS settlement_amount DECIMAL(12,2);

CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales_transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON sales_transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_platform ON sales_transactions(platform);
CREATE INDEX IF NOT EXISTS idx_sales_net_amount ON sales_transactions(net_amount);
