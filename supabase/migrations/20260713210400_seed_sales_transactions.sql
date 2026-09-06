-- Seed sales_transactions for all outlets (30 days history)
-- This enables ML anomaly detection and stockout risk prediction

DO $$
DECLARE
    outlet_rec RECORD;
    day_offset INTEGER;
    date_val DATE;
    base_amount NUMERIC;
    day_multiplier NUMERIC;
    transaction_count INTEGER;
BEGIN
    -- Clear existing sales data first
    DELETE FROM public.sales_transactions;
    
    -- Get all active outlets
    FOR outlet_rec IN SELECT id, code, daily_target FROM public.outlets WHERE status IN ('ACTIVE', 'PILOT')
    LOOP
        -- Generate 30 days of sales data
        FOR day_offset IN 0..29 LOOP
            date_val := CURRENT_DATE - day_offset;
            
            -- Day of week multiplier (weekends slightly higher)
            day_multiplier := CASE 
                WHEN EXTRACT(DOW FROM date_val) IN (0, 6) THEN 1.15  -- Sunday, Saturday
                WHEN EXTRACT(DOW FROM date_val) = 5 THEN 1.1           -- Friday
                ELSE 1.0
            END;
            
            -- Base amount from daily_target (in IDR, daily_target is already in IDR)
            base_amount := (outlet_rec.daily_target * day_multiplier * (0.8 + random() * 0.4))::NUMERIC;
            
            -- Add some variance for anomaly detection
            -- 10% chance of anomaly (either high or low)
            IF random() < 0.1 THEN
                IF random() < 0.5 THEN
                    -- Low anomaly (50% below normal)
                    base_amount := base_amount * 0.5;
                ELSE
                    -- High anomaly (50% above normal)
                    base_amount := base_amount * 1.5;
                END IF;
            END IF;
            
            transaction_count := (base_amount / 50000 * (0.8 + random() * 0.4))::INTEGER;
            IF transaction_count < 1 THEN transaction_count := 1; END IF;
            
            INSERT INTO public.sales_transactions (
                outlet_id,
                date,
                amount,
                transaction_count,
                day_of_week,
                created_at
            ) VALUES (
                outlet_rec.id,
                date_val,
                base_amount::INTEGER,
                transaction_count,
                EXTRACT(DOW FROM date_val)::INTEGER,
                NOW()
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Sales data seeded successfully';
END $$;

-- Verify
SELECT 
    COUNT(*) as total_transactions,
    COUNT(DISTINCT outlet_id) as outlets_with_data,
    MIN(date) as oldest_date,
    MAX(date) as newest_date
FROM public.sales_transactions;
