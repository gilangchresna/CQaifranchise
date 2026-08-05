-- Add missing POS fields to sales_transactions

-- Payment method (cash, card, qrcode, e-wallet)
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';

-- Customer ID for loyalty tracking
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100);

-- Staff/cashier ID who processed the transaction
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS staff_id VARCHAR(100);

-- Discount amount applied
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;

-- Tax amount (PPN)
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS tax DECIMAL(10,2) DEFAULT 0;

-- Cost of goods sold (for profit calculation)
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) DEFAULT 0;

-- Net amount (after discount and tax)
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10,2);

-- Update trigger to calculate net_amount
CREATE OR REPLACE FUNCTION calculate_net_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.net_amount IS NULL THEN
    NEW.net_amount := COALESCE(NEW.amount, 0) - COALESCE(NEW.discount, 0) - COALESCE(NEW.tax, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_net_amount ON sales_transactions;
CREATE TRIGGER set_net_amount
  BEFORE INSERT OR UPDATE ON sales_transactions
  FOR EACH ROW EXECUTE FUNCTION calculate_net_amount();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales_transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON sales_transactions(staff_id);

-- RLS policies for new fields
DROP POLICY IF EXISTS "Public can read sales" ON sales_transactions;
CREATE POLICY "Public can read sales"
  ON sales_transactions FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert sales" ON sales_transactions;
CREATE POLICY "Authenticated can insert sales"
  ON sales_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON COLUMN sales_transactions.payment_method IS 'Payment method: cash, card, qrcode, ewallet, gofood, grabfood';
COMMENT ON COLUMN sales_transactions.customer_id IS 'Customer ID for loyalty/CRM tracking';
COMMENT ON COLUMN sales_transactions.staff_id IS 'Staff/cashier ID who processed transaction';
COMMENT ON COLUMN sales_transactions.discount IS 'Discount amount in S$';
COMMENT ON COLUMN sales_transactions.tax IS 'Tax amount (PPN) in S$';
COMMENT ON COLUMN sales_transactions.cost IS 'Cost of goods sold for profit calculation';
COMMENT ON COLUMN sales_transactions.net_amount IS 'Net amount after discount and tax';
