-- ============================================================
-- Financial Statements Tables
-- For credit assessment and financial document management
-- ============================================================

-- Financial Documents Table
CREATE TABLE IF NOT EXISTS financial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Document classification
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'ACRA_ANNUAL', 'ACRA_BIZFILE', 'PNL', 'BALANCE_SHEET', 
    'CASH_FLOW', 'TAX_ASSESSMENT', 'GST_RETURN', 'OTHER'
  )),
  document_subtype VARCHAR(50) DEFAULT 'MANAGEMENT',
  
  -- File information
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100) DEFAULT 'application/pdf',
  
  -- Fiscal period
  fiscal_year VARCHAR(10),
  reporting_period_start DATE,
  reporting_period_end DATE,
  
  -- Extraction results (JSONB for flexibility)
  extracted_data JSONB DEFAULT '{}',
  
  -- Key financial metrics
  revenue DECIMAL(15,2),
  cost_of_goods_sold DECIMAL(15,2),
  gross_profit DECIMAL(15,2),
  operating_expenses DECIMAL(15,2),
  net_profit DECIMAL(15,2),
  total_assets DECIMAL(15,2),
  total_liabilities DECIMAL(15,2),
  shareholders_equity DECIMAL(15,2),
  
  -- Calculated ratios
  gross_margin DECIMAL(5,2),
  net_margin DECIMAL(5,2),
  current_ratio DECIMAL(5,2),
  debt_ratio DECIMAL(5,2),
  roa DECIMAL(5,2),
  roe DECIMAL(5,2),
  
  -- Confidence score (AI extraction quality, 0-1)
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  
  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_docs_user ON financial_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_docs_type ON financial_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_financial_docs_fiscal_year ON financial_documents(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_financial_docs_revenue ON financial_documents(revenue);
CREATE INDEX IF NOT EXISTS idx_financial_docs_created ON financial_documents(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_financial_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_financial_docs_updated_at ON financial_documents;
CREATE TRIGGER trigger_financial_docs_updated_at
  BEFORE UPDATE ON financial_documents
  FOR EACH ROW EXECUTE FUNCTION update_financial_docs_updated_at();

-- ============================================================
-- Financial Metrics Snapshot (aggregated metrics over time)
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_metrics_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Period classification
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
  fiscal_year VARCHAR(10),
  
  -- Income Statement Metrics
  revenue DECIMAL(15,2),
  cost_of_goods_sold DECIMAL(15,2),
  gross_profit DECIMAL(15,2),
  operating_expenses DECIMAL(15,2),
  operating_profit DECIMAL(15,2),
  net_profit DECIMAL(15,2),
  
  -- Profitability Ratios
  gross_margin DECIMAL(5,2),
  net_margin DECIMAL(5,2),
  roa DECIMAL(5,2),
  roe DECIMAL(5,2),
  
  -- Balance Sheet Metrics
  total_assets DECIMAL(15,2),
  current_assets DECIMAL(15,2),
  fixed_assets DECIMAL(15,2),
  total_liabilities DECIMAL(15,2),
  current_liabilities DECIMAL(15,2),
  long_term_liabilities DECIMAL(15,2),
  shareholders_equity DECIMAL(15,2),
  
  -- Liquidity Ratios
  current_ratio DECIMAL(5,2),
  quick_ratio DECIMAL(5,2),
  
  -- Leverage Ratios
  debt_ratio DECIMAL(5,2),
  debt_to_equity DECIMAL(5,2),
  
  -- Source document reference
  source_document_id UUID REFERENCES financial_documents(id) ON DELETE SET NULL,
  
  -- Confidence score
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one snapshot per user/period/year
  UNIQUE(user_id, period_type, fiscal_year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_metrics_user ON financial_metrics_snapshot(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON financial_metrics_snapshot(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_metrics_fiscal_year ON financial_metrics_snapshot(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_metrics_revenue ON financial_metrics_snapshot(revenue);

-- ============================================================
-- RLS Policies
-- ============================================================

-- Enable RLS
ALTER TABLE financial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_metrics_snapshot ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own documents
CREATE POLICY financial_docs_owner_policy ON financial_documents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY financial_metrics_owner_policy ON financial_metrics_snapshot
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Comments for documentation
-- ============================================================

COMMENT ON TABLE financial_documents IS 'Uploaded financial documents with extracted metrics';
COMMENT ON TABLE financial_metrics_snapshot IS 'Aggregated financial metrics over time for trend analysis';
COMMENT ON COLUMN financial_documents.confidence_score IS 'AI extraction confidence (0=low, 1=high)';
COMMENT ON COLUMN financial_documents.document_type IS 'ACRA_ANNUAL=ACRA filing, PNL=Profit&Loss, BALANCE_SHEET=Balance Sheet, TAX_ASSESSMENT=IRAS Notice';
