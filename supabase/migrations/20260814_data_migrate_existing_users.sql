-- Migration 4: Data Migration - Assign regions to existing users
-- Date: 2026-08-14
-- Purpose: RBAC Phase 1 - Assign regions to existing users based on role and patterns

-- =============================================================================
-- STEP 1: HQ_ADMIN - NULL region (they see all regions)
-- =============================================================================
UPDATE user_profiles 
SET region_id = NULL 
WHERE role = 'HQ_ADMIN' 
  AND region_id IS DISTINCT FROM NULL;

-- =============================================================================
-- STEP 2: REGIONAL_MANAGER - Assign by name pattern
-- =============================================================================
UPDATE user_profiles 
SET region_id = 114 
WHERE role = 'REGIONAL_MANAGER' 
  AND full_name ILIKE '%Singapore%'
  AND region_id IS DISTINCT FROM 114;

UPDATE user_profiles 
SET region_id = 115 
WHERE role = 'REGIONAL_MANAGER' 
  AND full_name ILIKE '%Jakarta%'
  AND region_id IS DISTINCT FROM 115;

UPDATE user_profiles 
SET region_id = 116 
WHERE role = 'REGIONAL_MANAGER' 
  AND full_name ILIKE '%Bandung%'
  AND region_id IS DISTINCT FROM 116;

UPDATE user_profiles 
SET region_id = 117 
WHERE role = 'REGIONAL_MANAGER' 
  AND full_name ILIKE '%Surabaya%'
  AND region_id IS DISTINCT FROM 117;

UPDATE user_profiles 
SET region_id = 118 
WHERE role = 'REGIONAL_MANAGER' 
  AND full_name ILIKE '%Bangkok%'
  AND region_id IS DISTINCT FROM 118;

UPDATE user_profiles 
SET region_id = 119 
WHERE role = 'REGIONAL_MANAGER' 
  AND full_name ILIKE '%Kuala Lumpur%'
  AND region_id IS DISTINCT FROM 119;

-- =============================================================================
-- STEP 3: FRANCHISEE_OWNER - Link via franchisee_id to outlets
-- =============================================================================
UPDATE user_profiles up
SET region_id = o.region_id
FROM outlets o
WHERE up.role = 'FRANCHISEE_OWNER' 
  AND up.region_id IS DISTINCT FROM o.region_id
  AND o.franchisee_id = up.id;

-- =============================================================================
-- STEP 4: FRANCHISEE_STAFF - NULL initially (will be assigned via user_outlets)
-- =============================================================================
-- Staff get their region from user_outlets -> outlets -> regions
-- This is handled in the user_outlets seed below

-- =============================================================================
-- STEP 5: Seed user_outlets for FRANCHISEE_OWNER
-- =============================================================================
INSERT INTO user_outlets (user_id, outlet_id)
SELECT up.id, o.id
FROM user_profiles up
JOIN outlets o ON o.franchisee_id = up.id
WHERE up.role = 'FRANCHISEE_OWNER'
ON CONFLICT (user_id, outlet_id) DO NOTHING;

-- =============================================================================
-- STEP 6: Seed user_outlets for FRANCHISEE_STAFF (assign to outlet 1 temporarily)
-- =============================================================================
-- Note: In production, staff should be assigned to specific outlets
-- This placeholder assigns unassigned staff to outlet 1
INSERT INTO user_outlets (user_id, outlet_id)
SELECT up.id, 1
FROM user_profiles up
WHERE up.role = 'FRANCHISEE_STAFF'
  AND up.id NOT IN (SELECT user_id FROM user_outlets)
ON CONFLICT (user_id, outlet_id) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES (run these separately to check results)
-- =============================================================================
-- SELECT region_id, role, COUNT(*) as user_count 
-- FROM user_profiles 
-- GROUP BY region_id, role 
-- ORDER BY role, region_id;

-- SELECT 'Users without region_id' as check_name, COUNT(*) as count
-- FROM user_profiles 
-- WHERE region_id IS NULL 
--   AND role NOT IN ('HQ_ADMIN');

-- SELECT 'user_outlets count' as check_name, COUNT(*) as count
-- FROM user_outlets;
