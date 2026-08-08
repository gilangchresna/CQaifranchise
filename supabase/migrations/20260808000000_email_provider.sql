-- Add email provider setting for flexible email configuration
-- Values: smtp, sendgrid, gmail

INSERT INTO public.settings (key, value, category, description) VALUES
    ('email_provider', 'smtp', 'notifications', 'Email provider: smtp, sendgrid, or gmail')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('sendgrid_api_key', '', 'notifications', 'SendGrid API Key (if using SendGrid provider)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.settings (key, value, category, description) VALUES
    ('sendgrid_from_email', 'noreply@cyberquote.com', 'notifications', 'SendGrid From Email address')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;
