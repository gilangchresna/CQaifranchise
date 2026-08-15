import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }
  const token = authHeader.substring(7);
  if (!token) return { authorized: false, error: 'Missing token', status: 401 };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': serviceKey },
    });
    if (!response.ok) return { authorized: false, error: 'Invalid token', status: 401 };
    const userData = await response.json();

    // Get real role from user_profiles table
    let role = userData.user_metadata?.role || 'FRANCHISEE_OWNER';
    try {
      const profileRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userData.id}&select=role`, {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json'
        }
      });
      if (profileRes.ok) {
        const profiles = await profileRes.json();
        if (profiles && profiles[0]?.role) {
          role = profiles[0].role;
        }
      }
    } catch {
      // Use default role from metadata
    }

    return {
      authorized: true,
      user: { id: userData.id, email: userData.email, role: role }
    };
  } catch (error) {
    return { authorized: false, error: 'Auth failed', status: 401 };
  }
}

function getDateRange(period: string) {
  // Real-time "today" — uses actual current time so the dashboard reflects
  // live data as it arrives, instead of a frozen demo date.
  // DEMO_DATE_OVERRIDE (YYYY-MM-DD) can still be set in env for staging/demo
  // environments that intentionally replay historical data.
  const override = Deno.env.get("DEMO_DATE_OVERRIDE");
  const today = override ? new Date(override) : new Date();
  const todayStr = today.toISOString().split('T')[0];
  let startDate: string;
  let periodLabel: string;

  const periodLower = (period || '').toLowerCase();
  switch (periodLower) {
    case 'today':
      startDate = todayStr;
      periodLabel = 'Today';
      break;
    case '7d':
    case '7 D':
      startDate = new Date(today.getTime() - 6 * 86400000).toISOString().split('T')[0];
      periodLabel = 'Last 7 Days';
      break;
    case '30d':
    case '30 D':
      startDate = new Date(today.getTime() - 29 * 86400000).toISOString().split('T')[0];
      periodLabel = 'Last 30 Days';
      break;
    case 'month':
    case 'mth':
      startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      periodLabel = 'This Month';
      break;
    case 'ytd':
    case 'year':
      startDate = `${today.getFullYear()}-01-01`;
      periodLabel = 'Year to Date';
      break;
    default:
      startDate = new Date(today.getTime() - 6 * 86400000).toISOString().split('T')[0];
      periodLabel = 'Last 7 Days';
  }

  return { startDate, endDate: todayStr, periodLabel };
}

// Fetch ALL data with pagination
async function fetchAllSales(supabase: any, startDate: string, endDate: string) {
  const allSales: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('sales_transactions')
      .select('outlet_id, amount, date')
      .gte('date', startDate)
      .lte('date', endDate)
      .range(offset, offset + limit - 1);
    
    if (error || !data || data.length === 0) break;
    
    allSales.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  
  return allSales;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authResult = await verifyAuth(req);
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.error }), { status: authResult.status, headers: corsHeaders });
  }
  const user = authResult.user!;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    const { period = '7d', outlet_id } = body;
    const { startDate, endDate, periodLabel } = getDateRange(period);

    // =====================================================
    // ROLE-BASED ACCESS FILTER
    // - FRANCHISEE: outlets via user_outlets table
    // - REGIONAL: outlets in user's region via user_profiles.region_id
    // - HQ_ADMIN: all outlets
    // =====================================================
    let outletsQuery = supabase.from('outlets').select('id, name, code, region_id, status, city, daily_target').order('id');
    if (user.role === 'FRANCHISEE_OWNER' || user.role === 'FRANCHISEE_STAFF') {
      const { data: userOutlets } = await supabase.from('user_outlets').select('outlet_id').eq('user_id', user.id);
      if (userOutlets && userOutlets.length > 0) {
        outletsQuery = outletsQuery.in('id', userOutlets.map((uo: any) => uo.outlet_id));
      }
    } else if (user.role === 'REGIONAL_MANAGER') {
      const { data: up } = await supabase
        .from('user_profiles').select('region_id').eq('id', user.id).single();
      if (up?.region_id) {
        outletsQuery = outletsQuery.eq('region_id', up.region_id);
      }
    }
    const { data: outlets } = await outletsQuery;

    // Get ALL sales with pagination
    const allSales = await fetchAllSales(supabase, startDate, endDate);
    
    // Get previous period for comparison
    const prevStart = new Date(new Date(startDate).getTime() - (new Date(endDate).getTime() - new Date(startDate).getTime()) - 86400000).toISOString().split('T')[0];
    const prevEnd = new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0];
    const prevSales = await fetchAllSales(supabase, prevStart, prevEnd);

    // Calculate previous totals
    const prevTotals: Record<number, number> = {};
    prevSales.forEach((s: any) => {
      prevTotals[s.outlet_id] = (prevTotals[s.outlet_id] || 0) + parseFloat(s.amount);
    });

    // Build outlet data
    const outletData: Record<number, any> = {};
    for (const outlet of outlets || []) {
      outletData[outlet.id] = {
        id: outlet.id, code: outlet.code, name: outlet.name,
        status: outlet.status, region: outlet.region,
        daily_target: outlet.daily_target || 0,
        sales: 0, sales_trend: 0, transaction_count: 0,
        stock_risk_percent: 0, low_stock_count: 0,
      };
    }

    // Aggregate sales
    for (const sale of allSales) {
      if (outletData[sale.outlet_id]) {
        outletData[sale.outlet_id].sales += parseFloat(sale.amount);
        outletData[sale.outlet_id].transaction_count++;
      }
    }

    // Calculate trends
    for (const id in outletData) {
      const current = outletData[id].sales;
      const previous = prevTotals[parseInt(id)] || 0;
      if (previous > 0) {
        outletData[id].sales_trend = Math.round(((current - previous) / previous) * 100);
      } else if (current > 0) {
        outletData[id].sales_trend = 100;
      }
    }

    // Calculate totals
    const totals = { total_revenue: 0, total_transactions: 0 };
    for (const id in outletData) {
      totals.total_revenue += outletData[id].sales;
      totals.total_transactions += outletData[id].transaction_count;
    }

    // Fetch outlet detail if outlet_id is provided
    let outletDetail = null;
    if (outlet_id) {
      // Authorization check for FRANCHISEE_OWNER/FRANCHISEE_STAFF
      if (user.role === 'FRANCHISEE_OWNER' || user.role === 'FRANCHISEE_STAFF') {
        const { data: userOutlets } = await supabase.from('user_outlets').select('outlet_id').eq('user_id', user.id).eq('outlet_id', outlet_id);
        if (!userOutlets || userOutlets.length === 0) {
          return new Response(JSON.stringify({ error: 'Forbidden: You do not have access to this outlet' }), { status: 403, headers: corsHeaders });
        }
      }
      const { data: inventory } = await supabase.from('inventory').select('*').eq('outlet_id', outlet_id);
      const { data: recentTxns } = await supabase.from('sales_transactions').select('*').eq('outlet_id', outlet_id).gte('date', startDate).lte('date', endDate).order('created_at', { ascending: false }).limit(20);
      const todaySales = (recentTxns || []).filter((s: any) => s.date === endDate);
      const todayRevenue = todaySales.reduce((sum: number, s: any) => sum + parseFloat(s.amount || 0), 0);
      const yesterdayStr = new Date(new Date(endDate).getTime() - 86400000).toISOString().split('T')[0];
      const { data: yesterdaySales } = await supabase.from('sales_transactions').select('amount').eq('outlet_id', outlet_id).eq('date', yesterdayStr);
      const yesterdayRevenue = (yesterdaySales || []).reduce((sum: number, s: any) => sum + parseFloat(s.amount || 0), 0);
      const lastWeekStr = new Date(new Date(endDate).getTime() - 7 * 86400000).toISOString().split('T')[0];
      const { data: lastWeekSales } = await supabase.from('sales_transactions').select('amount').eq('outlet_id', outlet_id).eq('date', lastWeekStr);
      const lastWeekRevenue = (lastWeekSales || []).reduce((sum: number, s: any) => sum + parseFloat(s.amount || 0), 0);
      const lowStockItems = (inventory || []).filter((inv: any) => inv.current_stock < inv.min_stock);
      const hourlySales: Record<string, number> = {};
      (recentTxns || []).forEach((s: any) => {
        const hour = new Date(s.created_at).getUTCHours();
        const hourKey = `${String(hour).padStart(2, '0')}:00`;
        hourlySales[hourKey] = (hourlySales[hourKey] || 0) + parseFloat(s.amount || 0);
      });
      outletDetail = {
        sales: todayRevenue,
        transaction_count: todaySales.length,
        avg_transaction: todaySales.length > 0 ? todayRevenue / todaySales.length : 0,
        stock_risk_percent: (inventory || []).length > 0 ? Math.round((lowStockItems.length / (inventory || []).length) * 100) : 0,
        low_stock_items: lowStockItems.slice(0, 10).map((inv: any) => ({ sku: inv.sku, product_name: inv.product_name, current_stock: inv.current_stock, min_stock: inv.min_stock, max_stock: inv.max_stock, risk_level: inv.current_stock < inv.min_stock * 0.3 ? 'critical' : 'warning' })),
        total_products: (inventory || []).length,
        recent_transactions: (recentTxns || []).slice(0, 10).map((t: any) => ({ transaction_id: t.transaction_id, amount: parseFloat(t.amount || 0), item_count: t.transaction_count || 1, created_at: t.created_at, items: t.metadata?.items || [] })),
        hourly_sales: hourlySales,
        comparison: { yesterday: yesterdayRevenue, yesterday_change: yesterdayRevenue > 0 ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : 0, last_week: lastWeekRevenue, last_week_change: lastWeekRevenue > 0 ? Math.round(((todayRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : 0 }
      };
    }

    return new Response(JSON.stringify({
      outlets: Object.values(outletData),
      totals,
      period,
      period_label: periodLabel,
      records_fetched: allSales.length,
      date_range: { start: startDate, end: endDate },
      outlet_detail: outletDetail,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
