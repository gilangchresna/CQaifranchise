-- ============================================================
-- Document Vault: Documents Metadata Table
-- Date: 2026-08-16
-- Purpose: Store document metadata linked to financing applications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.financing_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,  -- 'KYC_ID', 'BANK_STATEMENT', 'FRANCHISE_CONTRACT', 'FINANCIAL_REPORT', 'OTHER'
  title VARCHAR(255),
  file_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_size_bytes INTEGER,
  uploaded_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_application ON public.documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type);

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Users can read own documents
CREATE POLICY "Users read own documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert own documents
CREATE POLICY "Users insert own documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- HQ_ADMIN can read all
CREATE POLICY "Admin read all documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- Verify
SELECT COUNT(*) as document_count FROM public.documents;
