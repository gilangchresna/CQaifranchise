/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, "HQ_ADMIN")) {
    return forbiddenResponse("HQ_ADMIN role required for this operation");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Clear existing data
    await supabase.from("inventory").delete().neq("id", 0);
    await supabase.from("staff").delete().neq("id", 0);
    await supabase.from("employees").delete().neq("id", "00000000-0000-0000-0000-000000000000");
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

    // Staff - FIXED: 1 person = 1 employee_id
    const allNames = [
      "Tan Wei Ming", "Lee Jia En", "Ng Jun Hao", "Chua Kai Xin",
      "Ahmad Faiz Bin Hassan", "Nurul Huda Bte Ali", "Muhd Danish Bin Razak",
      "Rajesh Kumar", "Priya D/O Mani", "Sanjay S/O Ramesh",
      "Lim Wei Jie", "Siti Nurhaliza", "Ahmad Rezki",
      "Michelle Lee", "Kumar Sanjay", "Nurain Binti Ahmad"
    ];

    // Create unique employees first
    const employees: any[] = [];
    allNames.forEach((name, idx) => {
      const empId = "EMP-" + String(1000 + idx).padStart(4, "0");
      employees.push({
        name,
        employee_id: empId,
        contact: "+65" + String(Math.floor(Math.random() * 90000000 + 10000000)),
        hire_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        performance_score: Math.floor(Math.random() * 30 + 70),
        attendance_rate: Math.floor(Math.random() * 10 + 90),
      });
    });
    await supabase.from("employees").insert(employees);

    // Assign employees to outlets with roles
    const staffAssignments: any[] = [];
    insertedOutlets?.forEach((o: any) => {
      const numStaff = 8 + Math.floor(Math.random() * 5);
      const shuffled = [...employees].sort(() => Math.random() - 0.5).slice(0, numStaff);
      shuffled.forEach((emp: any, i: number) => {
        const roles = ["Cook", "Cashier", "Service Crew"];
        const shiftsStart = ["08:00", "09:00", "10:00", "12:00", "14:00"];
        const shiftsEnd = ["16:00", "17:00", "18:00", "20:00", "22:00"];
        staffAssignments.push({
          outlet_id: o.id,
          employee_id: emp.employee_id,
          name: emp.name,
          role: i === 0 ? "Outlet Manager" : i === 1 ? "Assistant Manager" : roles[Math.floor(Math.random() * roles.length)],
          status: Math.random() > 0.15 ? "present" : "off_duty",
          shift_start: shiftsStart[Math.floor(Math.random() * shiftsStart.length)],
          shift_end: shiftsEnd[Math.floor(Math.random() * shiftsEnd.length)],
          contact: emp.contact,
        });
      });
    });
    await supabase.from("staff").insert(staffAssignments);

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

    const inventory: any[] = [];
    insertedOutlets?.forEach((o: any) => {
      products.forEach(p => {
        inventory.push({
          outlet_id: o.id,
          sku: p.sku,
          product_name: p.name,
          category: p.category,
          current_stock: Math.random() < 0.2 ? Math.floor(Math.random() * 10 + 5) : Math.floor(Math.random() * 60 + 30),
          min_stock: 25,
          max_stock: 100,
          unit: "portion",
        });
      });
    });
    await supabase.from("inventory").insert(inventory);

    // Sales
    const sales: any[] = [];
    let txCounter = Date.now();
    insertedOutlets?.forEach((o: any) => {
      for (let day = 0; day < 7; day++) {
        const saleDate = new Date(Date.now() - day * 86400000).toISOString().split("T")[0];
        const dayOfWeek = new Date(saleDate).getDay();
        for (let h = 10; h <= 21; h++) {
          if ([14, 15, 16].includes(h)) continue;
          const traffic = (h >= 11 && h <= 13) || (h >= 18 && h <= 20) ? 15 : 5;
          for (let t = 0; t < traffic; t++) {
            sales.push({
              outlet_id: o.id,
              transaction_id: "TX-" + txCounter++ + "-" + o.code,
              date: saleDate,
              amount: 4.0 + Math.random() * 4,
              transaction_count: Math.floor(Math.random() * 3 + 1),
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
      employees: employees.length,
      staff: staffAssignments.length,
      inventory: inventory.length,
      sales: sales.length,
      todaySales: todaySales?.length || 0,
    }));
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
