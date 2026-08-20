-- =====================================================
-- ADD SG OUTLETS (SG-004 to SG-010)
-- Total SG outlets will be 10
-- Run in Supabase Dashboard > SQL Editor
-- =====================================================

-- Insert 7 more SG outlets
INSERT INTO outlets (name, code, region_id, platform_type, address, status, opened_at, monthly_rent, area_sqm, seating_capacity)
SELECT * FROM (VALUES
    ('SG Raffles Place', 'SG-004', 1, 'cafe', '1 Raffles Place, Singapore 048616', 'active', '2023-02-15', 10000, 180, 45),
    ('SG Jurong', 'SG-005', 1, 'quick_service', 'Jurong Point, Singapore 648886', 'active', '2023-04-20', 7500, 150, 40),
    ('SG Tampines', 'SG-006', 1, 'dine_in', 'Tampines Mall, Singapore 529541', 'active', '2023-05-10', 8500, 200, 55),
    ('SG Sentosa', 'SG-007', 1, 'dine_in', 'Resorts World Sentosa, Singapore 098970', 'active', '2023-07-01', 12000, 300, 80),
    ('SG Clementi', 'SG-008', 1, 'quick_service', 'The Clementi Mall, Singapore 129588', 'active', '2023-08-15', 7000, 140, 38),
    ('SG Novena', 'SG-009', 1, 'cafe', 'United Square, Singapore 307591', 'active', '2023-09-20', 9000, 160, 42),
    ('SG Bishan', 'SG-010', 1, 'dine_in', 'Junction 8, Singapore 570214', 'active', '2023-10-01', 8000, 190, 50)
) AS t(name, code, region_id, platform_type, address, status, opened_at, monthly_rent, area_sqm, seating_capacity)
WHERE NOT EXISTS (SELECT 1 FROM outlets WHERE code = 'SG-004');

-- Verify all SG outlets
SELECT id, name, code, region_id, status 
FROM outlets 
WHERE region_id = 1 OR code LIKE 'SG-%'
ORDER BY code;
