-- =============================================================================
-- CyberQuote — Lender Bridge (Bridge-Loan Financing) + Stakeholder Reporting
-- Added: 2026-08-05
--
-- Context: franchisee setup/onboarding already tracked via `pilot_outreach`
-- (contacted_at -> demo_scheduled_at -> demo_completed_at -> agreement_signed_at
-- -> onboarding_completed_at). A new franchisee typically needs working
-- capital between "agreement_signed_at" and "onboarding_completed_at" to
-- fund fit-out, opening inventory, and staffing. This migration adds the
-- data model for a generic bridge-loan lender integration that plugs into
-- that stage, plus a lightweight audit table for stakeholder report exports.
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE financing_application_status AS ENUM (
        'DRAFT',            -- created, not yet submitted to lender
        'SUBMITTED',        -- sent to lender, awaiting decision
        'UNDER_REVIEW',     -- lender is actively underwriting
        'APPROVED',         -- lender approved, awaiting disbursement
        'DECLINED',         -- lender declined
        'DISBURSED',        -- funds released to franchisee
        'REPAYING',         -- in active repayment
        'CLOSED',           -- fully repaid / completed
        'CANCELLED'         -- withdrawn by franchisee or HQ
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- FINANCING APPLICATIONS
-- One row per bridge-loan request from a franchisee (existing outlet or an
-- outlet still in setup, hence outlet_id is nullable and pilot_outreach_id
-- links back to the onboarding pipeline).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.financing_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchisee_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
    pilot_outreach_id INTEGER, -- soft link to public.pilot_outreach(id); no FK since that table is managed outside migrations today (see docs/app-review)

    -- What's being requested
    purpose VARCHAR(100) NOT NULL DEFAULT 'FRANCHISEE_SETUP', -- FRANCHISEE_SETUP | INVENTORY | EQUIPMENT | WORKING_CAPITAL
    requested_amount DECIMAL(15,2) NOT NULL CHECK (requested_amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
    requested_term_months INTEGER,

    -- Lender + external tracking
    lender_code VARCHAR(50) NOT NULL DEFAULT 'GENERIC', -- identifies which lender adapter/config to use (see public.integrations, type='LENDER')
    lender_reference_id VARCHAR(200), -- ID assigned by the lender's system once submitted
    status financing_application_status NOT NULL DEFAULT 'DRAFT',
    decision_reason TEXT,

    -- Amounts once decided
    approved_amount DECIMAL(15,2),
    interest_rate_bps INTEGER, -- basis points, e.g. 1250 = 12.50%
    disbursed_amount DECIMAL(15,2),
    disbursed_at TIMESTAMPTZ,

    -- Snapshot of data shared with the lender at submission time (for audit —
    -- what CyberQuote told the lender, independent of later data changes)
    submitted_payload JSONB DEFAULT '{}',
    last_lender_response JSONB DEFAULT '{}',

    submitted_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financing_franchisee ON public.financing_applications(franchisee_id);
CREATE INDEX IF NOT EXISTS idx_financing_outlet ON public.financing_applications(outlet_id);
CREATE INDEX IF NOT EXISTS idx_financing_status ON public.financing_applications(status);
CREATE INDEX IF NOT EXISTS idx_financing_lender_ref ON public.financing_applications(lender_reference_id);

-- =============================================================================
-- LENDER WEBHOOK EVENTS
-- Raw audit trail of every inbound status update from a lender, so disputes
-- ("we told you it was approved") have a durable, replayable record and
-- webhook processing can be made idempotent via event_id.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lender_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.financing_applications(id) ON DELETE CASCADE,
    lender_code VARCHAR(50) NOT NULL,
    event_id VARCHAR(200), -- lender's own idempotency/event id, when provided
    event_type VARCHAR(100),
    payload JSONB NOT NULL DEFAULT '{}',
    processed BOOLEAN NOT NULL DEFAULT false,
    processing_error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lender_webhook_dedupe
    ON public.lender_webhook_events(lender_code, event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lender_webhook_application ON public.lender_webhook_events(application_id);

-- =============================================================================
-- STAKEHOLDER REPORT EXPORTS
-- Audit log of every backend report generated for an external/internal
-- stakeholder (who requested it, what window, and a pointer to the output),
-- so "backend reporting to stakeholders" is itself observable and repeatable.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.report_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    report_type VARCHAR(50) NOT NULL DEFAULT 'STAKEHOLDER_SUMMARY',
    period VARCHAR(20) NOT NULL DEFAULT '7d',
    format VARCHAR(10) NOT NULL DEFAULT 'json', -- json | csv
    region_id INTEGER REFERENCES public.regions(id) ON DELETE SET NULL,
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
    row_count INTEGER,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_exports_requested_by ON public.report_exports(requested_by);
CREATE INDEX IF NOT EXISTS idx_report_exports_generated_at ON public.report_exports(generated_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.financing_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lender_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

-- Franchisees see/manage only their own applications; Regional/HQ see all
-- (mirrors the pattern already used for public.outlets in the initial schema).
DROP POLICY IF EXISTS financing_applications_select ON public.financing_applications;
CREATE POLICY financing_applications_select ON public.financing_applications
    FOR SELECT USING (
        franchisee_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

DROP POLICY IF EXISTS financing_applications_insert ON public.financing_applications;
CREATE POLICY financing_applications_insert ON public.financing_applications
    FOR INSERT WITH CHECK (
        franchisee_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

DROP POLICY IF EXISTS financing_applications_update ON public.financing_applications;
CREATE POLICY financing_applications_update ON public.financing_applications
    FOR UPDATE USING (
        franchisee_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

-- Webhook events and report export logs are service-role / HQ-only (no direct
-- franchisee access — these are operational/audit tables written by edge
-- functions using the service key, which bypasses RLS by design).
DROP POLICY IF EXISTS lender_webhook_events_hq_only ON public.lender_webhook_events;
CREATE POLICY lender_webhook_events_hq_only ON public.lender_webhook_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

DROP POLICY IF EXISTS report_exports_hq_only ON public.report_exports;
CREATE POLICY report_exports_hq_only ON public.report_exports
    FOR SELECT USING (
        requested_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

-- updated_at trigger for financing_applications (mirrors convention used
-- elsewhere in the schema for *_updated_at triggers, where present)
CREATE OR REPLACE FUNCTION public.set_financing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financing_applications_updated_at ON public.financing_applications;
CREATE TRIGGER trg_financing_applications_updated_at
    BEFORE UPDATE ON public.financing_applications
    FOR EACH ROW EXECUTE FUNCTION public.set_financing_updated_at();

-- =============================================================================
-- REPAYMENT EVENTS
-- Real-time event stream for payment status updates from lender systems.
-- Captures every payment-related event for risk scoring and audit trail.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.repayment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.financing_applications(id) ON DELETE CASCADE,
    lender_code VARCHAR(50) NOT NULL,
    event_id VARCHAR(200),

    -- Event classification
    event_type VARCHAR(50) NOT NULL,
    event_subtype VARCHAR(100),

    -- Payment details
    amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'SGD',
    payment_reference VARCHAR(200),

    -- Schedule context
    emi_number INTEGER,
    scheduled_date DATE,

    -- Risk context
    days_overdue INTEGER DEFAULT 0,
    delinquency_level VARCHAR(20) DEFAULT 'NONE',

    -- Metadata
    raw_payload JSONB NOT NULL DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'LENDER_WEBHOOK',
    processed BOOLEAN NOT NULL DEFAULT false,
    processing_error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repayment_events_application ON public.repayment_events(application_id);
CREATE INDEX IF NOT EXISTS idx_repayment_events_type ON public.repayment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_repayment_events_received ON public.repayment_events(received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_repayment_events_dedupe
    ON public.repayment_events(lender_code, event_id) WHERE event_id IS NOT NULL;

-- =============================================================================
-- REPAYMENT SCHEDULE
-- Tracks EMI schedule and payment status for each financing application.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.repayment_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.financing_applications(id) ON DELETE CASCADE,
    emi_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'SGD',

    -- Payment tracking
    paid_amount DECIMAL(15,2) DEFAULT 0,
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(200),

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',

    -- Risk tracking
    days_overdue INTEGER DEFAULT 0,
    penalty_accrued DECIMAL(15,2) DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(application_id, emi_number)
);

CREATE INDEX IF NOT EXISTS idx_repayment_schedule_application ON public.repayment_schedule(application_id);
CREATE INDEX IF NOT EXISTS idx_repayment_schedule_status ON public.repayment_schedule(status);
CREATE INDEX IF NOT EXISTS idx_repayment_schedule_due ON public.repayment_schedule(due_date);

-- =============================================================================
-- APPLICATION RISK SCORES
-- Tracks risk scoring history for financing applications.
-- Enables trend analysis and alert escalation tracking.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.application_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.financing_applications(id) ON DELETE CASCADE,

    -- Risk components
    payment_timing_score DECIMAL(5,2) DEFAULT 100.00,
    delinquency_score DECIMAL(5,2) DEFAULT 0.00,
    affordability_score DECIMAL(5,2) DEFAULT 100.00,

    -- Composite score
    overall_risk_score DECIMAL(5,2) DEFAULT 0.00,
    risk_level VARCHAR(20) DEFAULT 'LOW',

    -- Factors
    risk_factors JSONB DEFAULT '[]',
    triggering_events JSONB DEFAULT '[]',

    -- Metadata
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    computation_method VARCHAR(50) DEFAULT 'RULE_BASED',
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_application ON public.application_risk_scores(application_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_level ON public.application_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_scores_computed ON public.application_risk_scores(computed_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY for New Tables
-- =============================================================================

-- RLS for repayment_events (HQ/Regional only)
ALTER TABLE public.repayment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS repayment_events_hq_only ON public.repayment_events;
CREATE POLICY repayment_events_hq_only ON public.repayment_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

-- RLS for repayment_schedule (Owner + HQ/Regional)
DROP POLICY IF EXISTS repayment_schedule_access ON public.repayment_schedule;
CREATE POLICY repayment_schedule_access ON public.repayment_schedule
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.financing_applications fa ON up.id = fa.franchisee_id
            WHERE up.id = auth.uid()
              AND fa.id = repayment_schedule.application_id
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

-- RLS for application_risk_scores (HQ/Regional only)
ALTER TABLE public.application_risk_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS risk_scores_hq_only ON public.application_risk_scores;
CREATE POLICY risk_scores_hq_only ON public.application_risk_scores
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

-- Trigger for repayment_schedule updated_at
CREATE OR REPLACE FUNCTION public.set_repayment_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_repayment_schedule_updated_at ON public.repayment_schedule;
CREATE TRIGGER trg_repayment_schedule_updated_at
    BEFORE UPDATE ON public.repayment_schedule
    FOR EACH ROW EXECUTE FUNCTION public.set_repayment_schedule_updated_at();
