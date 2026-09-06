-- Migration 1: Add region_id to user_profiles
-- Date: 2026-08-14
-- Purpose: RBAC Phase 1 - Add region column for regional access control

-- Add region_id column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS region_id INT REFERENCES regions(id);

-- Create index for efficient region lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_region ON user_profiles(region_id);

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Add composite index for common query pattern (role + region)
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_region ON user_profiles(role, region_id);

-- Comment for documentation
COMMENT ON COLUMN user_profiles.region_id IS 'FK to regions table. NULL for HQ_ADMIN who see all regions.';
