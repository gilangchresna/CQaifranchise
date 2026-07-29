/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  // Try to add columns using raw SQL
  const alterQueries = [
    'ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT \\'cash\\'',
    'ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100)',
    'ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS staff_id VARCHAR(100)',
    'ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0',
    'ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS tax DECIMAL(10,2) DEFAULT 0',
    'ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) DEFAULT 0',
    'ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10,2)',
  ];
  
  const results = [];
  
  // Since we can't run raw SQL directly, let's update existing records with new field simulation
  // The new fields will be added when POS sends data with those fields
  
  // For now, let's document the expected schema
  const newSchema = {
    table: 'sales_transactions',
    existing_fields: ['id', 'outlet_id', 'transaction_id', 'date', 'amount', 'transaction_count', 'hour', 'day_of_week', 'anomaly_score', 'is_anomaly', 'metadata', 'created_at'],
    new_fields_to_add: [
      { name: 'payment_method', type: 'VARCHAR(50)', default: 'cash', description: 'Payment method: cash, card, qrcode, ewallet' },
      { name: 'customer_id', type: 'VARCHAR(100)', description: 'Customer ID for loyalty tracking' },
      { name: 'staff_id', type: 'VARCHAR(100)', description: 'Staff/cashier who processed' },
      { name: 'discount', type: 'DECIMAL(10,2)', default: 0, description: 'Discount amount in S$' },
      { name: 'tax', type: 'DECIMAL(10,2)', default: 0, description: 'Tax amount (PPN) in S$' },
      { name: 'cost', type: 'DECIMAL(10,2)', default: 0, description: 'Cost of goods sold' },
      { name: 'net_amount', type: 'DECIMAL(10,2)', description: 'Net amount after discount and tax' },
    ]
  };
  
  return Response.json({
    message: 'Schema update needed via Supabase Dashboard',
    instructions: 'Run the following SQL in Supabase SQL Editor:',
    sql: alterQueries.join('; '),
    new_schema: newSchema
  });
});
