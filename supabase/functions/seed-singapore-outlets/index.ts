import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SINGAPORE_OUTLETS = [
  { id: 156, code: "KT-TMP-001", name: "Kopitiam @ Tampines Mall", status: "ACTIVE", region_id: 106, franchisee_id: "00000000-0000-0000-0000-000000000001", address: "4 Tampines Central 5, Tampines Mall, Singapore 529510", phone: "+65 6789 1234", daily_target: 2500 },
  { id: 157, code: "CR-JGP-001", name: "Chicken Rice @ Jurong Point", status: "ACTIVE", region_id: 107, franchisee_id: "00000000-0000-0000-0000-000000000001", address: "63 Jurong West Central 3, Jurong Point, Singapore 648331", phone: "+65 6789 1235", daily_target: 2800 },
  { id: 158, code: "NL-AMK-001", name: "Nasi Lemak Express AMK", status: "ACTIVE", region_id: 104, franchisee_id: "00000000-0000-0000-0000-000000000001", address: "53 Ang Mo Kio Avenue 3, AMK Hub, Singapore 569933", phone: "+65 6789 1236", daily_target: 2200 },
  { id: 159, code: "LK-PLB-001", name: "Laksa King Paya Lebar", status: "ACTIVE", region_id: 106, franchisee_id: "00000000-0000-0000-0000-000000000001", address: "80 Paya Lebar Road, Paya Lebar Square, Singapore 409051", phone: "+65 6789 1237", daily_target: 2400 },
  { id: 160, code: "KT-CMT-001", name: "Kaya Toast @ Clementi Mall", status: "ACTIVE", region_id: 107, franchisee_id: "00000000-0000-0000-0000-000000000001", address: "3155 Commonwealth Avenue, Clementi Mall, Singapore 129588", phone: "+65 6789 1238", daily_target: 2300 },
  { id: 161, code: "MT-WDL-001", name: "Mookata @ Woodlands", status: "ACTIVE", region_id: 105, franchisee_id: "00000000-0000-0000-0000-000000000001", address: "888 Woodlands Avenue 9, Singapore 738958", phone: "+65 6789 1239", daily_target: 2600 },
  { id: 162, code: "RP-HGM-001", name: "Roti Prata @ Hougang Mall", status: "ACTIVE", region_id: 108, franchisee_id: "00000000-0000-0000-0000-000000000001", address: "90 Hougang Avenue 10, Hougang Mall, Singapore 538766", phone: "+65 6789 1240", daily_target: 2100 },
  { id: 163, code: "ER-BSN-001", name: "Economic Rice @ Bishan", status: "ACTIVE", region_id: 104, franchisee_id: "00000000-0000-0000-0000-000000000001", address: "51 Bishan Street 13, Junction 8, Singapore 579799", phone: "+65 6789 1241", daily_target: 2700 },
];

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
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  try {
    // Ensure franchisee exists
    await supabase.from("franchisees").upsert({
      id: "00000000-0000-0000-0000-000000000001",
      name: "SG Food Holdings Pte Ltd",
      status: "ACTIVE",
    }, { onConflict: "id" });
    
    // Upsert regions
    const regions = [
      { id: 104, code: "SG-CENTRAL", name: "Central Region" },
      { id: 105, code: "SG-NORTH", name: "North Region" },
      { id: 106, code: "SG-EAST", name: "East Region" },
      { id: 107, code: "SG-WEST", name: "West Region" },
      { id: 108, code: "SG-NE", name: "North-East Region" },
    ];
    for (const r of regions) await supabase.from("regions").upsert(r, { onConflict: "id" });
    
    // Upsert outlets - with debug
    for (const outlet of SINGAPORE_OUTLETS) {
      const { data, error } = await supabase.from("outlets").upsert(outlet, { onConflict: "id" }).select();
      if (error) console.error(`Error: ${outlet.code}`, error.message);
      else console.log(`Updated: ${outlet.code}`);
    }
    
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
