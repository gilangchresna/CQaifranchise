-- Add filing_links JSONB column to user_profiles
-- Stores links to official regulatory filing platforms

-- Filing links JSONB column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS filing_links JSONB DEFAULT '{
  "sg": {
    "acra_bizfile": null,
    "acra_xbrl": null
  },
  "id": {
    "ahu_annual": null,
    "oss_lkpm": null,
    "djp_spt": null
  }
}'::jsonb;

-- Filing status enum
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS filing_status VARCHAR(20) DEFAULT 'PENDING';

-- Last verified timestamp
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS filing_links_verified_at TIMESTAMPTZ;

-- Add check constraint for filing_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_profiles_filing_status_check'
  ) THEN
    ALTER TABLE public.user_profiles 
    ADD CONSTRAINT user_profiles_filing_status_check 
    CHECK (filing_status IN ('FILED', 'PENDING', 'OVERDUE'));
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN public.user_profiles.filing_links IS 'JSON object storing filing status URLs for each country regulatory platform';
COMMENT ON COLUMN public.user_profiles.filing_status IS 'Overall filing status: FILED, PENDING, OVERDUE';
COMMENT ON COLUMN public.user_profiles.filing_links_verified_at IS 'When filing links were last verified';
