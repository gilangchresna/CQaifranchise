import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const months = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  const results = [];
  
  for (const month of months) {
    const start = `${month}-01`;
    const end = `${month}-31`;
    
    const { count } = await supabase
      .from("sales_transactions")
      .select("*", { count: "exact", head: true })
      .gte("date", start)
      .lte("date", end);
    
    const { data: revenueData } = await supabase
      .from("sales_transactions")
      .select("settlement_amount")
      .gte("date", start)
      .lte("date", end);
    
    const revenue = revenueData?.reduce((sum, r) => sum + (r.settlement_amount || 0), 0) || 0;
    results.push({ month, transactions: count || 0, revenue: Math.round(revenue * 100) / 100 });
  }
  
  const totalTx = results.reduce((sum, r) => sum + r.transactions, 0);
  const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
  
  return new Response(JSON.stringify({
    monthly: results,
    totals: { transactions: totalTx, revenue: totalRevenue }
  }), { headers: { "Content-Type": "application/json" } });
});
