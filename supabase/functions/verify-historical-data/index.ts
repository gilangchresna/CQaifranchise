import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get exact count
  const { count } = await supabase
    .from("sales_transactions")
    .select("*", { count: "exact", head: true });

  // Get monthly stats via RPC-like query (without pagination limit)
  const { data: monthlyData } = await supabase
    .from("sales_transactions")
    .select("date, settlement_amount");

  const byMonth: Record<string, { count: number; revenue: number }> = {};
  monthlyData?.forEach(row => {
    const month = row.date?.substring(0, 7) || "unknown";
    if (!byMonth[month]) byMonth[month] = { count: 0, revenue: 0 };
    byMonth[month].count++;
    byMonth[month].revenue += row.settlement_amount || 0;
  });

  return new Response(JSON.stringify({
    total_transactions: count,
    date_range: {
      start: monthlyData?.[0]?.date,
      end: monthlyData?.[monthlyData.length - 1]?.date
    },
    monthly: Object.keys(byMonth).sort().map(m => ({
      month: m,
      transactions: byMonth[m].count,
      revenue_sgd: Math.round(byMonth[m].revenue * 100) / 100
    }))
  }), { headers: { "Content-Type": "application/json" } });
});
