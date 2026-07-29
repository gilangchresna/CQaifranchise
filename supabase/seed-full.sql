-- CyberQuote Database Seed Script
-- Run this in Supabase Dashboard > SQL Editor

-- =====================================================
-- STEP 1: Create Tables (if not exist)
-- =====================================================

-- ML Models Registry
CREATE TABLE IF NOT EXISTS ml_models (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT DEFAULT 'Production',
  metrics TEXT,
  provider TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Agents
CREATE TABLE IF NOT EXISTS ai_agents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Active',
  tools TEXT[] DEFAULT '{}',
  config JSONB DEFAULT '{}',
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations
CREATE TABLE IF NOT EXISTS integrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  status TEXT DEFAULT 'Connected',
  config JSONB DEFAULT '{}',
  last_sync TIMESTAMPTZ,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff (Workforce)
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  outlet_id INTEGER REFERENCES outlets(id),
  status TEXT DEFAULT 'present',
  shift_start TIME,
  shift_end TIME,
  contact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 2: Seed Data
-- =====================================================

-- ML Models
INSERT INTO ml_models (name, type, version, status, metrics, provider, config) VALUES
('Sales Anomaly Detection', 'Prediction', 'v2.4', 'Production', 'Drift: 1.2%', 'Internal / TensorFlow', '{"threshold": 0.15, "window_hours": 1}'),
('Stockout Prediction', 'Prediction', 'v1.2', 'Production', 'F1 Score: 0.94', 'Internal / PyTorch', '{"horizon_hours": 48, "confidence": 0.85}'),
('Franchise Distress Score', 'Classification', 'v0.8-beta', 'Evaluation', 'AUC: 0.82', 'Internal / XGBoost', '{"features": ["sales", "inventory", "staffing"]}'),
('Enterprise Copilot LLM', 'LLM', 'gemini-1.5-pro', 'Production', 'Latency: 450ms', 'Google Vertex AI', '{"max_tokens": 8192, "temperature": 0.7}'),
('SOP Document Embedding', 'Embedding', 'text-embedding-004', 'Production', 'Dim: 768', 'Google Vertex AI', '{"model": "text-embedding-004"}')
ON CONFLICT DO NOTHING;

-- AI Agents
INSERT INTO ai_agents (name, description, status, tools, config, last_run) VALUES
('Hermes Orchestrator', 'Main operational agent. Monitors alerts, checks inventory via MCP, and drafts case actions.', 'Active', ARRAY['erp_connector', 'pos_alerting', 'sendgrid'], '{"interval_seconds": 60}', NOW() - INTERVAL '2 minutes'),
('Stockout Predictor Cron', 'Runs batch inference against ODS to update stockout risk scores.', 'Active', ARRAY['data_lake_reader', 'feature_store'], '{"cron": "*/15 * * * *"}', NOW() - INTERVAL '1 hour'),
('Compliance Checker', 'Reviews franchisee actions against standard operating procedures.', 'Paused', ARRAY['vector_db', 'case_manager'], '{"review_threshold": "P1"}', NOW() - INTERVAL '2 days'),
('Athena Insights', 'Provides AI-powered insights and recommendations for outlet operations.', 'Active', ARRAY['llm_gateway', 'knowledge_base'], '{"model": "gemini-1.5-pro"}', NOW() - INTERVAL '5 minutes')
ON CONFLICT DO NOTHING;

-- Integrations
INSERT INTO integrations (name, type, url, status, config, last_sync, details) VALUES
('HQ ERP (Dynamics 365)', 'MCP', 'https://mcp.hq.cyberquote.internal/erp', 'Connected', '{"tools": ["get_inventory", "create_transfer", "update_sku"]}', NOW() - INTERVAL '2 minutes', 'Read/Write access for inventory and master data'),
('POS Central (Aloha)', 'MCP', 'https://mcp.hq.cyberquote.internal/pos', 'Connected', '{"tools": ["get_sales", "apply_discount"]}', NOW() - INTERVAL '1 minute', 'Real-time sales read access and discounting'),
('PostgreSQL ODS', 'PostgreSQL', 'jdbc:postgresql://db.internal/core', 'Live', '{"pool_size": 10}', NOW(), 'Operational Data Store (Real-time)'),
('Medallion Lakehouse', 'VectorDB', 's3://cyberquote-data-lake', 'Synced', '{"format": "parquet"}', NOW() - INTERVAL '1 hour', 'S3 + Athena Analytics Engine'),
('Pinecone Vector DB', 'VectorDB', 'https://pinecone.io/cyberquote', 'Synced', '{"index": "sop_embeddings"}', NOW() - INTERVAL '10 minutes', 'RAG Knowledge Base embeddings'),
('POS & Event Bus', 'Kafka', 'pos.sales.events', 'Live', '{"partitions": 12}', NOW(), '12.4k msgs / min')
ON CONFLICT DO NOTHING;

-- Staff (Workforce) - use first available outlet
DO $$
DECLARE
  outlet_104_id INTEGER;
  outlet_089_id INTEGER;
  outlet_210_id INTEGER;
BEGIN
  SELECT id INTO outlet_104_id FROM outlets WHERE code = 'OUT-104' LIMIT 1;
  SELECT id INTO outlet_089_id FROM outlets WHERE code = 'OUT-089' LIMIT 1;
  SELECT id INTO outlet_210_id FROM outlets WHERE code = 'OUT-210' LIMIT 1;

  IF outlet_104_id IS NOT NULL THEN
    INSERT INTO staff (name, role, outlet_id, status, shift_start, shift_end, contact) VALUES
    ('Alice Smith', 'Store Manager', outlet_104_id, 'present', '08:00', '16:00', '+6281234567001'),
    ('Bob Johnson', 'Kitchen Staff', outlet_104_id, 'absent', '08:00', '16:00', '+6281234567002'),
    ('Frank Wilson', 'Cashier', outlet_104_id, 'present', '14:00', '22:00', '+6281234567006');
  END IF;

  IF outlet_089_id IS NOT NULL THEN
    INSERT INTO staff (name, role, outlet_id, status, shift_start, shift_end, contact) VALUES
    ('Charlie Lee', 'Cashier', outlet_089_id, 'present', '10:00', '18:00', '+6281234567003'),
    ('Eve Martinez', 'Store Manager', outlet_089_id, 'present', '07:00', '15:00', '+6281234567005'),
    ('Henry Brown', 'Supervisor', outlet_089_id, 'present', '06:00', '14:00', '+6281234567008');
  END IF;

  IF outlet_210_id IS NOT NULL THEN
    INSERT INTO staff (name, role, outlet_id, status, shift_start, shift_end, contact) VALUES
    ('Diana Prince', 'Kitchen Staff', outlet_210_id, 'late', '12:00', '20:00', '+6281234567004'),
    ('Grace Kim', 'Kitchen Staff', outlet_210_id, 'present', '08:00', '16:00', '+6281234567007');
  END IF;
END $$;

-- =====================================================
-- STEP 3: Enable RLS (Row Level Security)
-- =====================================================

ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all
CREATE POLICY "Allow read" ON ml_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read" ON ai_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read" ON integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read" ON staff FOR SELECT TO authenticated USING (true);

-- Allow service role to do all
CREATE POLICY "Service full access" ON ml_models FOR ALL TO service_role USING (true);
CREATE POLICY "Service full access" ON ai_agents FOR ALL TO service_role USING (true);
CREATE POLICY "Service full access" ON integrations FOR ALL TO service_role USING (true);
CREATE POLICY "Service full access" ON staff FOR ALL TO service_role USING (true);

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'ml_models' as table_name, COUNT(*) as count FROM ml_models
UNION ALL SELECT 'ai_agents', COUNT(*) FROM ai_agents
UNION ALL SELECT 'integrations', COUNT(*) FROM integrations
UNION ALL SELECT 'staff', COUNT(*) FROM staff;
