-- Migration: Add currency_code to sales_transactions for multi-currency support
-- Option 3: Hybrid — transaction-level currency with outlet-region fallback

-- 1. Add currency_code column (nullable for existing rows)
ALTER TABLE public.sales_transactions
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'IDR';

-- 2. Update existing rows based on outlet's region currency
-- This queries outlets→regions to backfill currency for existing transactions
UPDATE public.sales_transactions st
SET currency_code = COALESCE(
    r.currency_code,
    'IDR'  -- safe default for Indonesia outlets
)
FROM public.outlets o
JOIN public.regions r ON o.region_id = r.id
WHERE st.outlet_id = o.id
  AND st.currency_code IS NULL;

-- 3. For rows where outlet doesn't exist or has no region, default to SGD
UPDATE public.sales_transactions
SET currency_code = 'SGD'
WHERE currency_code IS NULL;

-- 4. Verify
-- SELECT currency_code, COUNT(*) FROM public.sales_transactions GROUP BY currency_code ORDER BY COUNT(*) DESC;

-- 5. Add comment
COMMENT ON COLUMN public.sales_transactions.currency_code IS 'Currency of transaction at ingestion time. Nullable — fallback to outlet region currency.';
