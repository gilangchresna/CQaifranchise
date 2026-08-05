-- =====================================================
-- Approval Workflows Tables
-- Human-in-the-loop for AI agent actions
-- =====================================================

-- 1. Pending Approval Requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type VARCHAR(50) NOT NULL,  -- CASE_CREATE, ESCALATE, ALERT, RESOLVE
  trigger_source VARCHAR(100) NOT NULL,  -- AI_AGENT, ML_MODEL, SYSTEM
  
  -- Related entity
  related_entity_id UUID,
  related_entity_type VARCHAR(50),  -- alert, case, outlet
  related_entity_code VARCHAR(100),
  
  -- Request details
  request_payload JSONB NOT NULL,  -- What AI wants to do
  reasoning TEXT,  -- Why AI wants to do it
  priority VARCHAR(20) DEFAULT 'MEDIUM',  -- HIGH, MEDIUM, LOW
  
  -- Status
  status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, EXPIRED, CANCELLED
  
  -- Assignment
  requested_by UUID,
  approver_role VARCHAR(50) NOT NULL,  -- Required approver role
  assigned_approver UUID,
  
  -- Resolution
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional context
  outlet_id INTEGER,
  region_id INTEGER,
  metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_type ON approval_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_approver ON approval_requests(assigned_approver);
CREATE INDEX IF NOT EXISTS idx_approval_outlet ON approval_requests(outlet_id);
CREATE INDEX IF NOT EXISTS idx_approval_created ON approval_requests(created_at DESC);

-- 2. Approval History (Audit Log)
CREATE TABLE IF NOT EXISTS approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id),
  action VARCHAR(20) NOT NULL,  -- CREATED, APPROVED, REJECTED, EXPIRED, CANCELLED, ESCALATED
  actor_id UUID,
  actor_role VARCHAR(50),
  actor_name VARCHAR(255),
  comment TEXT,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_history_request ON approval_history(request_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON approval_history(created_at DESC);

-- 3. Approval Rules Configuration
CREATE TABLE IF NOT EXISTS approval_rules (
  id SERIAL PRIMARY KEY,
  request_type VARCHAR(50) NOT NULL,
  trigger_condition JSONB NOT NULL,  -- { severity: 'P1', condition: '>' }
  required_approver_role VARCHAR(50) NOT NULL,
  sla_hours INTEGER DEFAULT 24,
  auto_escalate BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default approval rules
INSERT INTO approval_rules (request_type, trigger_condition, required_approver_role, sla_hours, auto_escalate) VALUES
('CASE_CREATE', '{"severity": "P1_CRITICAL"}', 'HQ_ADMIN', 1, true),
('CASE_CREATE', '{"severity": "P2_HIGH"}', 'REGIONAL_MANAGER', 4, false),
('CASE_CREATE', '{"severity": "P3_MEDIUM"}', 'FRANCHISEE_OWNER', 24, false),
('ESCALATE', '{"risk_score": 80}', 'HQ_ADMIN', 2, true),
('ALERT_BULK', '{"affected_outlets": 5}', 'HQ_ADMIN', 1, true),
('AUTO_RESOLVE', '{}', 'REGIONAL_MANAGER', 24, false)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE DATA: Pending Approval Requests
-- =====================================================
INSERT INTO approval_requests (
  request_type, trigger_source, related_entity_type, request_payload, reasoning, priority,
  approver_role, status, outlet_id, region_id, expires_at
) VALUES
(
  'CASE_CREATE', 'AI_AGENT', 'alert',
  '{"alert_id": 101, "title": "Critical Stockout Risk - WKN-001", "severity": "P1_CRITICAL", "suggested_action": "Create case and notify franchisee"}',
  'Stock risk score reached 92% at WKN-001. 3 items critical. Immediate action required.',
  'HIGH', 'REGIONAL_MANAGER', 'PENDING', 1, 1, NOW() + INTERVAL '1 hour'
),
(
  'ESCALATE', 'ML_MODEL', 'outlet',
  '{"outlet_id": 4, "outlet_code": "JKT-004", "action": "ESCALATE_TO_HQ", "reason": "Sustained underperformance for 7 days"}',
  'JKT-004 has been below peer average by >20% for 7 consecutive days. Escalation to HQ recommended.',
  'MEDIUM', 'HQ_ADMIN', 'PENDING', 4, 4, NOW() + INTERVAL '4 hours'
),
(
  'CASE_CREATE', 'AI_AGENT', 'alert',
  '{"alert_id": 102, "title": "Staff Shortage - SAP-003", "severity": "P2_HIGH", "suggested_action": "Create case for HR review"}',
  'SAP-003 is operating below minimum staffing level. 2 staff on leave, 1 called in sick.',
  'MEDIUM', 'REGIONAL_MANAGER', 'PENDING', 3, 1, NOW() + INTERVAL '4 hours'
),
(
  'AUTO_RESOLVE', 'SYSTEM', 'case',
  '{"case_id": 45, "case_title": "Low Sales Alert - MYB-002", "ai_suggestion": "Auto-resolve as sales normalized", "confidence": 0.87}',
  'AI suggests closing case #45 as sales have returned to normal. Confidence: 87%. Awaiting human confirmation.',
  'LOW', 'REGIONAL_MANAGER', 'PENDING', 2, 1, NOW() + INTERVAL '24 hours'
);

-- =====================================================
-- HELPER FUNCTION: Get pending approval count
-- =====================================================
CREATE OR REPLACE FUNCTION get_pending_approvals_count(p_approver_role VARCHAR DEFAULT NULL)
RETURNS TABLE(count BIGINT) AS $$
BEGIN
  IF p_approver_role IS NULL THEN
    RETURN QUERY SELECT count(*) FROM approval_requests WHERE status = 'PENDING';
  ELSE
    RETURN QUERY SELECT count(*) FROM approval_requests 
      WHERE status = 'PENDING' AND approver_role = p_approver_role;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTION: Log approval action
-- =====================================================
CREATE OR REPLACE FUNCTION log_approval_action(
  p_request_id UUID,
  p_action VARCHAR,
  p_actor_id UUID,
  p_actor_role VARCHAR,
  p_actor_name VARCHAR,
  p_comment TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_history_id UUID;
  v_previous_status VARCHAR(20);
BEGIN
  -- Get current status
  SELECT status INTO v_previous_status FROM approval_requests WHERE id = p_request_id;
  
  -- Insert history record
  INSERT INTO approval_history (
    request_id, action, actor_id, actor_role, actor_name, comment,
    previous_status, new_status, metadata
  ) VALUES (
    p_request_id, p_action, p_actor_id, p_actor_role, p_actor_name, p_comment,
    v_previous_status, 
    CASE p_action 
      WHEN 'APPROVED' THEN 'APPROVED'
      WHEN 'REJECTED' THEN 'REJECTED'
      WHEN 'EXPIRED' THEN 'EXPIRED'
      ELSE v_previous_status
    END,
    p_metadata
  ) RETURNING id INTO v_history_id;
  
  RETURN v_history_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approval_requests_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'Approval Workflows Setup Complete!' as status;
SELECT count(*) as pending_requests FROM approval_requests WHERE status = 'PENDING';
SELECT count(*) as approval_rules FROM approval_rules WHERE is_active = true;
