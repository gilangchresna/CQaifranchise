/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async () => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const integrationsData = [
    { name: 'GoFood POS', type: 'POS', status: 'active', last_sync: new Date().toISOString() },
    { name: 'GrabPay Integration', type: 'PAYMENT', status: 'active', last_sync: new Date().toISOString() },
    { name: 'ShopeeFood API', type: 'DELIVERY', status: 'active', last_sync: new Date().toISOString() },
    { name: 'DANA Payment', type: 'PAYMENT', status: 'active', last_sync: new Date().toISOString() },
    { name: 'Tokopedia Store', type: 'ECOMMERCE', status: 'inactive', last_sync: new Date(Date.now() - 86400000).toISOString() },
    { name: 'QRIS Payment Gateway', type: 'PAYMENT', status: 'active', last_sync: new Date().toISOString() },
  ];
  
  const { error } = await supabase.from("integrations").insert(integrationsData);
  
  return new Response(JSON.stringify({ 
    success: !error, 
    inserted: error ? 0 : integrationsData.length,
    error: error?.message 
  }));
});
