-- Settings table for platform configuration
-- Stores key-value settings with category grouping

CREATE TABLE IF NOT EXISTS public.settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    category VARCHAR(100) DEFAULT 'general',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON public.settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings(key);

-- RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Platform admins can read/write all settings
CREATE POLICY "Platform admins can manage all settings"
    ON public.settings
    FOR ALL
    TO authenticated
    USING ((
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role = 'HQ_ADMIN'
        )
    ))
    WITH CHECK ((
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role = 'HQ_ADMIN'
        )
    ));

-- Insert default SMTP settings
INSERT INTO public.settings (key, value, category, description) VALUES
    ('smtp_host', 'mail.cyberquote.co.id', 'notifications', 'SMTP server hostname')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('smtp_port', '465', 'notifications', 'SMTP server port (465 for SSL, 587 for TLS)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('smtp_user', 'stefanus.gilang@cyberquote.co.id', 'notifications', 'SMTP username/email')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('smtp_from', 'CyberQuote Alerts <stefanus.gilang@cyberquote.co.id>', 'notifications', 'From address for outgoing emails')
ON CONFLICT (key) DO NOTHING;

-- Insert default notification settings
INSERT INTO public.settings (key, value, category, description) VALUES
    ('email_notifications_enabled', 'true', 'notifications', 'Enable email notifications')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('whatsapp_notifications_enabled', 'false', 'notifications', 'Enable WhatsApp notifications')
ON CONFLICT (key) DO NOTHING;

-- Insert default threshold settings
INSERT INTO public.settings (key, value, category, description) VALUES
    ('anomaly_threshold', '0.7', 'alerts', 'Anomaly score threshold for generating alerts (0-1)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('stockout_threshold', '0.7', 'alerts', 'Stockout risk score threshold (0-1)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('sla_warning_threshold', '50', 'alerts', 'SLA warning at percentage of deadline elapsed')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('sla_escalation_threshold', '75', 'alerts', 'SLA escalation at percentage of deadline elapsed')
ON CONFLICT (key) DO NOTHING;
