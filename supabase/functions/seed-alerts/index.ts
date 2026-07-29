/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async () => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Check if outlets exist
  const { data: outlets } = await supabase.from("outlets").select("id").limit(5);
  
  if (!outlets || outlets.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "No outlets found" }));
  }
  
  const outletIds = outlets.map(o => o.id);
  
  const alerts = [
    { outlet_id: outletIds[0], type: 'SALES_ANOMALY', severity: 'P0_CRITICAL', status: 'NEW', title: 'WKN-001 sales spike detected', description: 'Sales 150% above normal baseline' },
    { outlet_id: outletIds[0], type: 'STOCKOUT_RISK', severity: 'P2_MEDIUM', status: 'NEW', title: 'Teh Sosro below minimum', description: 'Current stock: 8, min: 30' },
    { outlet_id: outletIds[1] || outletIds[0], type: 'SALES_ANOMALY', severity: 'P1_HIGH', status: 'NEW', title: 'JKT-004 sales dropped 40%', description: 'Below expected threshold' },
    { outlet_id: outletIds[2] || outletIds[0], type: 'COMPLAINT', severity: 'P1_HIGH', status: 'ACKNOWLEDGED', title: 'Customer complaint received', description: 'Food quality issue reported' },
    { outlet_id: outletIds[3] || outletIds[0], type: 'STOCKOUT_RISK', severity: 'P0_CRITICAL', status: 'NEW', title: 'Kopi Gayo out of stock', description: 'Immediate reorder required' },
  ];
  
  const { error } = await supabase.from("alerts").insert(alerts);
  
  return new Response(JSON.stringify({ 
    success: !error, 
    inserted: error ? 0 : alerts.length,
    error: error?.message 
  }));
});
