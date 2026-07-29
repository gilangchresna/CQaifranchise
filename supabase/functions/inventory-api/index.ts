import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Verify JWT authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.substring(7);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': serviceKey },
    });

    if (!verifyRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, data } = await req.json();

    if (action === 'seed_inventory') {
      // Seed inventory for all outlets
      const outletIds = [37, 36, 41, 9, 33, 35, 25, 27, 26, 23, 22, 24, 28, 30, 29, 39, 11, 40, 10, 34, 38, 12, 8, 32];
      
      const products = [
        { sku: 'MNL_ES_TEH', name: 'Es Teh Manis', category: 'Minuman', unit: 'glass', min: 50, max: 200, cost_range: [3000, 5000], sell_range: [8000, 12000] },
        { sku: 'MNL_ES_JERUK', name: 'Es Jeruk Peras', category: 'Minuman', unit: 'glass', min: 40, max: 150, cost_range: [4000, 6000], sell_range: [10000, 15000] },
        { sku: 'MNL_KOPI', name: 'Kopi Hitam', category: 'Minuman', unit: 'cup', min: 30, max: 120, cost_range: [5000, 8000], sell_range: [12000, 20000] },
        { sku: 'MNL_JUS', name: 'Jus Jeruk Segar', category: 'Minuman', unit: 'glass', min: 25, max: 100, cost_range: [6000, 10000], sell_range: [15000, 25000] },
        { sku: 'MGR_PANGGANG', name: 'Roti Bakar', category: 'Makanan Ringan', unit: 'pcs', min: 20, max: 80, cost_range: [8000, 12000], sell_range: [18000, 25000] },
        { sku: 'MGR_GORENGAN', name: 'Gorengan Assorti', category: 'Makanan Ringan', unit: 'porsi', min: 30, max: 100, cost_range: [5000, 10000], sell_range: [12000, 20000] },
        { sku: 'MGR_TAHU', name: 'Tahu Crispy', category: 'Makanan Ringan', unit: 'porsi', min: 25, max: 90, cost_range: [4000, 8000], sell_range: [10000, 18000] },
        { sku: 'MGR_TEMPE', name: 'Tempe Goreng', category: 'Makanan Ringan', unit: 'porsi', min: 30, max: 100, cost_range: [3000, 6000], sell_range: [8000, 15000] },
        { sku: 'MBT_NASI_GORENG', name: 'Nasi Goreng Spesial', category: 'Makanan Berat', unit: 'porsi', min: 15, max: 60, cost_range: [12000, 18000], sell_range: [25000, 40000] },
        { sku: 'MBT_MIE_GORENG', name: 'Mie Goreng Jawa', category: 'Makanan Berat', unit: 'porsi', min: 15, max: 60, cost_range: [10000, 15000], sell_range: [22000, 35000] },
        { sku: 'MBT_AYAM_GPREK', name: 'Ayam Geprek Sambel', category: 'Makanan Berat', unit: 'porsi', min: 12, max: 50, cost_range: [15000, 22000], sell_range: [30000, 45000] },
        { sku: 'MBT_BAKSO', name: 'Bakso Komplit', category: 'Makanan Berat', unit: 'porsi', min: 12, max: 50, cost_range: [13000, 20000], sell_range: [28000, 42000] },
        { sku: 'MBT_SOTO', name: 'Soto Ayam Bening', category: 'Makanan Berat', unit: 'porsi', min: 10, max: 45, cost_range: [14000, 20000], sell_range: [30000, 45000] },
        { sku: 'MBT_RAWON', name: 'Rawon Setan', category: 'Makanan Berat', unit: 'porsi', min: 8, max: 40, cost_range: [18000, 25000], sell_range: [35000, 55000] },
        { sku: 'MBT_SATE', name: 'Sate Ayam Khas', category: 'Makanan Berat', unit: 'porsi', min: 10, max: 45, cost_range: [16000, 23000], sell_range: [32000, 50000] },
        { sku: 'MBT_RENDANG', name: 'Rendang Sapi', category: 'Makanan Berat', unit: 'porsi', min: 8, max: 35, cost_range: [20000, 28000], sell_range: [40000, 65000] },
      ];

      const inventoryItems = [];
      
      for (const outletId of outletIds) {
        for (const product of products) {
          const currentStock = Math.floor(Math.random() * (product.max - product.min)) + product.min;
          inventoryItems.push({
            outlet_id: outletId,
            sku: product.sku,
            product_name: product.name,
            category: product.category,
            current_stock: currentStock,
            min_stock: product.min,
            max_stock: product.max,
            unit: product.unit,
            last_restock_at: new Date().toISOString(),
          });
        }
      }

      // Insert - first delete existing then insert new
      await supabase.from('inventory').delete().neq('id', 0);
      const { error } = await supabase.from('inventory').insert(inventoryItems);

      if (error) throw error;

      return new Response(JSON.stringify({
        status: 'success',
        message: 'Inventory seeded successfully',
        total_items: inventoryItems.length,
        outlets: outletIds.length,
        products: products.length,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_inventory_summary') {
      const outletId = data?.outlet_id;
      
      let query = supabase.from('inventory').select('*');
      if (outletId) {
        query = query.eq('outlet_id', outletId);
      }
      
      const { data: inventory, error } = await query;
      
      if (error) throw error;

      // Calculate risk for each item
      const summary = {};
      
      for (const item of inventory || []) {
        if (!summary[item.outlet_id]) {
          summary[item.outlet_id] = { low_stock: 0, total: 0, items: [] };
        }
        summary[item.outlet_id].total++;
        summary[item.outlet_id].items.push(item);
        
        const ratio = item.current_stock / item.min_stock;
        if (ratio < 1.5) {
          summary[item.outlet_id].low_stock++;
        }
      }

      // Calculate risk percentage
      for (const outletId in summary) {
        summary[outletId].risk = Math.round(
          (summary[outletId].low_stock / summary[outletId].total) * 100
        );
      }

      return new Response(JSON.stringify({
        status: 'success',
        inventory,
        summary,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'stock_movement') {
      const { outlet_id, sku, quantity, type } = data;
      
      // Get current stock
      const { data: item, error: getError } = await supabase
        .from('inventory')
        .select('*')
        .eq('outlet_id', outlet_id)
        .eq('sku', sku)
        .single();
      
      if (getError) throw getError;

      // Update stock
      const newStock = type === 'sale' 
        ? item.current_stock - quantity 
        : item.current_stock + quantity;
      
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ current_stock: newStock })
        .eq('outlet_id', outlet_id)
        .eq('sku', sku);
      
      if (updateError) throw updateError;

      // Record movement
      const { error: moveError } = await supabase.from('stock_movements').insert({
        outlet_id,
        sku,
        product_name: item.product_name,
        movement_type: type,
        quantity: type === 'sale' ? -quantity : quantity,
        reference_type: 'simulation',
        timestamp: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        status: 'success',
        new_stock: newStock,
        item: item.product_name,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
