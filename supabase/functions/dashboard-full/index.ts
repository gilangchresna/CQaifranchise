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
    
    // Real-time "today" — reflects live data as it arrives.
    // DEMO_DATE_OVERRIDE (YYYY-MM-DD) can still be set in env for staging/demo
    // environments that intentionally replay historical data.
    const demoOverride = Deno.env.get("DEMO_DATE_OVERRIDE");
    const today = demoOverride ? new Date(demoOverride) : new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let startDate: string;
    let periodLabel: string;
    let daysInPeriod: number;
    
    switch (period) {
      case 'today': 
        startDate = todayStr; 
        periodLabel = 'Today'; 
        daysInPeriod = 1;
        break;
      case '7d': 
        startDate = new Date(today.getTime() - 6 * 86400000).toISOString().split('T')[0]; 
        periodLabel = 'Last 7 Days'; 
        daysInPeriod = 7;
        break;
      case '30d': 
        startDate = new Date(today.getTime() - 29 * 86400000).toISOString().split('T')[0]; 
        periodLabel = 'Last 30 Days'; 
        daysInPeriod = 30;
        break;
      case 'month': 
        startDate = '2026-07-01'; 
        periodLabel = 'July 2026'; 
        daysInPeriod = 25;
        break;
      case 'ytd': 
        startDate = '2026-01-01'; 
        periodLabel = 'Year to Date'; 
        daysInPeriod = 206;
        break;
      default: 
        startDate = new Date(today.getTime() - 6 * 86400000).toISOString().split('T')[0]; 
        periodLabel = 'Last 7 Days'; 
        daysInPeriod = 7;
    }
    
    // Fetch ALL data with pagination (fix for 1000 row limit)
    let allSales: any[] = [];
    let offset = 0;
    const limit = 1000;
    
    while (true) {
      const { data: batch, error } = await supabase
        .from("sales_transactions")
        .select("date, amount, settlement_amount, transaction_count, payment_method, platform, outlet_id")
        .gte("date", startDate)
        .lte("date", todayStr)
        .range(offset, offset + limit - 1);
      
      if (error || !batch || batch.length === 0) break;
      
      allSales = allSales.concat(batch);
      if (batch.length < limit) break;
      offset += limit;
    }
    
    // Calculate totals
    let totalRevenue = 0;
    let totalSettlement = 0;
    let transactionCount = 0;
    const dailySales: Record<string, number> = {};
    const paymentBreakdown: Record<string, number> = {};
    const platformBreakdown: Record<string, number> = {};
    const outletsSet = new Set<number>();
    
    allSales.forEach(t => {
      const amount = Number(t.settlement_amount || t.amount);
      totalRevenue += Number(t.amount);
      totalSettlement += amount;
      transactionCount++;
      outletsSet.add(t.outlet_id);
      
      const date = t.date?.split('T')[0];
      dailySales[date] = (dailySales[date] || 0) + amount;
      paymentBreakdown[t.payment_method] = (paymentBreakdown[t.payment_method] || 0) + amount;
      platformBreakdown[t.platform || 'dine_in'] = (platformBreakdown[t.platform || 'dine_in'] || 0) + amount;
    });
    
    // Calculate avg daily
    const avgDaily = Object.keys(dailySales).length > 0 ? totalSettlement / Object.keys(dailySales).length : 0;
    
    // Get metrics
    const { count: outletCount } = await supabase.from("outlets").select("*", { count: "exact", head: true });
    const { count: alertsCount } = await supabase.from("alerts").select("*", { count: "exact", head: true });
    const { data: lowStock } = await supabase.from("inventory").select("id").lt("current_stock", 25);
    
    // Comparison period (previous period)
    const compareStartDate = new Date(new Date(startDate).getTime() - daysInPeriod * 86400000).toISOString().split('T')[0];
    const compareEndDate = new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0];
    
    let compareOffset = 0;
    let compareSales: any[] = [];
    while (true) {
      const { data: batch } = await supabase
        .from("sales_transactions")
        .select("settlement_amount")
        .gte("date", compareStartDate)
        .lte("date", compareEndDate)
        .range(compareOffset, compareOffset + limit - 1);
      
      if (!batch || batch.length === 0) break;
      compareSales = compareSales.concat(batch);
      if (batch.length < limit) break;
      compareOffset += limit;
    }
    
    const compareTotal = compareSales.reduce((sum, t) => sum + Number(t.settlement_amount || t.amount), 0);
    const variance = compareTotal > 0 ? ((totalSettlement - compareTotal) / compareTotal) * 100 : 0;
    
    return Response.json({
      period,
      period_label: periodLabel,
      date_range: { start: startDate, end: todayStr },
      records_fetched: allSales.length,
      totals: {
        revenue: Math.round(totalRevenue * 100) / 100,
        settlement: Math.round(totalSettlement * 100) / 100,
        transactions: transactionCount,
        avg_transaction: transactionCount > 0 ? Math.round((totalSettlement / transactionCount) * 100) / 100 : 0,
        avg_daily: Math.round(avgDaily * 100) / 100,
      },
      comparison: {
        previous_period_revenue: Math.round(compareTotal * 100) / 100,
        variance_percent: Math.round(variance * 10) / 10,
        trend: variance >= 0 ? 'up' : 'down',
      },
      metrics: {
        outlets: outletCount || 0,
        outlets_with_sales: outletsSet.size,
        active_alerts: alertsCount || 0,
        low_stock: lowStock?.length || 0,
      },
      daily_breakdown: Object.entries(dailySales).sort().map(([d, a]) => ({ date: d, amount: Math.round(a * 100) / 100 })),
      payment_breakdown: Object.entries(paymentBreakdown).map(([m, a]) => ({ method: m, amount: Math.round(a * 100) / 100 })),
      platform_breakdown: Object.entries(platformBreakdown).map(([p, a]) => ({ platform: p, amount: Math.round(a * 100) / 100 })),
    }, { headers: corsHeaders });

  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
