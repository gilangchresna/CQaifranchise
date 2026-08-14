-- RBAC Phase 2: RLS Policies
-- Date: 2026-08-15
-- Purpose: Row Level Security policies for user_profiles, user_outlets, user_invites tables
-- Uses Supabase built-in auth.uid() and auth.role() for access control

-- ============================================================
-- Enable RLS on all RBAC tables
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Drop existing conflicting policies (safe to run repeatedly)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own outlet assignments" ON user_outlets;
DROP POLICY IF EXISTS "HQ can manage outlet assignments" ON user_outlets;
DROP POLICY IF EXISTS "HQ can view invites" ON user_invites;
DROP POLICY IF EXISTS "HQ can create invites" ON user_invites;
DROP POLICY IF EXISTS "HQ can update invites" ON user_invites;

-- ============================================================
-- user_profiles RLS Policies
-- ============================================================

-- All authenticated users can view user profiles (for lists/dropdowns)
CREATE POLICY "Authenticated users can view all profiles"
  ON user_profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can view their own profile (safety net)
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- HQ Admins can update any user profile (role, region changes)
CREATE POLICY "HQ Admins can update profiles"
  ON user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- ============================================================
-- user_outlets RLS Policies
-- ============================================================

-- Users can view their own outlet assignments
CREATE POLICY "Users can view own outlet assignments"
  ON user_outlets
  FOR SELECT
  USING (auth.uid() = user_id);

-- HQ Admins can manage (insert/update/delete) outlet assignments
CREATE POLICY "HQ Admins can manage outlet assignments"
  ON user_outlets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- ============================================================
-- user_invites RLS Policies
-- ============================================================

-- HQ Admins can view all invites
CREATE POLICY "HQ Admins can view invites"
  ON user_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- HQ Admins can create invites
CREATE POLICY "HQ Admins can create invites"
  ON user_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- HQ Admins can update invites (accept, expire, cancel)
CREATE POLICY "HQ Admins can update invites"
  ON user_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- ============================================================
-- Verification: Check policies were created
-- ============================================================
-- Run this in SQL Editor to verify:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename IN ('user_profiles', 'user_outlets', 'user_invites');
