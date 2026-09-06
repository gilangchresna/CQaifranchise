-- =====================================================
-- INVENTORY MOVEMENTS TABLE
-- Tracks all inventory changes (sales, restocks, adjustments)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id SERIAL PRIMARY KEY,
    outlet_id INTEGER NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('sale', 'restock', 'adjustment', 'waste', 'transfer')),
    quantity INTEGER NOT NULL,  -- negative for sales/waste, positive for restock
    stock_before INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    reference VARCHAR(100),  -- transaction_id, PO number, etc.
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_inventory_movements_outlet 
    ON public.inventory_movements(outlet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_sku 
    ON public.inventory_movements(outlet_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created 
    ON public.inventory_movements(created_at DESC);

-- RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their outlets' movements
CREATE POLICY "Users can read own outlet movements"
    ON public.inventory_movements FOR SELECT
    USING (
        outlet_id IN (
            SELECT o.id FROM outlets o
            JOIN user_profiles up ON up.region_id = o.region_id
            WHERE up.id = auth.uid()
        )
    );

-- Policy: System can insert movements
CREATE POLICY "Service role can insert movements"
    ON public.inventory_movements FOR INSERT
    WITH CHECK (true);

-- Sample data: Recent movements for SG outlets
INSERT INTO public.inventory_movements (outlet_id, sku, movement_type, quantity, stock_before, stock_after, reference, created_at)
SELECT 
    o.id as outlet_id,
    'BEV_ICED_TEA' as sku,
    'restock' as movement_type,
    50 as quantity,
    20 as stock_before,
    70 as stock_after,
    'PO-2026-001' as reference,
    NOW() - interval '1 day' as created_at
FROM outlets o
WHERE o.region_id = 114
ON CONFLICT DO NOTHING;

-- Verify
SELECT 
    m.outlet_id,
    o.code as outlet_code,
    m.movement_type,
    m.quantity,
    m.created_at
FROM inventory_movements m
JOIN outlets o ON o.id = m.outlet_id
ORDER BY m.created_at DESC
LIMIT 10;
