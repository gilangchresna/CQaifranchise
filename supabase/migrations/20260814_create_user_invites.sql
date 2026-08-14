-- Migration 3: Create user_invites table
-- Date: 2026-08-14
-- Purpose: RBAC Phase 1 - Invite system for user onboarding with role/region assignment

-- Create user_invites table
CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Invitee information
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'FRANCHISEE_STAFF' CHECK (
    role IN ('HQ_ADMIN', 'REGIONAL_MANAGER', 'FRANCHISEE_OWNER', 'FRANCHISEE_STAFF')
  ),
  region_id INT REFERENCES regions(id),
  
  -- Invite token for email link
  invite_token VARCHAR(255) UNIQUE NOT NULL,
  
  -- Inviter reference
  invited_by UUID REFERENCES user_profiles(id),
  
  -- Expiration (default 7 days)
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'expired', 'cancelled')
  ),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  -- Optional message
  message TEXT
);

-- Index for email lookups (check if user already invited)
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);

-- Index for token lookups (invite link validation)
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(invite_token);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_user_invites_status ON user_invites(status);

-- Index for inviter lookups
CREATE INDEX IF NOT EXISTS idx_user_invites_invited_by ON user_invites(invited_by);

-- Composite index for pending invites by region
CREATE INDEX IF NOT EXISTS idx_user_invites_region_pending ON user_invites(region_id, status) WHERE status = 'pending';

-- Comment for documentation
COMMENT ON TABLE user_invites IS 'User invitation system with role/region assignment for RBAC onboarding.';
