-- Migration: Add system_status table for POS live indicator
-- Tracks last transaction timestamp to detect POS offline state

-- 1. Create system_status table (single row, upsert pattern)
CREATE TABLE IF NOT EXISTS system_status (
  id            BIGINT PRIMARY KEY DEFAULT 1,
  -- Always keep id=1 as the singleton status row
  CONSTRAINT single_row CHECK (id = 1),
  last_txn_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT last_txn_at_not_null CHECK (last_txn_at IS NOT NULL)
);

-- Insert initial row
INSERT INTO system_status (id, last_txn_at, updated_at)
VALUES (1, NOW() - INTERVAL '1 day', NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Create trigger function
CREATE OR REPLACE FUNCTION update_last_txn_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE system_status
  SET last_txn_at = NOW(),
      updated_at  = NOW()
  WHERE id = 1;

  -- If no row exists, insert one
  IF NOT FOUND THEN
    INSERT INTO system_status (id, last_txn_at, updated_at)
    VALUES (1, NOW(), NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to sales_transactions INSERT
DROP TRIGGER IF EXISTS trg_update_last_txn_at ON sales_transactions;
CREATE TRIGGER trg_update_last_txn_at
  AFTER INSERT ON sales_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_last_txn_at();

-- 4. RLS — allow anon read (dashboard fetches without auth on some pages)
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_status_read_all"
  ON system_status FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "system_status_update_service"
  ON system_status FOR UPDATE
  TO authenticated
  USING (auth.role() = 'service_role');

COMMENT ON TABLE system_status IS
  'Singleton table: id=1 always. last_txn_at = timestamp of most recent sales_transactions INSERT. Used by Dashboard to show POS Live/Offline indicator.';
