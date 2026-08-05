/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  
  // SECURITY: this function uses the service-role key (bypasses RLS) and can
  // mutate/delete data. Restrict it to authenticated HQ_ADMIN callers only.
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, 'HQ_ADMIN')) {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Seed regions
  const regions = [
    { id: 1, name: "Singapore", code: "SG", country: "Singapore" },
    { id: 2, name: "Jakarta", code: "JKT", country: "Indonesia" },
    { id: 3, name: "Bandung", code: "BDG", country: "Indonesia" },
    { id: 4, name: "Surabaya", code: "SBY", country: "Indonesia" },
    { id: 5, name: "Bangkok", code: "BKK", country: "Thailand" },
    { id: 6, name: "Kuala Lumpur", code: "KUL", country: "Malaysia" },
  ];

  const { error: regionError } = await supabase.from("regions").upsert(regions);
  if (regionError) console.error("Regions error:", regionError);

  // Seed outlets
  const outlets = [
    { id: 1, code: "WKN-001", name: "Warung Kopi Nusantara Sg", region_id: 1, status: "active" },
    { id: 2, code: "MYB-002", name: "Mie Ayam Bakery Sg", region_id: 1, status: "active" },
    { id: 3, code: "SAP-003", name: "Sate Ayam Premium Sg", region_id: 1, status: "active" },
    { id: 4, code: "JKT-004", name: "Jus Jeruk Kaki Tema Jkt", region_id: 2, status: "active" },
    { id: 5, code: "BDG-005", name: "Bakso Daging Khas Bd", region_id: 3, status: "active" },
    { id: 6, code: "SBY-006", name: "Soto Ayam Sby", region_id: 4, status: "active" },
    { id: 7, code: "BKK-007", name: "Pad Thai Bkk", region_id: 5, status: "active" },
    { id: 8, code: "KUL-008", name: "Nasi Lemak KUL", region_id: 6, status: "active" },
  ];

  const { error: outletError } = await supabase.from("outlets").upsert(outlets);
  if (outletError) console.error("Outlets error:", outletError);

  // Seed inventory for outlet 1
  const inventory = [
    { outlet_id: 1, sku: "Kopi Gayo 250g", current_stock: 45, min_stock: 20, max_stock: 100 },
    { outlet_id: 1, sku: "Teh Sosro 500ml", current_stock: 12, min_stock: 30, max_stock: 80 },
    { outlet_id: 1, sku: "Nasi Goreng Mix", current_stock: 8, min_stock: 15, max_stock: 50 },
    { outlet_id: 1, sku: "Kopi Toraja 100g", current_stock: 65, min_stock: 25, max_stock: 120 },
    { outlet_id: 1, sku: "Roti Bakar Coklat", current_stock: 20, min_stock: 10, max_stock: 40 },
  ];

  const { error: invError } = await supabase.from("inventory").upsert(inventory);
  if (invError) console.error("Inventory error:", invError);

  return new Response(JSON.stringify({
    success: true,
    regions: regions.length,
    outlets: outlets.length,
    inventory: inventory.length
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
