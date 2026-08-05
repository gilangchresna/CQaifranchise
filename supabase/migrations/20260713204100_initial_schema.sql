-- =============================================================================
-- CyberQuote MVP - Initial Schema
-- Full Supabase Architecture
-- =============================================================================

-- ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('HQ_ADMIN', 'REGIONAL_MANAGER', 'FRANCHISEE_OWNER', 'FRANCHISEE_STAFF');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_status AS ENUM ('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_severity AS ENUM ('P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_type AS ENUM ('SALES_ANOMALY', 'STOCKOUT_RISK', 'ATTENDANCE_ISSUE', 'COMPLAINT', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE outlet_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE case_priority AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE case_status AS ENUM ('NEW', 'IN_PROGRESS', 'PENDING_INFO', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('WHATSAPP', 'EMAIL', 'PUSH', 'ALL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- REGIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regions_code ON public.regions(code);

-- =============================================================================
-- USER PROFILES (extends Supabase auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    region_id INTEGER REFERENCES public.regions(id) ON DELETE SET NULL,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'FRANCHISEE_OWNER',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_region ON public.user_profiles(region_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- =============================================================================
-- OUTLETS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.outlets (
    id SERIAL PRIMARY KEY,
    region_id INTEGER NOT NULL REFERENCES public.regions(id) ON DELETE RESTRICT,
    franchisee_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    address TEXT,
    city VARCHAR(100),
    phone VARCHAR(20),
    status outlet_status NOT NULL DEFAULT 'ACTIVE',
    daily_target DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlets_region ON public.outlets(region_id);
CREATE INDEX IF NOT EXISTS idx_outlets_franchisee ON public.outlets(franchisee_id);
CREATE INDEX IF NOT EXISTS idx_outlets_code ON public.outlets(code);
CREATE INDEX IF NOT EXISTS idx_outlets_status ON public.outlets(status);

-- =============================================================================
-- SALES TRANSACTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sales_transactions (
    id BIGSERIAL PRIMARY KEY,
    outlet_id INTEGER NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15,2) NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 1,
    hour INTEGER CHECK (hour >= 0 AND hour <= 23),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    anomaly_score DECIMAL(5,4),
    is_anomaly BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_outlet_date ON public.sales_transactions(outlet_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_transaction_id ON public.sales_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales_transactions(date);
CREATE INDEX IF NOT EXISTS idx_sales_anomaly ON public.sales_transactions(is_anomaly) WHERE is_anomaly = true;

-- =============================================================================
-- INVENTORY TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.inventory (
    id SERIAL PRIMARY KEY,
    outlet_id INTEGER NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    current_stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    max_stock INTEGER NOT NULL DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'pcs',
    last_restock_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_outlet ON public.inventory(outlet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON public.inventory(outlet_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON public.inventory(outlet_id) WHERE current_stock <= min_stock;

-- =============================================================================
-- ALERTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.alerts (
    id SERIAL PRIMARY KEY,
    outlet_id INTEGER NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    type alert_type NOT NULL,
    severity alert_severity NOT NULL,
    status alert_status NOT NULL DEFAULT 'NEW',
    title VARCHAR(200) NOT NULL,
    description TEXT,
    score DECIMAL(5,4),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_outlet ON public.alerts(outlet_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON public.alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered ON public.alerts(triggered_at DESC);

-- =============================================================================
-- CASES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cases (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES public.alerts(id) ON DELETE SET NULL,
    assigned_to_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    priority case_priority NOT NULL DEFAULT 'MEDIUM',
    status case_status NOT NULL DEFAULT 'NEW',
    sla_deadline TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_alert ON public.cases(alert_id);
CREATE INDEX IF NOT EXISTS idx_cases_assignee ON public.cases(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON public.cases(priority);
CREATE INDEX IF NOT EXISTS idx_cases_sla ON public.cases(sla_deadline) WHERE sla_deadline IS NOT NULL AND status NOT IN ('RESOLVED', 'CLOSED');

-- =============================================================================
-- NOTIFICATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES public.alerts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(200),
    message TEXT NOT NULL,
    status notification_status NOT NULL DEFAULT 'PENDING',
    external_id VARCHAR(100),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_alert ON public.notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_sent ON public.notifications(sent_at DESC);

-- =============================================================================
-- AI EXPLANATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_explanations (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES public.alerts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    model_used VARCHAR(50) NOT NULL,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_explanations_alert ON public.ai_explanations(alert_id);
CREATE INDEX IF NOT EXISTS idx_ai_explanations_user ON public.ai_explanations(user_id);

-- =============================================================================
-- ML MODEL VERSIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ml_model_versions (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    description TEXT,
    metrics JSONB,
    is_production BOOLEAN NOT NULL DEFAULT false,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deployed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_models_name ON public.ml_model_versions(model_name);
CREATE INDEX IF NOT EXISTS idx_ml_models_production ON public.ml_model_versions(is_production) WHERE is_production = true;

-- =============================================================================
-- WEBHOOK SECRETS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_secrets (
    id SERIAL PRIMARY KEY,
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE CASCADE,
    secret_key VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_secrets_outlet ON public.webhook_secrets(outlet_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON public.regions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outlets_updated_at BEFORE UPDATE ON public.outlets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON public.alerts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_secrets ENABLE ROW LEVEL SECURITY;

-- REGIONS Policies
CREATE POLICY "Regions are viewable by all authenticated users"
    ON public.regions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "HQ Admins can insert regions"
    ON public.regions FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'HQ_ADMIN'
        )
    );

-- USER PROFILES Policies
CREATE POLICY "Users can view their own profile"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "HQ and Regional can view all profiles"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

CREATE POLICY "Users can update their own profile"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid());

-- OUTLETS Policies
CREATE POLICY "Franchisees can view their own outlets"
    ON public.outlets FOR SELECT
    TO authenticated
    USING (
        franchisee_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

CREATE POLICY "HQ can insert outlets"
    ON public.outlets FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'HQ_ADMIN'
        )
    );

CREATE POLICY "HQ can update outlets"
    ON public.outlets FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'HQ_ADMIN'
        )
    );

-- SALES TRANSACTIONS Policies
CREATE POLICY "Users can view sales for their outlets"
    ON public.sales_transactions FOR SELECT
    TO authenticated
    USING (
        outlet_id IN (
            SELECT id FROM public.outlets
            WHERE franchisee_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.user_profiles up
                JOIN public.outlets o ON o.region_id = up.region_id
                WHERE up.id = auth.uid() AND up.role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
            )
        )
    );

CREATE POLICY "Service role can insert sales"
    ON public.sales_transactions FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ALERTS Policies
CREATE POLICY "Users can view alerts for their outlets"
    ON public.alerts FOR SELECT
    TO authenticated
    USING (
        outlet_id IN (
            SELECT id FROM public.outlets
            WHERE franchisee_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.user_profiles up
                JOIN public.outlets o ON o.region_id = up.region_id
                WHERE up.id = auth.uid() AND up.role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
            )
        )
    );

CREATE POLICY "Service role can insert alerts"
    ON public.alerts FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Assigned users can update alerts"
    ON public.alerts FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.cases
            WHERE alert_id = public.alerts.id AND assigned_to_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

-- CASES Policies
CREATE POLICY "Assigned users can view cases"
    ON public.cases FOR SELECT
    TO authenticated
    USING (
        assigned_to_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

CREATE POLICY "Authenticated users can create cases"
    ON public.cases FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Assigned users can update cases"
    ON public.cases FOR UPDATE
    TO authenticated
    USING (
        assigned_to_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

-- NOTIFICATIONS Policies
CREATE POLICY "Users can view their notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Service role can insert notifications"
    ON public.notifications FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ML MODEL VERSIONS Policies
CREATE POLICY "Authenticated users can view ML models"
    ON public.ml_model_versions FOR SELECT
    TO authenticated
    USING (true);

-- =============================================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'FRANCHISEE_OWNER'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Insert sample regions
INSERT INTO public.regions (name, code, description) VALUES
    ('Jakarta', 'JKT', 'Jakarta Capital Region'),
    ('Jawa Barat', 'JBR', 'West Java Province'),
    ('Jawa Tengah', 'JTG', 'Central Java Province'),
    ('Jawa Timur', 'JTM', 'East Java Province'),
    ('Sumatera', 'SUM', 'Sumatra Region')
ON CONFLICT (code) DO NOTHING;

-- Insert sample ML model version
INSERT INTO public.ml_model_versions (model_name, version, model_type, description, metrics, is_production)
VALUES (
    'anomaly_detector',
    'v1.0.0',
    'Z_SCORE',
    'Initial z-score based anomaly detection model',
    '{"threshold": 2.5, "lookback_days": 30}'::jsonb,
    true
),
(
    'stockout_predictor',
    'v1.0.0',
    'LINEAR_REGRESSION',
    'Initial stockout risk prediction model',
    '{"lookback_days": 7, "prediction_horizon": 1}'::jsonb,
    true
)
ON CONFLICT DO NOTHING;
