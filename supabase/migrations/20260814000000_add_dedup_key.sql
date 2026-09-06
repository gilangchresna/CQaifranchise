-- Add dedup_key column for idempotency when lender event_id is null
-- Fixes CODE_REVIEW P1: "Null eventId skips idempotency — use composite key"

-- lender_webhook_events: add dedup_key
ALTER TABLE public.lender_webhook_events
  ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_lender_webhook_dedup_key
  ON public.lender_webhook_events(lender_code, dedup_key)
  WHERE dedup_key IS NOT NULL;

-- repayment_events: add dedup_key
ALTER TABLE public.repayment_events
  ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_repayment_events_dedup_key
  ON public.repayment_events(lender_code, dedup_key)
  WHERE dedup_key IS NOT NULL;

-- Backfill existing NULL dedup_keys from payload._dedup_key if possible
-- (optional — existing records won't be deduped, but new ones will)
UPDATE public.lender_webhook_events
  SET dedup_key = (payload->>'_dedup_key')
  WHERE dedup_key IS NULL AND payload ? '_dedup_key';

UPDATE public.repayment_events
  SET dedup_key = (payload->>'_dedup_key')
  WHERE dedup_key IS NULL AND payload ? '_dedup_key';
