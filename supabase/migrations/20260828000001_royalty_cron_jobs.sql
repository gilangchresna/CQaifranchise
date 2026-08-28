-- =====================================================
-- Royalty Program Cron Jobs
-- Created: August 28, 2026
-- Purpose: Schedule royalty calculations and payment tracking
-- =====================================================

-- 1. Monthly Royalty Calculator Cron Job
-- Runs on 1st of every month at 2:00 AM
SELECT cron.schedule(
    'royalty-monthly-calculate',
    '0 2 1 * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/royalty-calculator',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        ),
        body := jsonb_build_object(
            'franchisee_ids', (
                SELECT array_agg(id::text)
                FROM users
                WHERE role IN ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF')
                AND is_active = true
            ),
            'force_recalculate', false
        )
    );
    $$
);

-- 2. Royalty Payment Tracker Cron Job
-- Runs daily at 9:00 AM to check overdue payments
SELECT cron.schedule(
    'royalty-payment-check',
    '0 9 * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/royalty-payment-tracker',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- 3. Royalty Alert Processor
-- Runs every 15 minutes to process royalty alerts
SELECT cron.schedule(
    'royalty-alert-processor',
    '*/15 * * * *',
    $$
    INSERT INTO royalty_alerts (
        franchisee_id,
        alert_type,
        severity,
        title,
        description,
        context,
        status,
        created_by
    )
    SELECT 
        rc.franchisee_id,
        'PAYMENT_DUE',
        'WARNING',
        'Royalty Payment Due - ' || TO_CHAR(rc.period_month, 'Mon YYYY'),
        'Royalty payment of S$' || ROUND(rc.royalty_amount, 2) || ' is due for ' || TO_CHAR(rc.period_month, 'Mon YYYY'),
        jsonb_build_object(
            'calculation_id', rc.id,
            'amount', rc.royalty_amount,
            'period', TO_CHAR(rc.period_month, 'YYYY-MM')
        ),
        'OPEN',
        'cron-royalty-alert'
    FROM royalty_calculations rc
    LEFT JOIN royalty_payments rp ON rp.royalty_calculation_id = rc.id AND rp.status = 'PAID'
    WHERE rc.status IN ('CALCULATED', 'INVOICED')
    AND rp.id IS NULL
    AND rc.period_month <= CURRENT_DATE - INTERVAL '30 days'
    AND NOT EXISTS (
        SELECT 1 FROM royalty_alerts ra
        WHERE ra.royalty_calculation_id = rc.id
        AND ra.alert_type = 'PAYMENT_DUE'
        AND ra.created_at > NOW() - INTERVAL '1 day'
    );
    $$
);

-- 4. Generate Royalty Summary Report (Monthly)
-- Runs on 5th of every month at 8:00 AM
SELECT cron.schedule(
    'royalty-monthly-report',
    '0 8 5 * *',
    $$
    INSERT INTO royalty_calculations (
        franchisee_id,
        period_month,
        period_start,
        period_end,
        gross_revenue,
        effective_rate,
        royalty_amount,
        flat_royalty_amount,
        savings_vs_flat,
        status,
        calculated_by
    )
    SELECT 
        rc.franchisee_id,
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'),
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'),
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day',
        rc.gross_revenue,
        rc.effective_rate,
        rc.royalty_amount,
        rc.flat_royalty_amount,
        rc.savings_vs_flat,
        'CALCULATED',
        'royalty-monthly-report'
    FROM royalty_calculations rc
    WHERE rc.period_month = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND NOT EXISTS (
        SELECT 1 FROM royalty_calculations rc2
        WHERE rc2.franchisee_id = rc.franchisee_id
        AND rc2.calculated_by = 'royalty-monthly-report'
        AND DATE_TRUNC('month', rc2.created_at) = DATE_TRUNC('month', CURRENT_DATE)
    );
    $$
);

-- =====================================================
-- Helper Function: Get All Active Franchisees
-- =====================================================
CREATE OR REPLACE FUNCTION get_active_franchisees()
RETURNS TABLE (
    franchisee_id UUID,
    email TEXT,
    full_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as franchisee_id,
        u.email,
        COALESCE(up.full_name, u.email) as full_name
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.role IN ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF')
    AND u.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Helper Function: Calculate Portfolio Royalty Summary
-- =====================================================
CREATE OR REPLACE FUNCTION get_royalty_portfolio_summary(p_period_start DATE, p_period_end DATE)
RETURNS TABLE (
    total_franchisees BIGINT,
    total_revenue NUMERIC,
    total_royalty NUMERIC,
    total_marketing NUMERIC,
    avg_effective_rate NUMERIC,
    collection_rate NUMERIC,
    top_performer_id UUID,
    top_performer_name TEXT,
    top_performer_savings NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH period_calcs AS (
        SELECT 
            rc.franchisee_id,
            SUM(rc.gross_revenue) as revenue,
            SUM(rc.royalty_amount) as royalty,
            SUM(rc.marketing_fund_amount) as marketing,
            AVG(rc.effective_rate) as avg_rate,
            SUM(CASE WHEN rc.status = 'PAID' THEN rc.royalty_amount ELSE 0 END) as paid
        FROM royalty_calculations rc
        WHERE rc.period_month >= p_period_start
        AND rc.period_month <= p_period_end
        GROUP BY rc.franchisee_id
    ),
    ranked AS (
        SELECT 
            pc.*,
            u.email,
            up.full_name,
            ROW_NUMBER() OVER (ORDER BY (pc.royalty / NULLIF(pc.revenue, 0)) DESC as rank
        FROM period_calcs pc
        LEFT JOIN users u ON u.id = pc.franchisee_id
        LEFT JOIN user_profiles up ON up.user_id = pc.franchisee_id
    )
    SELECT 
        COUNT(DISTINCT pc.franchisee_id)::BIGINT as total_franchisees,
        SUM(pc.revenue) as total_revenue,
        SUM(pc.royalty) as total_royalty,
        SUM(pc.marketing) as total_marketing,
        AVG(pc.avg_rate) as avg_effective_rate,
        CASE WHEN SUM(pc.royalty) > 0 
            THEN SUM(pc.paid) / SUM(pc.royalty) * 100 
            ELSE 0 
        END as collection_rate,
        r.franchisee_id as top_performer_id,
        r.full_name as top_performer_name,
        r.revenue * 0.06 - r.royalty as top_performer_savings
    FROM period_calcs pc
    LEFT JOIN ranked r ON r.rank = 1
    GROUP BY r.franchisee_id, r.full_name, r.revenue, r.royalty;
END;
$$ LANGUAGE plpgsql;
