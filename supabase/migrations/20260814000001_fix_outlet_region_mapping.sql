-- Migration: 20260814000001_fix_outlet_region_mapping
-- Fix outlet → region mapping (Aug 14, 2026)
-- 11 outlets were incorrectly assigned to JKT (region_id=115)
-- Reassign to correct regions based on city name.

-- Singapore outlets (164,165,167,168,169,170,171) → region_id 114 (SG)
UPDATE outlets SET region_id = 114 WHERE id IN (164,165,167,168,169,170,171);

-- Malaysia outlets (210, 211) → region_id 119 (KUL)
UPDATE outlets SET region_id = 119 WHERE id IN (210, 211);

-- Thailand outlets (212, 213) → region_id 118 (BKK)
UPDATE outlets SET region_id = 118 WHERE id IN (212, 213);
