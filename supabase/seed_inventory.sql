-- Inventory Seed Data for CyberQuote MVP
-- Seeds inventory data for all active outlets
-- Run this in Supabase Dashboard > SQL Editor

-- Insert inventory items for each outlet
-- Using a variety of food/beverage items typical for Indonesian quick-service restaurants

DO $$
DECLARE
    -- Get all active outlets
    outlet_rec RECORD;
    -- SKUs for different categories
    v_sku TEXT;
    v_name TEXT;
    v_category TEXT;
    v_stock INTEGER;
    v_min INTEGER;
    v_max INTEGER;
BEGIN
    -- Define common food items with their typical stock levels
    -- Format: (sku, name, category, min_stock, max_stock)
    
    FOR outlet_rec IN SELECT id, code FROM outlets WHERE status IN ('ACTIVE', 'PILOT') LOOP
        -- Chicken category
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-CHK-001', 'Ayam Broiler Segar', 'Chicken', 50, 20, 100, 'kg', NOW() - INTERVAL '2 days', NOW())
        ON CONFLICT DO NOTHING;
        
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-CHK-002', 'Ayam Geprek Crispy', 'Chicken', 30, 15, 60, 'kg', NOW() - INTERVAL '1 day', NOW())
        ON CONFLICT DO NOTHING;
        
        -- Rice category
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-RICE-001', 'Beras Premium', 'Rice', 75, 30, 150, 'kg', NOW() - INTERVAL '3 days', NOW())
        ON CONFLICT DO NOTHING;
        
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-RICE-002', 'Nasi Putih', 'Rice', 40, 20, 80, 'kg', NOW(), NOW())
        ON CONFLICT DO NOTHING;
        
        -- Vegetables category
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-VEG-001', 'Sayuran Campuran', 'Vegetables', 25, 10, 50, 'kg', NOW() - INTERVAL '1 day', NOW())
        ON CONFLICT DO NOTHING;
        
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-VEG-002', 'Kecambah Tauge', 'Vegetables', 15, 5, 30, 'kg', NOW() - INTERVAL '1 day', NOW())
        ON CONFLICT DO NOTHING;
        
        -- Spices category
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-SPC-001', 'Bumbu Racik Geprek', 'Spices', 20, 8, 40, 'pcs', NOW() - INTERVAL '5 days', NOW())
        ON CONFLICT DO NOTHING;
        
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-SPC-002', 'Sambal Botol', 'Spices', 50, 20, 100, 'pcs', NOW() - INTERVAL '7 days', NOW())
        ON CONFLICT DO NOTHING;
        
        -- Beverages category
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-BEV-001', 'Teh Botol', 'Beverages', 100, 40, 200, 'pcs', NOW() - INTERVAL '2 days', NOW())
        ON CONFLICT DO NOTHING;
        
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-BEV-002', 'Es Teh Manis', 'Beverages', 80, 30, 150, 'pcs', NOW(), NOW())
        ON CONFLICT DO NOTHING;
        
        -- Packaging category
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-PKG-001', 'Kardus Makan', 'Packaging', 200, 80, 400, 'pcs', NOW() - INTERVAL '10 days', NOW())
        ON CONFLICT DO NOTHING;
        
        INSERT INTO inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit, last_restock_at, updated_at)
        VALUES 
            (outlet_rec.id, outlet_rec.code || '-PKG-002', 'Cup Minuman', 'Packaging', 150, 60, 300, 'pcs', NOW() - INTERVAL '5 days', NOW())
        ON CONFLICT DO NOTHING;
        
    END LOOP;
END $$;

-- Verification query
SELECT 
    'inventory' as table_name, 
    COUNT(*) as total_rows,
    COUNT(DISTINCT outlet_id) as outlets_with_inventory
FROM inventory;
