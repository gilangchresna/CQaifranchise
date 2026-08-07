-- Add all missing settings keys (run after 20260807000000_settings_table.sql)
-- Severity threshold settings
INSERT INTO public.settings (key, value, category, description) VALUES
    ('p0_threshold', '0.9', 'alerts', 'P0 CRITICAL severity threshold')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('p1_threshold', '0.7', 'alerts', 'P1 HIGH severity threshold')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('p2_threshold', '0.5', 'alerts', 'P2 MEDIUM severity threshold')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

-- SLA time settings
INSERT INTO public.settings (key, value, category, description) VALUES
    ('sla_high', '1', 'alerts', 'SLA response time for HIGH severity (hours)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('sla_medium', '24', 'alerts', 'SLA response time for MEDIUM severity (hours)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('sla_low', '72', 'alerts', 'SLA response time for LOW severity (hours)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

-- AI settings
INSERT INTO public.settings (key, value, category, description) VALUES
    ('ai_mode', 'assist', 'ai', 'AI copilot operation mode: inform/assist/automate')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('ai_threshold', '0.8', 'ai', 'AI action approval confidence threshold (0-1)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('ai_caching', 'true', 'ai', 'Enable semantic caching for AI queries')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

-- Security settings
INSERT INTO public.settings (key, value, category, description) VALUES
    ('sec_allowlist', 'true', 'security', 'Enable agent action allowlist')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('sec_injection_filter', 'true', 'security', 'Enable prompt injection filter')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('sec_audit_log', 'true', 'security', 'Enable immutable audit logging')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

-- smtp_pass already added in v1
