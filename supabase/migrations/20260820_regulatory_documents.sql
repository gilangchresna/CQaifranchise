-- Migration: regulatory_documents table
-- Purpose: Store regulatory filings uploaded by HQ for each franchisee
-- Date: 2026-08-20

CREATE TABLE IF NOT EXISTS public.regulatory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  uploaded_by_id UUID NOT NULL REFERENCES public.auth.users(id),
  country VARCHAR(3) NOT NULL, -- 'SGP' or 'IDN'
  document_type VARCHAR(50) NOT NULL,
  -- Singapore: 'SGP_ACRA_ANNUAL', 'SGP_ACRA_XBRL'
  -- Indonesia: 'IDN_AHU_ANNUAL', 'IDN_LKPM_Q1', 'IDN_LKPM_Q2', 'IDN_LKPM_Q3', 'IDN_LKPM_Q4', 'IDN_DJP_SPT'
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  fiscal_year VARCHAR(10),
  period VARCHAR(10), -- 'Q1_2026', 'Q2_2026', etc.
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES public.auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_regulatory_docs_entity ON regulatory_documents(entity_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_docs_type ON regulatory_documents(document_type);

-- RLS Policies
ALTER TABLE regulatory_documents ENABLE ROW LEVEL SECURITY;

-- HQ can upload regulatory documents
CREATE POLICY "HQ can upload regulatory documents" ON regulatory_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role = 'HQ_ADMIN'
    )
  );

-- HQ can view all regulatory documents
CREATE POLICY "HQ can view regulatory documents" ON regulatory_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role = 'HQ_ADMIN'
    )
  );

-- HQ can delete regulatory documents
CREATE POLICY "HQ can delete regulatory documents" ON regulatory_documents
  FOR DELETE TO authenticated
  USING (
    uploaded_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role = 'HQ_ADMIN'
    )
  );

-- Franchisee can view their own documents
CREATE POLICY "Franchisee can view own regulatory documents" ON regulatory_documents
  FOR SELECT TO authenticated
  USING (entity_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS regulatory_documents_updated_at ON regulatory_documents;

CREATE TRIGGER regulatory_documents_updated_at
  BEFORE UPDATE ON regulatory_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add comment
COMMENT ON TABLE regulatory_documents IS 'Stores regulatory documents (ACRA, AHU, LKPM, SPT) uploaded by HQ for franchisee financing';
