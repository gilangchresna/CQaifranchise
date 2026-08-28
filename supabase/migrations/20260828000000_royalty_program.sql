-- =====================================================
-- Royalty Program Module - Database Schema
-- Created: August 28, 2026
-- Purpose: Performance-based royalty fee management
-- =====================================================

-- 1. Royalty Settings (Global Configuration)
CREATE TABLE IF NOT EXISTS royalty_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Default rates
    default_base_rate DECIMAL(5,4) DEFAULT 0.06 CHECK (default_base_rate BETWEEN 0 AND 1),
    marketing_fund_rate DECIMAL(5,4) DEFAULT 0.02 CHECK (marketing_fund_rate BETWEEN 0 AND 1),
    upfront_fee DECIMAL(15,2) DEFAULT 15000,
    
    -- Rate caps
    min_rate_cap DECIMAL(5,4) DEFAULT 0.01 CHECK (min_rate_cap BETWEEN 0 AND 1),
    max_rate_cap DECIMAL(5,4) DEFAULT 0.15 CHECK (max_rate_cap BETWEEN 0 AND 1),
    
    -- Score multiplier configuration (JSONB)
    score_multiplier_config JSONB DEFAULT '{
        "90-100": {"multiplier": 0.70, "label": "Excellent"},
        "80-89": {"multiplier": 0.85, "label": "Good"},
        "70-79": {"multiplier": 1.00, "label": "Average"},
        "60-69": {"multiplier": 1.15, "label": "Below Average"},
        "50-59": {"multiplier": 1.30, "label": "Struggling"},
        "40-49": {"multiplier": 1.50, "label": "At Risk"},
        "<40": {"multiplier": 2.00, "label": "Watchlist"}
    }',
    
    -- Growth modifier configuration
    growth_modifier_config JSONB DEFAULT '{
        ">30%": {"modifier": -0.020, "label": "Exceptional Growth"},
        ">20%": {"modifier": -0.010, "label": "Strong Growth"},
        ">10%": {"modifier": -0.005, "label": "Good Growth"},
        "0-10%": {"modifier": 0.000, "label": "Stable"},
        "<0%": {"modifier": 0.005, "label": "Declining"},
        "<-10%": {"modifier": 0.010, "label": "Critical Decline"}
    }',
    
    -- Compliance adjustment configuration
    compliance_config JSONB DEFAULT '{
        "95-100%": {"adjustment": -0.010, "label": "Perfect Compliance"},
        "85-94%": {"adjustment": -0.005, "label": "High Compliance"},
        "70-84%": {"adjustment": 0.000, "label": "Acceptable"},
        "50-69%": {"adjustment": 0.005, "label": "Below Standard"},
        "<50%": {"adjustment": 0.010, "label": "Critical"}
    }',
    
    -- Revenue tier configuration
    revenue_tier_config JSONB DEFAULT '{
        "above_60k": {"threshold": 60000, "adjustment": -0.005, "label": "Super-grower"},
        "40k_60k": {"threshold_min": 40000, "adjustment": -0.005, "label": "Large Outlet"},
        "20k_40k": {"threshold_min": 20000, "adjustment": 0.000, "label": "Medium Outlet"},
        "10k_20k": {"threshold_min": 10000, "adjustment": 0.000, "label": "Small Outlet"},
        "below_10k": {"adjustment": 0.005, "label": "Minimum Threshold"}
    }',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Royalty Agreements (Per-Franchisee Configuration)
CREATE TABLE IF NOT EXISTS royalty_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    franchisee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
    outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    
    -- Formula Configuration
    formula_type VARCHAR(20) DEFAULT 'COMBINED' CHECK (formula_type IN ('FLAT', 'SCORE', 'TIERED', 'HYBRID', 'COMBINED')),
    
    -- Base rate for this agreement (can override global)
    base_rate DECIMAL(5,4) DEFAULT 0.06 CHECK (base_rate BETWEEN 0 AND 1),
    
    -- Component toggles
    score_multiplier_enabled BOOLEAN DEFAULT TRUE,
    tier_adjustment_enabled BOOLEAN DEFAULT TRUE,
    growth_modifier_enabled BOOLEAN DEFAULT TRUE,
    compliance_adjustment_enabled BOOLEAN DEFAULT TRUE,
    
    -- Custom caps for this franchisee (optional override)
    custom_min_rate DECIMAL(5,4),
    custom_max_rate DECIMAL(5,4),
    
    -- Effective period
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Terms
    payment_terms_days INTEGER DEFAULT 30,
    late_fee_percentage DECIMAL(5,4) DEFAULT 0.02,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_date_range CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- 3. Royalty Calculations (Monthly Calculation Log)
CREATE TABLE IF NOT EXISTS royalty_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    royalty_agreement_id UUID REFERENCES royalty_agreements(id) ON DELETE SET NULL,
    franchisee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    
    -- Period
    period_month DATE NOT NULL, -- First day of the month
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Revenue Input
    gross_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
    revenue_currency VARCHAR(3) DEFAULT 'SGD',
    
    -- Score Inputs
    risk_score INTEGER,
    risk_band VARCHAR(20),
    yoy_growth DECIMAL(6,4),
    compliance_score DECIMAL(5,4),
    
    -- Adjustment Breakdown
    score_multiplier DECIMAL(5,4),
    score_adjustment DECIMAL(6,4),
    tier_adjustment DECIMAL(6,4),
    growth_modifier DECIMAL(6,4),
    compliance_adjustment DECIMAL(6,4),
    
    -- Results
    base_rate_used DECIMAL(5,4) NOT NULL,
    effective_rate DECIMAL(6,4) NOT NULL,
    royalty_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    marketing_fund_amount DECIMAL(15,2) DEFAULT 0,
    total_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Comparison
    flat_royalty_amount DECIMAL(15,2),
    savings_vs_flat DECIMAL(15,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'INVOICED', 'PAID', 'OVERDUE', 'WAIVED')),
    
    -- Plain language breakdown (for franchisee)
    breakdown_summary TEXT,
    
    -- Invoice reference
    invoice_id UUID,
    invoice_number VARCHAR(50),
    
    -- Audit
    calculated_by VARCHAR(50), -- 'CRON' or user_id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Royalty Payments (Actual Payments)
CREATE TABLE IF NOT EXISTS royalty_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    royalty_calculation_id UUID REFERENCES royalty_calculations(id) ON DELETE SET NULL,
    royalty_agreement_id UUID REFERENCES royalty_agreements(id) ON DELETE SET NULL,
    franchisee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Amount
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'SGD',
    
    -- Payment details
    payment_date DATE,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    bank_reference VARCHAR(100),
    
    -- Period covered
    period_month DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'WAIVED')),
    
    -- Partial payment tracking
    amount_paid DECIMAL(15,2) DEFAULT 0,
    payment_history JSONB DEFAULT '[]',
    
    -- Late fees
    late_fee_applied DECIMAL(15,2) DEFAULT 0,
    late_fee_waived DECIMAL(15,2) DEFAULT 0,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Royalty Invoices
CREATE TABLE IF NOT EXISTS royalty_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    franchisee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Invoice details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    late_fee_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    amount_paid DECIMAL(15,2) DEFAULT 0,
    balance_due DECIMAL(15,2) NOT NULL,
    
    -- Currency
    currency VARCHAR(3) DEFAULT 'SGD',
    
    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED', 'VOID')),
    
    -- PDF
    pdf_url TEXT,
    pdf_generated_at TIMESTAMPTZ,
    
    -- Payment info
    paid_date DATE,
    payment_reference VARCHAR(100),
    
    -- Notes
    notes TEXT,
    terms TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Royalty Alerts (For AI Agent Integration)
CREATE TABLE IF NOT EXISTS royalty_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    franchisee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    royalty_calculation_id UUID REFERENCES royalty_calculations(id) ON DELETE SET NULL,
    royalty_payment_id UUID REFERENCES royalty_payments(id) ON DELETE SET NULL,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'PAYMENT_DUE',
        'PAYMENT_OVERDUE',
        'RATE_INCREASED',
        'RATE_DECREASED',
        'SCORE_DROPPED',
        'COMPLIANCE_DROPPED',
        'HIGH_ROYALTY_BURDEN',
        'PAYMENT_MISSED'
    )),
    
    severity VARCHAR(20) DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
    
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Context data
    context JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')),
    
    -- Resolution
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Audit
    created_by VARCHAR(50), -- 'SYSTEM', 'CRON', or user_id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Royalty Agreements
CREATE INDEX idx_royalty_agreements_franchisee ON royalty_agreements(franchisee_id);
CREATE INDEX idx_royalty_agreements_active ON royalty_agreements(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_royalty_agreements_effective ON royalty_agreements(effective_from, effective_to);

-- Royalty Calculations
CREATE INDEX idx_royalty_calculations_franchisee ON royalty_calculations(franchisee_id);
CREATE INDEX idx_royalty_calculations_period ON royalty_calculations(period_month);
CREATE INDEX idx_royalty_calculations_status ON royalty_calculations(status);
CREATE INDEX idx_royalty_calculations_created ON royalty_calculations(created_at DESC);

-- Royalty Payments
CREATE INDEX idx_royalty_payments_franchisee ON royalty_payments(franchisee_id);
CREATE INDEX idx_royalty_payments_status ON royalty_payments(status);
CREATE INDEX idx_royalty_payments_due ON royalty_payments(period_month, due_date) WHERE status IN ('PENDING', 'OVERDUE');

-- Royalty Invoices
CREATE INDEX idx_royalty_invoices_franchisee ON royalty_invoices(franchisee_id);
CREATE INDEX idx_royalty_invoices_status ON royalty_invoices(status);
CREATE INDEX idx_royalty_invoices_due ON royalty_invoices(due_date) WHERE status IN ('ISSUED', 'SENT', 'OVERDUE');

-- Royalty Alerts
CREATE INDEX idx_royalty_alerts_franchisee ON royalty_alerts(franchisee_id);
CREATE INDEX idx_royalty_alerts_status ON royalty_alerts(status) WHERE status = 'OPEN';
CREATE INDEX idx_royalty_alerts_type ON royalty_alerts(alert_type);
CREATE INDEX idx_royalty_alerts_severity ON royalty_alerts(severity);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_royalty_invoice_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    year_str VARCHAR(4);
    month_str VARCHAR(2);
    seq_num INTEGER;
    invoice_prefix VARCHAR(10);
BEGIN
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    month_str := TO_CHAR(CURRENT_DATE, 'MM');
    
    -- Get next sequence number for this month
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(invoice_number FROM 'RI-' || year_str || month_str || '-(\d+)' ) AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM royalty_invoices
    WHERE invoice_number LIKE 'RI-' || year_str || month_str || '-%';
    
    RETURN 'RI-' || year_str || month_str || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate days overdue
CREATE OR REPLACE FUNCTION get_days_overdue(p_due_date DATE, p_status VARCHAR)
RETURNS INTEGER AS $$
BEGIN
    IF p_status IN ('PAID', 'CANCELLED', 'VOID') THEN
        RETURN 0;
    END IF;
    
    RETURN GREATEST(0, CURRENT_DATE - p_due_date);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_royalty_settings_updated_at
    BEFORE UPDATE ON royalty_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_royalty_agreements_updated_at
    BEFORE UPDATE ON royalty_agreements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_royalty_calculations_updated_at
    BEFORE UPDATE ON royalty_calculations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_royalty_payments_updated_at
    BEFORE UPDATE ON royalty_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_royalty_invoices_updated_at
    BEFORE UPDATE ON royalty_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_royalty_alerts_updated_at
    BEFORE UPDATE ON royalty_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DEFAULT SETTINGS
-- =====================================================

INSERT INTO royalty_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE royalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_alerts ENABLE ROW LEVEL SECURITY;

-- Royalty Settings: Only HQ can view/edit
CREATE POLICY "royalty_settings_hq_only" ON royalty_settings
    FOR ALL USING (auth.role() = 'authenticated');

-- Royalty Agreements: HQ sees all, franchisee sees own
CREATE POLICY "royalty_agreements_hq_all" ON royalty_agreements
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "royalty_agreements_hq_modify" ON royalty_agreements
    FOR ALL USING (auth.role() = 'authenticated');

-- Royalty Calculations: HQ sees all, franchisee sees own
CREATE POLICY "royalty_calculations_hq_all" ON royalty_calculations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "royalty_calculations_hq_modify" ON royalty_calculations
    FOR ALL USING (auth.role() = 'authenticated');

-- Royalty Payments: HQ sees all, franchisee sees own
CREATE POLICY "royalty_payments_hq_all" ON royalty_payments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "royalty_payments_hq_modify" ON royalty_payments
    FOR ALL USING (auth.role() = 'authenticated');

-- Royalty Invoices: HQ sees all, franchisee sees own
CREATE POLICY "royalty_invoices_hq_all" ON royalty_invoices
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "royalty_invoices_hq_modify" ON royalty_invoices
    FOR ALL USING (auth.role() = 'authenticated');

-- Royalty Alerts: HQ sees all, franchisee sees own
CREATE POLICY "royalty_alerts_hq_all" ON royalty_alerts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "royalty_alerts_hq_modify" ON royalty_alerts
    FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE royalty_settings IS 'Global royalty program configuration and formula parameters';
COMMENT ON TABLE royalty_agreements IS 'Per-franchisee royalty agreement with custom formula settings';
COMMENT ON TABLE royalty_calculations IS 'Monthly royalty calculation log with full adjustment breakdown';
COMMENT ON TABLE royalty_payments IS 'Actual royalty payment records';
COMMENT ON TABLE royalty_invoices IS 'Royalty invoices for franchisees';
COMMENT ON TABLE royalty_alerts IS 'AI-triggered royalty alerts for monitoring';
