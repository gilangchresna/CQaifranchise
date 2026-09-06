import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  
  // SECURITY: this function uses the service-role key (bypasses RLS) and can
  // mutate/delete data. Restrict it to authenticated HQ_ADMIN callers only.
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, 'HQ_ADMIN')) {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }
const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  try {
    // Get outlets
    const { data: outlets, error: outletError } = await supabase.from('outlets').select('id').limit(24);
    
    if (outletError || !outlets || outlets.length === 0) {
      return new Response(JSON.stringify({ error: 'No outlets', detail: outletError }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    // Products
    const products = [
      { sku: 'MNL_ES_TEH', name: 'Es Teh Manis', category: 'Minuman', unit: 'glass' },
      { sku: 'MNL_ES_JERUK', name: 'Es Jeruk Peras', category: 'Minuman', unit: 'glass' },
      { sku: 'MNL_KOPI', name: 'Kopi Hitam', category: 'Minuman', unit: 'cup' },
      { sku: 'MGR_PANGGANG', name: 'Roti Bakar', category: 'Makanan Ringan', unit: 'pcs' },
      { sku: 'MBT_NASI_GORENG', name: 'Nasi Goreng', category: 'Makanan Berat', unit: 'porsi' },
      { sku: 'MBT_AYAM_GPREK', name: 'Ayam Geprek', category: 'Makanan Berat', unit: 'porsi' },
    ];
    
    // Build items
    const items = [];
    for (const outlet of outlets) {
      for (const p of products) {
        items.push({
          outlet_id: outlet.id,
          sku: p.sku,
          product_name: p.name,
          category: p.category,
          current_stock: Math.floor(Math.random() * 80) + 20,
          min_stock: 15,
          max_stock: 100,
          unit: p.unit,
        });
      }
    }
    
    // Insert
    const { data, error: insertError } = await supabase.from('inventory').insert(items).select();
    
    return new Response(JSON.stringify({
      success: !insertError,
      seeded: data?.length || 0,
      outlets: outlets.length,
      error: insertError?.message || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
