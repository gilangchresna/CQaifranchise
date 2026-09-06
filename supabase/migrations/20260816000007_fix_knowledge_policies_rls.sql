-- ============================================================
-- Fix RLS on knowledge_policies — no SELECT policy existed
-- Date: 2026-08-16
-- Purpose: Authenticated franchisees must be able to read PDPA policies
--          to consent. Previously all knowledge_policies queries
--          returned 0 rows for franchisees due to missing SELECT RLS.
-- ============================================================

-- Policy 1: All authenticated users can SELECT active knowledge_policies
-- (Used for PDPA consent display — no sensitive content here, just public notices)
CREATE POLICY "Authenticated users can view active knowledge_policies"
    ON public.knowledge_policies FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Policy 2: HQ_ADMIN can do everything
CREATE POLICY "HQ admin full access to knowledge_policies"
    ON public.knowledge_policies FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'HQ_ADMIN'
        )
    );

-- Also fix user_consents INSERT policy for franchisees
-- The existing policy uses TO authenticated + USING, which only grants
-- UPDATE/DELETE (INSERT is granted via USING). Add explicit INSERT.
DROP POLICY IF EXISTS "Users can insert own consents" ON public.user_consents;
CREATE POLICY "Users can insert own consents"
    ON public.user_consents FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
