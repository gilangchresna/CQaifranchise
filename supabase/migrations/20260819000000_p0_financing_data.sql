-- =============================================================================
-- Migration: 20260819000000_p0_financing_data.sql
-- P0: Royalty Payments & Debt Obligations for Credit Assessment
-- Created: 2026-08-19
-- =============================================================================

-- =============================================================================
-- ROYALTY PAYMENTS TABLE
-- Tracks franchise fee and royalty payments from franchisees
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.royalty_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchisee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'SGD',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- Status: PENDING, ON_TIME, LATE, MISSED, PARTIAL
    days_past_due INTEGER DEFAULT 0,
    payment_method VARCHAR(20), -- BANK_TRANSFER, GIRO, CREDIT_CARD
    reference_number VARCHAR(100),
    notes TEXT,
    period VARCHAR(10), -- '2026-08'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_royalty_franchisee ON public.royalty_payments(franchisee_id);
CREATE INDEX IF NOT EXISTS idx_royalty_outlet ON public.royalty_payments(outlet_id);
CREATE INDEX IF NOT EXISTS idx_royalty_status ON public.royalty_payments(status);
CREATE INDEX IF NOT EXISTS idx_royalty_period ON public.royalty_payments(period);
CREATE INDEX IF NOT EXISTS idx_royalty_date ON public.royalty_payments(payment_date DESC);

-- =============================================================================
-- DEBT OBLIGATIONS TABLE
-- Tracks existing debt obligations for leverage assessment
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.debt_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchisee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
    creditor_name VARCHAR(200) NOT NULL,
    creditor_type VARCHAR(50), -- BANK, SUPPLIER, LEASING, OTHER
    debt_type VARCHAR(50), -- TERM_LOAN, REVOLVING, TRADE_CREDIT, EQUIPMENT, OTHER
    outstanding_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    original_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'SGD',
    interest_rate DECIMAL(5,2), -- Annual rate in %
    monthly_payment DECIMAL(12,2),
    remaining_term_months INTEGER,
    maturity_date DATE,
    collateral VARCHAR(200),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    -- Status: ACTIVE, PAID_OFF, RESTRUCTURED, DEFAULTED
    next_payment_date DATE,
    last_payment_date DATE,
    notes TEXT,
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_debt_franchisee ON public.debt_obligations(franchisee_id);
CREATE INDEX IF NOT EXISTS idx_debt_outlet ON public.debt_obligations(outlet_id);
CREATE INDEX IF NOT EXISTS idx_debt_status ON public.debt_obligations(status);
CREATE INDEX IF NOT EXISTS idx_debt_creditor ON public.debt_obligations(creditor_name);
CREATE INDEX IF NOT EXISTS idx_debt_maturity ON public.debt_obligations(maturity_date);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.royalty_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_obligations ENABLE ROW LEVEL SECURITY;

-- Royalty payments: franchisees see own, HQ/Regional see all
DROP POLICY IF EXISTS royalty_payments_select ON public.royalty_payments;
CREATE POLICY royalty_payments_select ON public.royalty_payments FOR SELECT USING (
    franchisee_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
    )
);

-- Debt obligations: same pattern
DROP POLICY IF EXISTS debt_obligations_select ON public.debt_obligations;
CREATE POLICY debt_obligations_select ON public.debt_obligations FOR SELECT USING (
    franchisee_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
    )
);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_royalty_payments_updated_at
    BEFORE UPDATE ON public.royalty_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_debt_obligations_updated_at
    BEFORE UPDATE ON public.debt_obligations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
