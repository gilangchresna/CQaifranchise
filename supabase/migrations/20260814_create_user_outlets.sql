-- Migration 2: Create user_outlets junction table
-- Date: 2026-08-14
-- Purpose: RBAC Phase 1 - Many-to-many relationship between users and outlets

-- Create user_outlets junction table
CREATE TABLE IF NOT EXISTS user_outlets (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  outlet_id INT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique relationship (user can only be linked once per outlet)
  UNIQUE (user_id, outlet_id),
  
  -- Constraint: user must be staff or owner role
  CONSTRAINT chk_user_outlets_role CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = user_id 
      AND role IN ('FRANCHISEE_STAFF', 'FRANCHISEE_OWNER')
    )
  )
);

-- Index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_user_outlets_user ON user_outlets(user_id);

-- Index for efficient outlet lookups
CREATE INDEX IF NOT EXISTS idx_user_outlets_outlet ON user_outlets(outlet_id);

-- Composite index for common access pattern
CREATE INDEX IF NOT EXISTS idx_user_outlets_user_outlet ON user_outlets(user_id, outlet_id);

-- Comment for documentation
COMMENT ON TABLE user_outlets IS 'Junction table for user-outlet assignments. Controls which outlets a user can access.';
