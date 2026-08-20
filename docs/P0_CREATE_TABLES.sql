-- ============================================================
-- P0: Royalty Payments & Debt Obligations
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- ROYALTY PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.royalty_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchisee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'SGD',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    days_past_due INTEGER DEFAULT 0,
    payment_method VARCHAR(20),
    reference_number VARCHAR(100),
    period VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_royalty_franchisee ON public.royalty_payments(franchisee_id);
CREATE INDEX IF NOT EXISTS idx_royalty_outlet ON public.royalty_payments(outlet_id);
CREATE INDEX IF NOT EXISTS idx_royalty_status ON public.royalty_payments(status);
CREATE INDEX IF NOT EXISTS idx_royalty_date ON public.royalty_payments(payment_date DESC);

-- ============================================================
-- DEBT OBLIGATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.debt_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchisee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
    creditor_name VARCHAR(200) NOT NULL,
    creditor_type VARCHAR(50),
    debt_type VARCHAR(50),
    outstanding_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    original_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'SGD',
    interest_rate DECIMAL(5,2),
    monthly_payment DECIMAL(12,2),
    remaining_term_months INTEGER,
    maturity_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    next_payment_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_franchisee ON public.debt_obligations(franchisee_id);
CREATE INDEX IF NOT EXISTS idx_debt_outlet ON public.debt_obligations(outlet_id);
CREATE INDEX IF NOT EXISTS idx_debt_status ON public.debt_obligations(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.royalty_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_obligations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY royalty_payments_hq ON public.royalty_payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY debt_obligations_hq ON public.debt_obligations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_royalty_updated_at
    BEFORE UPDATE ON public.royalty_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_debt_updated_at
    BEFORE UPDATE ON public.debt_obligations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- SEED SAMPLE DATA
-- ============================================================

-- Royalty payments for Alice (eee7a354-e627-4d66-880e-7ade2df815c7)
INSERT INTO public.royalty_payments (franchisee_id, outlet_id, payment_date, due_date, amount, currency, status, days_past_due, period)
SELECT 
    'eee7a354-e627-4d66-880e-7ade2df815c7',
    o.id,
    CURRENT_DATE - (n * INTERVAL '1 month'),
    (CURRENT_DATE - (n * INTERVAL '1 month')) - INTERVAL '5 days',
    5000 + (random() * 2000),
    'SGD',
    CASE WHEN random() > 0.2 THEN 'ON_TIME' WHEN random() > 0.5 THEN 'LATE' ELSE 'MISSED' END,
    CASE WHEN random() > 0.5 THEN floor(random() * 10)::int ELSE 0 END,
    to_char(CURRENT_DATE - (n * INTERVAL '1 month'), 'YYYY-MM')
FROM generate_series(0, 11) AS n, public.outlets o
WHERE o.region_id = 114 AND o.id IN (200, 201)
ON CONFLICT DO NOTHING;

-- Debt obligations for Alice
INSERT INTO public.debt_obligations (franchisee_id, outlet_id, creditor_name, creditor_type, debt_type, outstanding_amount, original_amount, interest_rate, monthly_payment, remaining_term_months, maturity_date, status)
SELECT 
    'eee7a354-e627-4d66-880e-7ade2df815c7',
    200,
    'DBS Bank',
    'BANK',
    'TERM_LOAN',
    150000 - (n * 12500),
    150000,
    4.5,
    12500,
    12 - n,
    CURRENT_DATE + ((12 - n) * INTERVAL '1 month'),
    'ACTIVE'
FROM generate_series(0, 12) AS n
ON CONFLICT DO NOTHING;

PRINT 'P0 tables and sample data created successfully!';
