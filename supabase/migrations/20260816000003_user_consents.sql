-- ============================================================
-- PDPA Compliance: User Consents Table
-- Date: 2026-08-16
-- Purpose: Track franchisee consent for data processing per region
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES public.knowledge_policies(id),
    policy_type VARCHAR(50) NOT NULL DEFAULT 'pdpa',
    region_id INTEGER REFERENCES public.regions(id),
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consent_version VARCHAR(20) DEFAULT '1.0',
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    withdrawn_at TIMESTAMPTZ,
    UNIQUE(user_id, policy_type, region_id)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_policy ON public.user_consents(policy_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_region ON public.user_consents(region_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_active ON public.user_consents(is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Users can read their own consents
CREATE POLICY "Users can view own consents"
    ON public.user_consents FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Service role can manage all consents
CREATE POLICY "Service role manages all consents"
    ON public.user_consents FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'HQ_ADMIN'
        )
    );

-- Comment
COMMENT ON TABLE public.user_consents IS 'Tracks franchisee consent for PDPA compliance per region';
