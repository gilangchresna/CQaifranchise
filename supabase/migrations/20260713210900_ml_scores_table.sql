-- =============================================================================
-- ML Scores Table - Store batch scoring results for all outlets
-- =============================================================================

-- ML Scores table for persisting batch scoring results
CREATE TABLE IF NOT EXISTS public.ml_scores (
    id BIGSERIAL PRIMARY KEY,
    outlet_id INTEGER NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    model_type VARCHAR(50) NOT NULL,  -- 'anomaly' or 'stockout'
    score DECIMAL(5,4) NOT NULL,      -- 0-1 confidence score
    risk_level VARCHAR(20),             -- 'LOW', 'MEDIUM', 'HIGH' (for stockout)
    is_anomaly BOOLEAN DEFAULT false,
    days_until_stockout DECIMAL(10,2), -- For stockout predictions
    avg DECIMAL(15,2),                 -- Historical average (for anomaly)
    std_dev DECIMAL(15,2),            -- Standard deviation (for anomaly)
    data_points INTEGER,               -- Number of data points used
    metadata JSONB,                    -- Additional model metadata
    scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ml_scores_outlet ON public.ml_scores(outlet_id);
CREATE INDEX IF NOT EXISTS idx_ml_scores_type ON public.ml_scores(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_scores_scored_at ON public.ml_scores(scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_scores_outlet_type ON public.ml_scores(outlet_id, model_type, scored_at DESC);

-- ML Scheduler Runs table - Audit log for batch processing
CREATE TABLE IF NOT EXISTS public.ml_scheduler_runs (
    id BIGSERIAL PRIMARY KEY,
    outlets_processed INTEGER NOT NULL DEFAULT 0,
    anomalies_detected INTEGER NOT NULL DEFAULT 0,
    stockouts_detected INTEGER NOT NULL DEFAULT 0,
    alerts_created INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'completed_with_errors', 'failed'
    error_message TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_ml_runs_scheduled ON public.ml_scheduler_runs(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_runs_status ON public.ml_scheduler_runs(status);

-- Function to auto-update timestamps
CREATE OR REPLACE FUNCTION public.update_ml_score_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.scored_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ml_scores updated_at
CREATE OR REPLACE FUNCTION public.update_ml_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.scored_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ml_scores_timestamp
    BEFORE INSERT ON public.ml_scores
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ml_scores_timestamp();

-- RLS policies for ML scores (service role only for writes)
ALTER TABLE public.ml_scores ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role can manage ml_scores"
    ON public.ml_scores FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can read ml_scores for their outlets
CREATE POLICY "Users can view ML scores for their outlets"
    ON public.ml_scores FOR SELECT
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

-- RLS for ml_scheduler_runs
ALTER TABLE public.ml_scheduler_runs ENABLE ROW LEVEL SECURITY;

-- Service role can manage scheduler runs
CREATE POLICY "Service role can manage ml_scheduler_runs"
    ON public.ml_scheduler_runs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- HQ and Regional managers can view scheduler runs
CREATE POLICY "Managers can view ml_scheduler_runs"
    ON public.ml_scheduler_runs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

-- Comments for documentation
COMMENT ON TABLE public.ml_scores IS 'Stores ML model scoring results for outlets - anomaly detection and stockout predictions';
COMMENT ON TABLE public.ml_scheduler_runs IS 'Audit log for ML batch processing scheduler runs';
COMMENT ON COLUMN public.ml_scores.model_type IS 'Type of ML model: anomaly, stockout';
COMMENT ON COLUMN public.ml_scores.score IS 'Normalized score 0-1, higher = more anomalous or higher risk';
