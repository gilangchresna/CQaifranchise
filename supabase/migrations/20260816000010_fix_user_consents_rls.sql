-- ============================================================
-- Fix RLS Policies for user_consents
-- Date: 2026-08-16
-- Purpose: Add INSERT and UPDATE policies for users to manage own consents
-- ============================================================

-- Users can insert their own consents
CREATE POLICY "Users can insert own consents"
    ON public.user_consents FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can update their own consents (for upsert)
CREATE POLICY "Users can update own consents"
    ON public.user_consents FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
