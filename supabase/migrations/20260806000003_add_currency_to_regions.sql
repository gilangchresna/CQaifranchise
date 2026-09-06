-- Migration: Add multi-currency support to regions
-- Adds currency_code + locale_code to regions table

ALTER TABLE public.regions
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'MYR',
  ADD COLUMN IF NOT EXISTS locale_code VARCHAR(10);

-- Update existing regions with correct currency
UPDATE public.regions SET currency_code = 'SGD', locale_code = 'en-SG' WHERE code = 'SG';
UPDATE public.regions SET currency_code = 'IDR', locale_code = 'id-ID' WHERE code = 'JKT';
UPDATE public.regions SET currency_code = 'IDR', locale_code = 'id-ID' WHERE code = 'BDG';
UPDATE public.regions SET currency_code = 'IDR', locale_code = 'id-ID' WHERE code = 'SBY';
UPDATE public.regions SET currency_code = 'THB', locale_code = 'th-TH' WHERE code = 'BKK';
UPDATE public.regions SET currency_code = 'MYR', locale_code = 'en-MY' WHERE code = 'KUL';

-- Add RLS policy so authenticated users can read currency info
DROP POLICY IF EXISTS "Allow authenticated read of regions" ON public.regions;
CREATE POLICY "Allow authenticated read of regions"
  ON public.regions FOR SELECT
  TO authenticated
  USING (true);
