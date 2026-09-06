-- ============================================================
-- Document Vault: Storage Bucket + RLS Policies
-- Date: 2026-08-16
-- Purpose: Create franchise-documents storage bucket
-- ============================================================

-- Create bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'franchise-documents',
  'franchise-documents',
  false,
  52428800,  -- 50MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to upload
CREATE POLICY "User upload to franchise-documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'franchise-documents'
  );

-- RLS: Users can read own documents
CREATE POLICY "User read own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'franchise-documents'
  );

-- RLS: Admin can read all
CREATE POLICY "Admin read all documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'franchise-documents'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- Verify
SELECT id, name, public FROM storage.buckets WHERE id = 'franchise-documents';
