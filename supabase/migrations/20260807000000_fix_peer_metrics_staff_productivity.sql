-- Fix R3: Update peer_metrics staff_productivity with varied realistic values
-- Previously all outlets had identical $75, now varies by region/type/size

UPDATE peer_metrics
SET
  staff_productivity = ROUND(
    base_val * type_mult * size_mult * rand_val, 2
  ),
  peer_avg_staff_productivity = ROUND(base_val * 0.95, 2)
FROM (
  VALUES
    (1,  320.0, 1.0, 1.3, 1.05),  -- WKN-001 Singapore standard large
    (2,  320.0, 1.0, 1.0, 0.88),  -- MYB-002 Singapore standard medium
    (3,  320.0, 1.4, 1.3, 1.12),  -- SAP-003 Singapore premium large
    (4,  180.0, 1.0, 1.0, 0.82),  -- JKT-004 Jakarta standard medium
    (5,  150.0, 1.0, 0.6, 0.75),  -- BDG-005 Bandung standard small
    (6,  160.0, 1.0, 1.0, 0.91),  -- SBY-006 Surabaya standard medium
    (7,  220.0, 1.4, 1.3, 1.18),  -- BKK-007 Bangkok premium large
    (8,  200.0, 1.0, 1.0, 0.85),  -- KUL-008 KL standard medium
    (164, 320.0, 1.0, 0.6, 0.79),  -- SG-Central standard small
    (165, 320.0, 1.0, 0.6, 0.83),  -- SG-East standard small
    (166, 320.0, 1.0, 0.6, 0.76),  -- SG-West standard small
    (167, 320.0, 1.0, 0.6, 0.88),  -- SG-North standard small
    (168, 320.0, 1.0, 0.6, 0.81),  -- SG-NE standard small
    (169, 180.0, 1.0, 0.6, 0.72),  -- JKT-009 Jakarta standard small
    (170, 180.0, 1.0, 1.0, 0.89),  -- JKT-010 Jakarta standard medium
    (171, 150.0, 1.0, 0.6, 0.68)   -- BDG-011 Bandung standard small
) AS v(outlet_id, base_val, type_mult, size_mult, rand_val)
WHERE peer_metrics.outlet_id = v.outlet_id
  AND metric_date = CURRENT_DATE;

-- Verify update
SELECT outlet_id, outlet_code, staff_productivity, peer_avg_staff_productivity
FROM peer_metrics
WHERE metric_date = CURRENT_DATE
ORDER BY staff_productivity DESC
LIMIT 20;
