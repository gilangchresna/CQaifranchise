-- Add smtp_pass to settings table
INSERT INTO public.settings (key, value, category, description) VALUES
    ('smtp_pass', '', 'notifications', 'SMTP password (leave empty if not changing)')
ON CONFLICT (key) DO NOTHING;
