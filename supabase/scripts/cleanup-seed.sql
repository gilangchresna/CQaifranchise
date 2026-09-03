-- ============================================================
-- CLEANUP SQL - Delete all transaction/task data
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Delete agent tasks
DELETE FROM public.agent_tasks WHERE id IS NOT NULL;
-- Should delete ~1100 rows

-- 2. Delete agent logs
DELETE FROM public.agent_logs WHERE id IS NOT NULL;

-- 3. Delete agent metrics
DELETE FROM public.agent_metrics WHERE id IS NOT NULL;

-- 4. Delete alerts
DELETE FROM public.alerts WHERE id IS NOT NULL;
-- Should delete ~100 rows

-- 5. Delete cases
DELETE FROM public.cases WHERE id IS NOT NULL;

-- 6. Delete notifications
DELETE FROM public.notifications WHERE id IS NOT NULL;

-- 7. Delete notification logs
DELETE FROM public.notification_logs WHERE id IS NOT NULL;

-- 8. Delete sales transactions
DELETE FROM public.sales_transactions WHERE id IS NOT NULL;

-- 9. Delete ml_anomaly_scores
DELETE FROM public.ml_anomaly_scores WHERE id IS NOT NULL;

-- 10. Delete ml_stockout_risk
DELETE FROM public.ml_stockout_risk WHERE id IS NOT NULL;

-- 11. Delete workflow instances
DELETE FROM public.workflow_instances WHERE id IS NOT NULL;

-- 12. Delete workflow steps
DELETE FROM public.workflow_steps WHERE id IS NOT NULL;

-- ============================================================
-- VERIFY CLEANUP
-- ============================================================
SELECT 'agent_tasks' as table_name, COUNT(*) as remaining FROM public.agent_tasks
UNION ALL SELECT 'agent_logs', COUNT(*) FROM public.agent_logs
UNION ALL SELECT 'agent_metrics', COUNT(*) FROM public.agent_metrics
UNION ALL SELECT 'alerts', COUNT(*) FROM public.alerts
UNION ALL SELECT 'cases', COUNT(*) FROM public.cases
UNION ALL SELECT 'notifications', COUNT(*) FROM public.notifications
UNION ALL SELECT 'sales_transactions', COUNT(*) FROM public.sales_transactions
UNION ALL SELECT 'ml_anomaly_scores', COUNT(*) FROM public.ml_anomaly_scores;

-- ============================================================
-- SEED CLEAN DATA
-- ============================================================

-- Seed 5 Singapore outlets
INSERT INTO public.outlets (id, region_id, code, name, status, daily_target) VALUES
  (156, 104, 'KT-TMP-001', 'Kopitiam @ Tampines Mall', 'ACTIVE', 2500),
  (157, 107, 'CR-JGP-001', 'Chicken Rice @ Jurong Point', 'ACTIVE', 2800),
  (158, 104, 'NL-AMK-001', 'Nasi Lemak @ AMK Hub', 'ACTIVE', 2200),
  (159, 106, 'LK-PLB-001', 'Laksa King @ Paya Lebar', 'ACTIVE', 2400),
  (160, 107, 'KT-CMT-001', 'Kaya Toast @ Clementi Mall', 'ACTIVE', 2300)
ON CONFLICT (id) DO UPDATE SET
  region_id = EXCLUDED.region_id,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  daily_target = EXCLUDED.daily_target;

-- Seed inventory for each outlet
INSERT INTO public.inventory (outlet_id, item_name, item_code, current_stock, min_stock, max_stock, unit, category)
SELECT
  o.id as outlet_id,
  item.name,
  o.code || '-' || item.seq as item_code,
  item.stock,
  item.min_stock,
  item.min_stock * 3,
  item.unit,
  'Food & Beverage'
FROM public.outlets o
CROSS JOIN (
  VALUES
    ('Kopi', 'cups', 100, 50, 1),
    ('Teh', 'cups', 120, 50, 2),
    ('Roti', 'pieces', 45, 30, 3),
    ('Nasi', 'kg', 15, 10, 4),
    ('Ayam', 'kg', 12, 10, 5),
    ('Laksa', 'portions', 35, 25, 6),
    ('Mie', 'kg', 18, 15, 7)
) AS item(name, unit, stock, min_stock, seq)
WHERE o.code IN ('KT-TMP-001', 'CR-JGP-001', 'NL-AMK-001', 'LK-PLB-001', 'KT-CMT-001')
ON CONFLICT (outlet_id, item_code) DO UPDATE SET
  current_stock = EXCLUDED.current_stock,
  min_stock = EXCLUDED.min_stock;

-- Seed sample agent tasks (clean, minimal)
INSERT INTO public.agent_tasks (agent_id, task_type, status, priority, description, input_data, created_at, started_at, completed_at)
VALUES
  ('monitor', 'anomaly_check', 'completed', 2, 'Daily sales anomaly scan', '{"source": "system", "demo": true}', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '3 minutes'),
  ('analyst', 'stockout_predict', 'completed', 3, 'Inventory stockout prediction', '{"source": "system", "demo": true}', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '1 minute'),
  ('triage', 'alert_triage', 'pending', 1, 'Alert prioritization check', '{"source": "system", "demo": true}', NOW() - INTERVAL '1 minute', NULL, NULL)
ON CONFLICT DO NOTHING;

-- Seed agent logs
INSERT INTO public.agent_logs (agent_id, log_level, message, metadata, created_at)
VALUES
  ('coordinator', 'info', 'System initialized - clean data loaded', '{"event": "init"}', NOW()),
  ('monitor', 'info', 'Anomaly detection completed - no issues found', '{"anomalies": 0}', NOW()),
  ('analyst', 'info', 'Stockout analysis completed - all outlets healthy', '{"predictions": 5}', NOW()),
  ('triage', 'info', 'Alert queue empty - system healthy', '{"alerts": 0}', NOW());

-- ============================================================
-- VERIFY FINAL STATE
-- ============================================================
SELECT
  'Outlets' as metric, COUNT(*) as count FROM public.outlets WHERE status = 'ACTIVE'
UNION ALL
SELECT 'Inventory Items', COUNT(*) FROM public.inventory
UNION ALL
SELECT 'Agent Tasks', COUNT(*) FROM public.agent_tasks
UNION ALL
SELECT 'Agent Logs', COUNT(*) FROM public.agent_logs
UNION ALL
SELECT 'Alerts', COUNT(*) FROM public.alerts;
