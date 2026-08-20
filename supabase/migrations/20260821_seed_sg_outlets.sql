-- =====================================================
-- SG REGION (114) OUTLETS - Demo Data
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- Insert SG Region if not exists
INSERT INTO regions (id, name, country_code, country_name, currency_code, timezone)
VALUES (114, 'Singapore', 'SG', 'Singapore', 'SGD', 'Asia/Singapore')
ON CONFLICT (id) DO NOTHING;

-- Insert SG Outlets
INSERT INTO outlets (id, name, code, region_id, owner_id, platform_type, address, status, opened_at, monthly_rent, area_sqm, seating_capacity)
SELECT * FROM (VALUES
    (101, 'Marina Bay Sands', 'SG-SG001', 114, NULL, 'dine_in', '10 Bayfront Ave, Singapore 018956', 'active', '2023-01-15', 15000, 450, 120),
    (102, 'Orchard Road', 'SG-SG002', 114, NULL, 'dine_in', '391 Orchard Rd, Singapore 238872', 'active', '2023-03-20', 12000, 350, 90),
    (103, 'Changi Airport T3', 'SG-SG003', 114, NULL, 'quick_service', 'Airport Blvd, Singapore 819643', 'active', '2023-06-01', 8000, 200, 60),
    (104, 'Raffles Place', 'SG-SG004', 114, NULL, 'cafe', '1 Raffles Pl, Singapore 048616', 'active', '2023-09-10', 10000, 180, 45)
) AS t(id, name, code, region_id, owner_id, platform_type, address, status, opened_at, monthly_rent, area_sqm, seating_capacity)
WHERE NOT EXISTS (SELECT 1 FROM outlets WHERE code = 'SG-SG001');

-- Update sequence
SELECT setval('outlets_id_seq', (SELECT MAX(id) FROM outlets));

-- Verify
SELECT id, name, code, region_id, status FROM outlets WHERE region_id = 114;
