/// <reference lib="deno.ns" />
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
  
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  try {
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || '7d';
    const dateOverride = url.searchParams.get('date'); // Optional: YYYY-MM-DD
    
    // Use override date if provided, otherwise use real-time "today" so the
    // dashboard reflects live data as it arrives. DEMO_DATE_OVERRIDE (env) or
    // ?date= (query param) remain available for staging/demo replay.
    const envOverride = Deno.env.get("DEMO_DATE_OVERRIDE");
    let today: Date;
    if (dateOverride) {
      today = new Date(dateOverride);
    } else if (envOverride) {
      today = new Date(envOverride);
    } else {
      today = new Date();
    }
    const todayStr = today.toISOString().split('T')[0];
    
    let startDate: string;
    let periodLabel: string;
    let compareStartDate: string;
    let compareEndDate: string;
    
    switch (period) {
      case 'today':
        startDate = todayStr;
        periodLabel = 'Today';
        const yesterday = new Date(today.getTime() - 86400000);
        compareStartDate = yesterday.toISOString().split('T')[0];
        compareEndDate = compareStartDate;
        break;
      case '7d':
        startDate = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0];
        periodLabel = 'Last 7 Days';
        compareStartDate = new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0];
        compareEndDate = new Date(today.getTime() - 8 * 86400000).toISOString().split('T')[0];
        break;
      case '30d':
        startDate = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0];
        periodLabel = 'Last 30 Days';
        compareStartDate = new Date(today.getTime() - 60 * 86400000).toISOString().split('T')[0];
        compareEndDate = new Date(today.getTime() - 31 * 86400000).toISOString().split('T')[0];
        break;
      case 'month':
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = firstOfMonth.toISOString().split('T')[0];
        periodLabel = 'This Month';
        const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        compareStartDate = prevMonth.toISOString().split('T')[0];
        compareEndDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'ytd':
        const firstOfYear = new Date(today.getFullYear(), 0, 1);
        startDate = firstOfYear.toISOString().split('T')[0];
        periodLabel = 'Year to Date';
        const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
        compareStartDate = lastYearStart.toISOString().split('T')[0];
        compareEndDate = new Date(today.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0];
        periodLabel = 'Last 7 Days';
        compareStartDate = new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0];
        compareEndDate = new Date(today.getTime() - 8 * 86400000).toISOString().split('T')[0];
    }
    
    // Get current period sales
    const { data: currentSales } = await supabase
      .from("sales_transactions")
      .select("outlet_id, amount, transaction_count, date, settlement_amount")
      .gte("date", startDate)
      .lte("date", todayStr);
    
    // Get comparison period sales
    const { data: compareSales } = await supabase
      .from("sales_transactions")
      .select("amount, settlement_amount")
      .gte("date", compareStartDate)
      .lte("date", compareEndDate);
    
    // Calculate totals using settlement_amount (actual revenue)
    const currentTotal = currentSales?.reduce((sum, t) => sum + Number(t.settlement_amount || t.amount), 0) || 0;
    const compareTotal = compareSales?.reduce((sum, t) => sum + Number(t.settlement_amount || t.amount), 0) || 0;
    const variance = compareTotal > 0 ? ((currentTotal - compareTotal) / compareTotal) * 100 : 0;
    
    // Get metrics
    const { count: outletCount } = await supabase.from("outlets").select("*", { count: "exact", head: true });
    const { data: lowStock } = await supabase.from("inventory").select("id").lt("current_stock", 25);
    const { count: activeAlerts } = await supabase.from("alerts").select("*", { count: "exact", head: true }).eq("status", "NEW");
    
    // Daily breakdown
    const dailySales: Record<string, number> = {};
    currentSales?.forEach(t => {
      const date = t.date?.split('T')[0];
      dailySales[date] = (dailySales[date] || 0) + Number(t.settlement_amount || t.amount);
    });
    
    return Response.json({
      period,
      period_label: periodLabel,
      date_range: { start: startDate, end: todayStr },
      reference_date: todayStr,
      totals: {
        revenue: Math.round(currentTotal * 100) / 100,
        transactions: currentSales?.length || 0,
      },
      comparison: {
        previous_period_revenue: Math.round(compareTotal * 100) / 100,
        variance_percent: Math.round(variance * 10) / 10,
        trend: variance >= 0 ? 'up' : 'down',
      },
      metrics: {
        outlets: outletCount || 0,
        low_stock: lowStock?.length || 0,
        active_alerts: activeAlerts || 0,
      },
      daily_breakdown: Object.entries(dailySales).map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 })),
    }, { headers: corsHeaders });

  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
