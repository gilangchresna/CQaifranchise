import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get HQ user
  const { data: authData } = await supabase.auth.admin.listUsers();
  const hqUsers = authData?.users.filter(u => u.user_metadata?.role === "HQ_ADMIN") || [];
  const hqUserId = hqUsers[0]?.id;

  if (!hqUserId) {
    return new Response(JSON.stringify({ error: "No HQ user found" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get active outlets
  const { data: outlets } = await supabase
    .from("outlets")
    .select("id, code, status")
    .eq("status", "ACTIVE")
    .limit(10);

  const outletList = outlets || [];
  const outlet1 = outletList.find(o => o.code === "WKW-001") || outletList[0];
  const outlet2 = outletList[1];
  const outlet3 = outletList[2];

  // Clear existing
  await supabase.from("financing_applications").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 1. Seed financing_applications with outlet_id
  const finInserts = [
    {
      franchisee_id: hqUserId,
      outlet_id: outlet1?.id,
      purpose: "FRANCHISEE_SETUP",
      requested_amount: 50000,
      currency: "SGD",
      status: "APPROVED",
      approved_amount: 45000,
      disbursed_amount: 45000,
      interest_rate_bps: 1250,
      submitted_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      decided_at: new Date(Date.now() - 6 * 86400000).toISOString(),
      disbursed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      lender_code: "GENERIC",
      lender_reference_id: "FRN-2024-SG-001",
      decision_reason: "Strong outlet performance, clean financials",
    },
    {
      franchisee_id: hqUserId,
      outlet_id: outlet1?.id,
      purpose: "INVENTORY",
      requested_amount: 15000,
      currency: "SGD",
      status: "SUBMITTED",
      submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      lender_code: "GENERIC",
    },
    {
      franchisee_id: hqUserId,
      outlet_id: outlet2?.id,
      purpose: "EQUIPMENT",
      requested_amount: 25000,
      currency: "SGD",
      status: "UNDER_REVIEW",
      submitted_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      lender_code: "GENERIC",
    },
    {
      franchisee_id: hqUserId,
      outlet_id: outlet3?.id,
      purpose: "WORKING_CAPITAL",
      requested_amount: 30000,
      currency: "SGD",
      status: "DRAFT",
      lender_code: "GENERIC",
    },
  ];

  const { error: finError } = await supabase.from("financing_applications").insert(finInserts);

  return new Response(JSON.stringify({
    message: "Seed complete",
    hq_user: { id: hqUserId, email: hqUsers[0].email },
    outlets_used: {
      financing_1: { id: outlet1?.id, code: outlet1?.code },
      financing_2: { id: outlet2?.id, code: outlet2?.code },
      financing_3: { id: outlet3?.id, code: outlet3?.code },
    },
    financing_applications: { inserted: finInserts.length, error: finError?.message || "ok" },
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
