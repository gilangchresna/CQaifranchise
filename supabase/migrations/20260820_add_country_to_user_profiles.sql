-- Add country field to user_profiles for regulatory document filtering
-- Date: 2026-08-20

-- Add country column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'SGP';

-- Set country based on existing data (if there's a way to determine)
-- For now, set default to Singapore
UPDATE public.user_profiles
SET country = 'SGP'
WHERE country IS NULL;

-- Add comment
COMMENT ON COLUMN public.user_profiles.country IS 'Country code: SGP, IDN, MYS, etc.';
