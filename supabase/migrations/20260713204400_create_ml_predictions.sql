-- ML Predictions table for storing model outputs
CREATE TABLE IF NOT EXISTS public.ml_predictions (
    id BIGSERIAL PRIMARY KEY,
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE CASCADE,
    sku VARCHAR(100),
    product_name VARCHAR(255),
    current_stock DECIMAL(10,2),
    min_stock DECIMAL(10,2),
    avg_daily_usage DECIMAL(10,2),
    days_until_stockout INTEGER,
    risk_level VARCHAR(20) CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    risk_score DECIMAL(5,2),
    confidence DECIMAL(5,4),
    model_version VARCHAR(50),
    model_type VARCHAR(50),
    anomaly_score DECIMAL(5,4),
    is_anomaly BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(outlet_id, sku)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ml_predictions_outlet ON public.ml_predictions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_risk ON public.ml_predictions(risk_level);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_created ON public.ml_predictions(created_at DESC);

-- RLS
ALTER TABLE public.ml_predictions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON public.ml_predictions
    FOR SELECT TO authenticated USING (true);

-- Allow service role to all
CREATE POLICY "Allow service role all" ON public.ml_predictions
    FOR ALL TO service_role USING (true);
