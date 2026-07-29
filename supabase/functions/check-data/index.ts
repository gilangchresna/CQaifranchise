/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  // Get sample sales
  const { data: sales } = await supabase.from('sales_transactions').select('*').limit(3);
  
  // Get sample inventory
  const { data: inventory } = await supabase.from('inventory').select('*').limit(3);
  
  return Response.json({
    sales_fields: sales?.[0] ? Object.keys(sales[0]) : [],
    sales_sample: sales,
    inventory_fields: inventory?.[0] ? Object.keys(inventory[0]) : [],
    inventory_sample: inventory
  });
});
