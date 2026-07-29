/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async () => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Clear
  await supabase.from("inventory").delete().neq("id", 0);
  await supabase.from("staff").delete().neq("id", 0);
  await supabase.from("outlets").delete().neq("id", 0);
  await supabase.from("regions").delete().neq("id", 0);
  
  // Get user
  const { data: users } = await supabase.from("user_profiles").select("id");
  const franchiseeId = users?.[0]?.id || "00000000-0000-0000-0000-000000000001";
  
  // Insert regions
  const regions = [
    { name: "Central Region", code: "SG-CENTRAL" },
    { name: "North Region", code: "SG-NORTH" },
    { name: "East Region", code: "SG-EAST" },
    { name: "West Region", code: "SG-WEST" },
    { name: "North-East Region", code: "SG-NE" },
  ];
  const { data: insertedRegions } = await supabase.from("regions").insert(regions).select();
  
  const regionIds: Record<string, number> = {};
  insertedRegions?.forEach(r => { regionIds[r.code] = r.id; });
  
  // Outlets
  const outlets = [
    { name: "Kopitiam @ Tampines Mall", code: "KT-TMP-001", region_id: regionIds["SG-EAST"] },
    { name: "Chicken Rice @ Jurong Point", code: "CR-JGP-001", region_id: regionIds["SG-WEST"] },
    { name: "Nasi Lemak Express AMK", code: "NL-AMK-001", region_id: regionIds["SG-CENTRAL"] },
    { name: "Laksa King Paya Lebar", code: "LK-PLB-001", region_id: regionIds["SG-EAST"] },
    { name: "Kaya Toast @ Clementi Mall", code: "KT-CMT-001", region_id: regionIds["SG-WEST"] },
    { name: "Mookata @ Woodlands", code: "MT-WDL-001", region_id: regionIds["SG-NORTH"] },
    { name: "Roti Prata @ Hougang Mall", code: "RP-HGM-001", region_id: regionIds["SG-NE"] },
    { name: "Economic Rice @ Bishan", code: "ER-BSN-001", region_id: regionIds["SG-CENTRAL"] },
  ].map(o => ({ ...o, franchisee_id: franchiseeId }));
  
  const { data: insertedOutlets } = await supabase.from("outlets").insert(outlets).select();
  
  // Staff - Singapore multi-ethnic
  const chinese = ["Tan Wei Ming", "Lee Jia En", "Ng Jun Hao", "Chua Kai Xin"];
  const malay = ["Ahmad Faiz Bin Hassan", "Nurul Huda Bte Ali", "Muhd Danish Bin Razak"];
  const indian = ["Rajesh Kumar", "Priya D/O Mani", "Sanjay S/O Ramesh"];
  
  const staff = [];
  insertedOutlets?.forEach(o => {
    for (let i = 0; i < 10; i++) {
      const n = Math.random();
      const name = n < 0.5 ? chinese[Math.floor(Math.random() * chinese.length)] 
                : n < 0.8 ? malay[Math.floor(Math.random() * malay.length)] 
                : indian[Math.floor(Math.random() * indian.length)];
      staff.push({
        outlet_id: o.id,
        name: name,
        role: i === 0 ? "Outlet Manager" : i === 1 ? "Assistant Manager" : ["Cook", "Cashier", "Service Crew"][Math.floor(Math.random() * 3)],
        status: Math.random() > 0.1 ? "present" : "off_duty",
        contact: "+65" + String(Math.floor(Math.random() * 90000000 + 10000000)),
      });
    }
  });
  await supabase.from("staff").insert(staff);
  
  // Inventory
  const products = [
    { sku: "NASIL-001", name: "Nasi Lemak Set", category: "Main" },
    { sku: "CHKR-001", name: "Chicken Rice Set", category: "Main" },
    { sku: "LAKSA-001", name: "Laksa", category: "Main" },
    { sku: "KAYA-001", name: "Kaya Toast Set", category: "Breakfast" },
    { sku: "PRATA-001", name: "Roti Prata (2 pcs)", category: "Bread" },
    { sku: "MILO-001", name: "Milo (Large)", category: "Beverage" },
    { sku: "KOPI-001", name: "Kopi-O Kosong", category: "Beverage" },
  ];
  
  const inventory = [];
  insertedOutlets?.forEach(o => {
    products.forEach(p => {
      inventory.push({
        outlet_id: o.id,
        sku: p.sku,
        product_name: p.name,
        category: p.category,
        current_stock: Math.random() < 0.2 ? Math.floor(Math.random() * 10) + 5 : Math.floor(Math.random() * 60) + 30,
        min_stock: 25,
        max_stock: 100,
        unit: "portion",
      });
    });
  });
  await supabase.from("inventory").insert(inventory);
  
  // Sales - FIXED: include transaction_id, date, amount, transaction_count
  const sales = [];
  let txCounter = Date.now();
  insertedOutlets?.forEach(o => {
    for (let day = 0; day < 7; day++) {
      const saleDate = new Date(Date.now() - day * 86400000).toISOString().split("T")[0];
      const dayOfWeek = new Date(saleDate).getDay();
      for (let h = 10; h <= 21; h++) {
        if ([14, 15, 16].includes(h)) continue;
        const traffic = (h >= 11 && h <= 13) || (h >= 18 && h <= 20) ? 15 : 5;
        for (let t = 0; t < traffic; t++) {
          sales.push({
            outlet_id: o.id,
            transaction_id: `TX-${txCounter++}-${o.code}`,
            date: saleDate,
            amount: 4.0 + Math.random() * 4,
            transaction_count: Math.floor(Math.random() * 3) + 1,
            hour: h,
            day_of_week: dayOfWeek,
          });
        }
      }
    }
  });
  await supabase.from("sales_transactions").insert(sales);
  
  // Verify
  const today = new Date().toISOString().split("T")[0];
  const { data: todaySales } = await supabase
    .from("sales_transactions")
    .select("id, date, amount")
    .eq("date", today);
  
  return new Response(JSON.stringify({
    success: true,
    regions: insertedRegions?.length || 0,
    outlets: insertedOutlets?.length || 0,
    staff: staff.length,
    inventory: inventory.length,
    sales: sales.length,
    todaySales: todaySales?.length || 0,
  }));
});
