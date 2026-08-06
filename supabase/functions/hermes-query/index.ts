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
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  try {
    const { action } = await req.json().catch(() => ({}));
    
    const today = new Date("2026-07-25");
    const weekAgo = new Date(today.getTime() - 6 * 86400000);
    let response = "";
    
    if (action === "dashboard") {
      let allSales: any[] = [];
      let offset = 0;
      while (true) {
        const { data } = await supabase
          .from("sales_transactions")
          .select("settlement_amount")
          .gte("date", weekAgo.toISOString().split("T")[0])
          .lte("date", today.toISOString().split("T")[0])
          .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        allSales.push(...data);
        if (data.length < 1000) break;
        offset += 1000;
      }
      const totalRev = allSales.reduce((sum: number, s: any) => sum + Number(s.settlement_amount), 0);
      response = `CyberQuote Dashboard (Last 7 Days)\nRevenue: S$ ${totalRev.toFixed(2)}\nTransactions: ${allSales.length}`;
    } else if (action === "outlets") {
      const { data: outlets } = await supabase.from("outlets").select("*, region:regions(name)").order("code");
      response = `CyberQuote Outlets (${(outlets || []).length})\n` + 
        (outlets || []).map((o: any) => `- ${o.code}: ${o.region?.name || "N/A"}`).join("\n");
    } else if (action === "alerts") {
      const { data: alerts } = await supabase.from("alerts").select("*, outlet(name)").eq("status", "NEW").limit(5);
      response = `Active Alerts: ${(alerts || []).length}\n` +
        (alerts || []).map((a: any) => `[${a.severity}] ${a.title}\n  Outlet: ${a.outlet?.name || "N/A"}`).join("\n");
    } else {
      response = "Available: dashboard, outlets, alerts";
    }
    
    return new Response(JSON.stringify({ response, timestamp: new Date().toISOString() }), { headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
