/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // SECURITY: this function uses the service-role key (bypasses RLS) and can
  // mutate/delete data. Restrict it to authenticated HQ_ADMIN callers only.
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, 'HQ_ADMIN')) {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: outlets } = await supabase.from("outlets").select("id").limit(20);
  if (!outlets || outlets.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "No outlets" }));
  }
  
  const products = [
    { sku: 'KOP-001', name: 'Kopi Sachet 250g', unit: 'pcs' },
    { sku: 'KOP-002', name: 'Kopi Bubuk Premium 500g', unit: 'pcs' },
    { sku: 'GULA-001', name: 'Gula Pasir 1kg', unit: 'kg' },
    { sku: 'SUSU-001', name: 'Susu Kental Manis', unit: 'pcs' },
    { sku: 'MIE-001', name: 'Mie Instan Kartika', unit: 'pcs' },
    { sku: 'BAKSO-001', name: 'Bakso Sapi 500g', unit: 'pcs' },
    { sku: 'SATE-001', name: 'Sate Ayam K_HAS 250g', unit: 'pcs' },
    { sku: 'NASI-001', name: 'Nasi 5kg Premium', unit: 'kg' },
    { sku: 'AYAM-001', name: 'Ayam Geprek Crispy 500g', unit: 'pcs' },
    { sku: 'MINYAK-001', name: 'Minyak Goreng 2L', unit: 'pcs' },
  ];
  
  const inventory = [];
  for (const outlet of outlets) {
    for (const product of products) {
      const minStock = Math.floor(Math.random() * 30) + 20;
      const currentStock = Math.floor(Math.random() * 80) + 5;
      
      inventory.push({
        outlet_id: outlet.id,
        sku: product.sku,
        product_name: product.name,
        current_stock: currentStock,
        min_stock: minStock,
        max_stock: minStock * 3,
        unit: product.unit,
        last_restock_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
      });
    }
  }
  
  const { error } = await supabase.from("inventory").insert(inventory);
  
  return new Response(JSON.stringify({ 
    success: !error, 
    inserted: error ? 0 : inventory.length,
    outlets: outlets.length,
    error: error?.message 
  }));
});
