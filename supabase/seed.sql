-- CyberQuote Database Seed Script

-- =====================================================
-- ML MODELS REGISTRY
-- =====================================================
INSERT INTO ml_models (name, type, version, status, metrics, provider, config) VALUES
('Sales Anomaly Detection', 'Prediction', 'v2.4', 'Production', 'Drift: 1.2%', 'Internal / TensorFlow', '{"threshold": 0.15, "window_hours": 1}'),
('Stockout Prediction', 'Prediction', 'v1.2', 'Production', 'F1 Score: 0.94', 'Internal / PyTorch', '{"horizon_hours": 48, "confidence": 0.85}'),
('Franchise Distress Score', 'Classification', 'v0.8-beta', 'Evaluation', 'AUC: 0.82', 'Internal / XGBoost', '{"features": ["sales", "inventory", "staffing"]}'),
('Enterprise Copilot LLM', 'LLM', 'gemini-1.5-pro', 'Production', 'Latency: 450ms', 'Google Vertex AI', '{"max_tokens": 8192, "temperature": 0.7}'),
('SOP Document Embedding', 'Embedding', 'text-embedding-004', 'Production', 'Dim: 768', 'Google Vertex AI', '{"model": "text-embedding-004"}');

-- =====================================================
-- AI AGENTS
-- =====================================================
INSERT INTO ai_agents (name, description, status, tools, config, last_run) VALUES
('Hermes Orchestrator', 'Main operational agent. Monitors alerts, checks inventory via MCP, and drafts case actions.', 'Active', '["erp_connector", "pos_alerting", "sendgrid"]', '{"interval_seconds": 60}', NOW() - INTERVAL '2 minutes'),
('Stockout Predictor Cron', 'Runs batch inference against ODS to update stockout risk scores.', 'Active', '["data_lake_reader", "feature_store"]', '{"cron": "*/15 * * * *"}', NOW() - INTERVAL '1 hour'),
('Compliance Checker', 'Reviews franchisee actions against standard operating procedures.', 'Paused', '["vector_db", "case_manager"]', '{"review_threshold": "P1"}', NOW() - INTERVAL '2 days'),
('Athena Insights', 'Provides AI-powered insights and recommendations for outlet operations.', 'Active', '["llm_gateway", "knowledge_base"]', '{"model": "gemini-1.5-pro"}', NOW() - INTERVAL '5 minutes');

-- =====================================================
-- INTEGRATIONS
-- =====================================================
INSERT INTO integrations (name, type, url, status, config, last_sync, details) VALUES
('HQ ERP (Dynamics 365)', 'MCP', 'https://mcp.hq.cyberquote.internal/erp', 'Connected', '{"tools": ["get_inventory", "create_transfer", "update_sku"]}', NOW() - INTERVAL '2 minutes', 'Read/Write access for inventory and master data'),
('POS Central (Aloha)', 'MCP', 'https://mcp.hq.cyberquote.internal/pos', 'Connected', '{"tools": ["get_sales", "apply_discount"]}', NOW() - INTERVAL '1 minute', 'Real-time sales read access and discounting'),
('PostgreSQL ODS', 'PostgreSQL', 'jdbc:postgresql://db.internal/core', 'Live', '{"pool_size": 10}', NOW(), 'Operational Data Store (Real-time)'),
('Medallion Lakehouse', 'VectorDB', 's3://cyberquote-data-lake', 'Synced', '{"format": "parquet"}', NOW() - INTERVAL '1 hour', 'S3 + Athena Analytics Engine'),
('Pinecone Vector DB', 'VectorDB', 'https://pinecone.io/cyberquote', 'Synced', '{"index": "sop_embeddings"}', NOW() - INTERVAL '10 minutes', 'RAG Knowledge Base embeddings'),
('POS & Event Bus', 'Kafka', 'pos.sales.events', 'Live', '{"partitions": 12}', NOW(), '12.4k msgs / min');

-- =====================================================
-- STAFF (WORKFORCE)
-- =====================================================
INSERT INTO staff (name, role, outlet_id, status, shift_start, shift_end, contact) 
SELECT 
  name, role, outlet_id, status, shift_start, shift_end, contact
FROM (
  VALUES
  ('Alice Smith', 'Store Manager', (SELECT id FROM outlets WHERE code = 'OUT-104' LIMIT 1), 'present', '08:00', '16:00', '+6281234567001'),
  ('Bob Johnson', 'Kitchen Staff', (SELECT id FROM outlets WHERE code = 'OUT-104' LIMIT 1), 'absent', '08:00', '16:00', '+6281234567002'),
  ('Charlie Lee', 'Cashier', (SELECT id FROM outlets WHERE code = 'OUT-089' LIMIT 1), 'present', '10:00', '18:00', '+6281234567003'),
  ('Diana Prince', 'Kitchen Staff', (SELECT id FROM outlets WHERE code = 'OUT-210' LIMIT 1), 'late', '12:00', '20:00', '+6281234567004'),
  ('Eve Martinez', 'Store Manager', (SELECT id FROM outlets WHERE code = 'OUT-089' LIMIT 1), 'present', '07:00', '15:00', '+6281234567005'),
  ('Frank Wilson', 'Cashier', (SELECT id FROM outlets WHERE code = 'OUT-104' LIMIT 1), 'present', '14:00', '22:00', '+6281234567006'),
  ('Grace Kim', 'Kitchen Staff', (SELECT id FROM outlets WHERE code = 'OUT-210' LIMIT 1), 'present', '08:00', '16:00', '+6281234567007'),
  ('Henry Brown', 'Supervisor', (SELECT id FROM outlets WHERE code = 'OUT-089' LIMIT 1), 'present', '06:00', '14:00', '+6281234567008')
) AS t(name, role, outlet_id, status, shift_start, shift_end, contact)
WHERE (SELECT id FROM outlets WHERE code = 'OUT-104' LIMIT 1) IS NOT NULL
   OR (SELECT id FROM outlets WHERE code = 'OUT-089' LIMIT 1) IS NOT NULL
   OR (SELECT id FROM outlets WHERE code = 'OUT-210' LIMIT 1) IS NOT NULL;
