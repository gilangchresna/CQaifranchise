-- =====================================================
-- CyberQuote Knowledge Base Migration
-- Priority 1: Foundation - RAG Infrastructure
-- =====================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- KNOWLEDGE TABLES
-- =====================================================

-- 1. Knowledge Embeddings (Vector Store)
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(768),
  source_type VARCHAR(50) NOT NULL, -- 'sop', 'manual', 'incident', 'policy'
  source_id UUID,
  outlet_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_vector 
  ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_source_type ON knowledge_embeddings(source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_outlet ON knowledge_embeddings(outlet_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge_embeddings(created_at DESC);

-- =====================================================
-- 2. SOPs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL, -- 'operations', 'hr', 'finance', 'compliance'
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  outlet_id INTEGER, -- NULL = global SOP
  region_id INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sops_category ON knowledge_sops(category);
CREATE INDEX IF NOT EXISTS idx_sops_active ON knowledge_sops(is_active);

-- =====================================================
-- 3. Franchise Manuals Table
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  chapter VARCHAR(100),
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  franchise_type VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manuals_type ON knowledge_manuals(franchise_type);

-- =====================================================
-- 4. Incident Resolutions Table
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type VARCHAR(100) NOT NULL,
  description TEXT,
  root_cause TEXT,
  resolution TEXT NOT NULL,
  outlet_id INTEGER,
  region_id INTEGER,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_type ON knowledge_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_outlet ON knowledge_incidents(outlet_id);

-- =====================================================
-- 5. Policies Table
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  policy_type VARCHAR(100) NOT NULL, -- 'hr', 'compliance', 'operations', 'safety'
  content TEXT NOT NULL,
  effective_date DATE,
  outlet_id INTEGER,
  region_id INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_type ON knowledge_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_policies_active ON knowledge_policies(is_active);

-- =====================================================
-- VECTOR SEARCH FUNCTION (PostgreSQL RPC)
-- =====================================================
CREATE OR REPLACE FUNCTION match_knowledge_embeddings(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source_type VARCHAR(50),
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ke.id,
    ke.content,
    ke.source_type,
    ke.metadata,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings ke
  WHERE 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_policies ENABLE ROW LEVEL SECURITY;

-- Policy for knowledge embeddings
CREATE POLICY "HQ can see all knowledge" ON knowledge_embeddings
  FOR SELECT USING (
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'HQ_ADMIN'
  );

CREATE POLICY "Regional can see own region knowledge" ON knowledge_embeddings
  FOR SELECT USING (
    outlet_id IS NULL OR
    region_id IN (SELECT region_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- =====================================================
-- SAMPLE DATA: Initial SOPs
-- =====================================================
INSERT INTO knowledge_sops (title, category, content) VALUES
('Daily Opening Procedures', 'operations', 'DAILY OPENING CHECKLIST
1. Unlock outlet 15 minutes before operating hours
2. Turn on all lights and HVAC
3. Check POS system is operational
4. Count cash drawer - minimum S$200 float
5. Review yesterday sales report
6. Check today delivery schedule
7. Inspect inventory levels for top 10 items
8. Brief staff on today targets
9. Ensure cleanliness standards met
10. Open doors on time'),

('Stock Reorder Protocol', 'operations', 'STOCK REORDER GUIDELINES
When to reorder:
- When stock falls below 30% of maximum capacity
- Daily items: reorder when 3 days supply remaining
- Weekly items: reorder when 1 week supply remaining

How to reorder:
1. Open inventory module in POS
2. Select items below reorder point
3. Generate purchase order
4. Submit to approved suppliers only
5. Confirm delivery date with supplier

Emergency reorder:
- Contact regional warehouse
- Use emergency stock transfer form
- Notify regional manager immediately'),

('Customer Complaint Handling', 'operations', 'CUSTOMER COMPLAINT RESOLUTION
Step 1: Listen actively
- Let customer explain without interruption
- Show empathy and understanding

Step 2: Apologize sincerely
- "We sorry this happened"
- Take ownership of the issue

Step 3: Resolve immediately
- Offer replacement, refund, or compensation
- Aim for first-contact resolution

Step 4: Document in system
- Log complaint in CRM
- Assign follow-up if unresolved

Step 5: Follow up
- Contact customer within 24 hours
- Ensure satisfaction

Escalation: If unresolved in 24hrs, escalate to regional manager.'),

('Staff Scheduling Guidelines', 'hr', 'WORKFORCE SCHEDULING STANDARDS
Staffing Levels:
- Peak hours (11am-2pm, 6pm-9pm): Minimum 3 staff
- Off-peak: Minimum 2 staff
- Weekend: Add 1 additional staff

Schedule Rules:
- Minimum 8 hours between shifts
- Maximum 10 hours per shift
- 1 day off per week mandatory
- Submit schedule 1 week in advance

Overtime:
- Pre-approved only
- Max 20 hours per month
- Rate: 1.5x base pay'),

('Cash Handling Policy', 'finance', 'CASH HANDLING PROCEDURES
Daily Cash Management:
1. Count cash drawer at start and end of shift
2. Use cash register locking system
3. Never leave cash drawer unattended
4. Two-person count for amounts over S$1000

Cash Deposit:
- Make bank deposit daily if over S$500
- Use secure courier service
- Get receipt and file

Petty Cash:
- Maintain S$100 float
- Replenish weekly
- Document all expenditures

Discrepancies:
- Report immediately to manager
- Investigate within 24 hours
- Escalate if over S$50 variance'),

('Food Safety Compliance', 'compliance', 'FOOD SAFETY REQUIREMENTS
Daily Checks:
- Temperature logs every 2 hours
- Expiry date verification
- Hygiene inspection

Temperature Standards:
- Refrigerator: 0-4C
- Freezer: -18C or below
- Hot holding: Above 60C
- Cooking: Above 75C

Staff Hygiene:
- Hand washing every 30 minutes
- Clean uniform daily
- Health declaration required
- Report illness immediately

Incident Response:
- Isolate affected food
- Document temperature breach
- Report to health authority if required');

-- =====================================================
-- SAMPLE DATA: Initial Incidents
-- =====================================================
INSERT INTO knowledge_incidents (incident_type, description, root_cause, resolution, resolved_at) VALUES
('Stockout', 'Top-selling item unavailable during lunch rush', 'Supplier delivery delayed due to vehicle breakdown', 'Emergency transfer from nearby outlet + expedited next-day delivery from supplier. Offered customer alternative menu item with 20% discount.', NOW()),

('Staff Absence', 'Two staff called in sick for same shift', 'Staff not following sick leave notification protocol', 'Called in off-duty staff with overtime. Adjusted menu to simpler offerings. Added staff to backup contact list.', NOW()),

('Equipment Failure', 'POS system crashed during peak hours', 'Network connectivity issue', 'Switched to manual order taking. Used backup tablet. IT team reset network. Normal operations resumed in 45 minutes.', NOW()),

('Customer Complaint', 'Foreign object found in food', 'Breakage from worn equipment part', 'Immediately replaced food, issued full refund + S$50 voucher. Replaced equipment part. Conducted full kitchen inspection.', NOW());

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION match_knowledge_embeddings TO service_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
