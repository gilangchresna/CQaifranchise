-- ============================================================
-- Data Retention Settings
-- Default values for multi-country franchise retention
-- Date: 2026-08-16
-- ============================================================

-- Insert retention settings one by one with ON CONFLICT DO NOTHING
-- This is safer than batch INSERT + ON CONFLICT DO UPDATE

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_alerts', '30', 'operations', 'Alerts retention in days (default: 30 days)', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_cases', '730', 'operations', 'Cases retention in days (default: 2 years)', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_ml_anomaly_scores', '90', 'ml', 'ML anomaly scores retention in days', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_ml_scores', '90', 'ml', 'ML scores retention in days', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_ml_predictions', '90', 'ml', 'ML predictions retention in days', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_ai_audit_log', '365', 'compliance', 'AI audit log retention in days (default: 1 year)', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_notification_logs', '365', 'compliance', 'Notification logs retention in days', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_lender_webhook_events', '365', 'compliance', 'Lender webhook events retention in days', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_function_execution_logs', '90', 'operations', 'Function execution logs retention in days', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_ml_error_logs', '90', 'ml', 'ML error logs retention in days', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_sales_transactions', '2555', 'finance', 'Sales transactions retention in days (default: 7 years for SG)', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_days_repayment_events', '1825', 'finance', 'Repayment events retention in days (default: 5 years)', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_enabled', 'true', 'general', 'Enable/disable automatic data retention cleanup', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES ('retention_dry_run', 'false', 'general', 'If true, count records but do not delete', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Verify inserted settings
SELECT key, value, category, description FROM public.settings
WHERE key LIKE 'retention_%'
ORDER BY category, key;
