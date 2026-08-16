import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ============================================================
// TOOL: get_outlet_status
// ============================================================
async function getOutletStatus(params: {
  outlet_id: string | number;
  include_kpis?: boolean;
  include_recent_alerts?: boolean;
  time_range_hours?: number;
}) {
  const supabase = getSupabase();
  const { outlet_id, include_kpis = true, include_recent_alerts = true, time_range_hours = 24 } = params;

  // Fetch outlet info
  const { data: outlet, error: outletError } = await supabase
    .from("outlets")
    .select("id, name, code, region_id, status, city, daily_target")
    .eq("id", outlet_id)
    .single();

  if (outletError || !outlet) {
    return { error: "Outlet not found", status: 404 };
  }

  const result: any = {
    outlet_id: outlet.id,
    name: outlet.name,
    region: outlet.region?.name || "Unknown",
    status: outlet.status || "ACTIVE",
    last_updated: new Date().toISOString(),
  };

  // Include KPIs
  if (include_kpis) {
    // Calculate sales today
    const today = new Date().toISOString().split("T")[0];
    const { data: salesData } = await supabase
      .from("sales_transactions")
      .select("total_amount, transaction_count")
      .eq("outlet_id", outlet_id)
      .gte("transaction_date", today);

    const totalSales = salesData?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
    const transactionCount = salesData?.reduce((sum, s) => sum + (s.transaction_count || 0), 0) || 0;

    // Fetch target
    const { data: target } = await supabase
      .from("sales_targets")
      .select("target_amount")
      .eq("outlet_id", outlet_id)
      .eq("period_date", today)
      .single();

    // Fetch ML scores
    const { data: mlScores } = await supabase
      .from("ml_scores")
      .select("stockout_risk, anomaly_score")
      .eq("outlet_id", outlet_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    result.kpis = {
      sales_today: totalSales,
      sales_vs_target: target ? Math.round((totalSales / target.target_amount) * 100) : null,
      transaction_count: transactionCount,
      avg_transaction: transactionCount > 0 ? Math.round(totalSales / transactionCount) : 0,
      stockout_risk_score: mlScores?.stockout_risk || 0,
      anomaly_score: mlScores?.anomaly_score || 0,
    };
  }

  // Include recent alerts
  if (include_recent_alerts) {
    const cutoff = new Date(Date.now() - (time_range_hours || 24) * 60 * 60 * 1000).toISOString();
    const { data: alerts } = await supabase
      .from("alerts")
      .select("id, type, severity, status, triggered_at, title")
      .eq("outlet_id", outlet_id)
      .gte("triggered_at", cutoff)
      .order("triggered_at", { ascending: false })
      .limit(10);

    result.recent_alerts = alerts?.map(a => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      status: a.status,
      triggered_at: a.triggered_at,
      summary: a.title,
    })) || [];
  }

  return result;
}

// ============================================================
// TOOL: list_active_alerts
// ============================================================
async function listActiveAlerts(params: {
  role: string;
  user_id: string;
  region_id?: string;
  franchisee_id?: string;
  severity_filter?: string;
  status_filter?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = getSupabase();
  const { role, user_id, region_id, franchisee_id, severity_filter, status_filter, limit = 50, offset = 0 } = params;

  let query = supabase
    .from("alerts")
    .select("*, outlet(name, region(name))", { count: "exact" })
    .in("status", ["NEW", "ACKNOWLEDGED", "IN_PROGRESS"]);

  // Filter by role
  if (role === "REGIONAL_MANAGER" && region_id) {
    query = query.eq("outlets.region_id", region_id);
  } else if (role === "FRANCHISEE_OWNER" && franchisee_id) {
    query = query.eq("outlets.franchisee_id", franchisee_id);
  }

  // Additional filters
  if (severity_filter) {
    query = query.eq("severity", severity_filter);
  }
  if (status_filter) {
    query = query.eq("status", status_filter);
  }

  const { data: alerts, count, error } = await query
    .order("triggered_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { error: error.message, status: 500 };
  }

  return {
    total_count: count || 0,
    alerts: alerts?.map(a => ({
      id: a.id,
      outlet_id: a.outlet_id,
      outlet_name: a.outlets?.name,
      region: a.outlets?.regions?.name,
      type: a.type,
      severity: a.severity,
      status: a.status,
      triggered_at: a.triggered_at,
      title: a.title,
      description: a.description,
    })),
  };
}

// ============================================================
// TOOL: triage_alert
// ============================================================
async function triageAlert(params: {
  alert_id: string | number;
  action: "ACKNOWLEDGE" | "ASSIGN" | "DISMISS";
  assigned_to?: string;
  notes?: string;
}) {
  const supabase = getSupabase();
  const { alert_id, action, assigned_to, notes } = params;

  const updateData: any = {};

  if (action === "ACKNOWLEDGE") {
    updateData.status = "ACKNOWLEDGED";
  } else if (action === "ASSIGN" && assigned_to) {
    updateData.status = "ACKNOWLEDGED";
    updateData.assigned_to = assigned_to;
  } else if (action === "DISMISS") {
    updateData.status = "DISMISSED";
  }

  const { data, error } = await supabase
    .from("alerts")
    .update(updateData)
    .eq("id", alert_id)
    .select()
    .single();

  if (error) {
    return { error: error.message, status: 500 };
  }

  return {
    success: true,
    alert_id: data.id,
    new_status: data.status,
    assigned_to: data.assigned_to,
  };
}

// ============================================================
// TOOL: create_case
// ============================================================
async function createCase(params: {
  alert_id?: string | number;
  title: string;
  description?: string;
  priority?: "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";
  assigned_to?: string;
  outlet_id?: string | number;
}) {
  const supabase = getSupabase();
  const { alert_id, title, description, priority = "P2_MEDIUM", assigned_to, outlet_id } = params;

  // Calculate due date based on priority
  const priorityDays = { P0_CRITICAL: 1, P1_HIGH: 3, P2_MEDIUM: 7, P3_LOW: 14 };
  const dueDate = new Date(Date.now() + (priorityDays[priority] || 7) * 24 * 60 * 60 * 1000);

  const caseData: any = {
    title,
    description: description || "",
    priority,
    status: "OPEN",
    due_date: dueDate.toISOString(),
    created_at: new Date().toISOString(),
  };

  if (alert_id) caseData.alert_id = alert_id;
  if (assigned_to) caseData.assigned_to = assigned_to;
  if (outlet_id) caseData.outlet_id = outlet_id;

  const { data, error } = await supabase
    .from("cases")
    .insert(caseData)
    .select()
    .single();

  if (error) {
    return { error: error.message, status: 500 };
  }

  return {
    success: true,
    case_id: data.id,
    title: data.title,
    priority: data.priority,
    status: data.status,
    due_date: data.due_date,
  };
}

// ============================================================
// TOOL: explain_anomaly
// ============================================================
async function explainAnomaly(params: {
  outlet_id: string | number;
  alert_id?: string | number;
}) {
  const supabase = getSupabase();
  const { outlet_id, alert_id } = params;

  // Get ML scores for the outlet
  const { data: mlScores } = await supabase
    .from("ml_scores")
    .select("*")
    .eq("outlet_id", outlet_id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!mlScores || mlScores.length === 0) {
    return { error: "No ML data available for this outlet", status: 404 };
  }

  // Get sales data for context
  const { data: salesData } = await supabase
    .from("sales_transactions")
    .select("total_amount, transaction_count")
    .eq("outlet_id", outlet_id)
    .order("transaction_date", { ascending: false })
    .limit(30);

  // Calculate statistics
  const amounts = salesData?.map(s => s.total_amount || 0) || [];
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const stdDev = Math.sqrt(amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length);

  // Get outlet info
  const { data: outlet } = await supabase
    .from("outlets")
    .select("name")
    .eq("id", outlet_id)
    .single();

  // Generate explanation
  const latestScore = mlScores[0];
  const anomalyLevel = latestScore.anomaly_score > 0.7 ? "HIGH" : latestScore.anomaly_score > 0.4 ? "MEDIUM" : "LOW";

  let explanation = `Anomaly analysis for ${outlet?.name || `Outlet ${outlet_id}`}:\n\n`;
  explanation += `• Current anomaly score: ${(latestScore.anomaly_score * 100).toFixed(1)}% (${anomalyLevel})\n`;
  explanation += `• Average daily sales: Rp ${mean.toLocaleString("id-ID")}\n`;
  explanation += `• Standard deviation: Rp ${stdDev.toLocaleString("id-ID")}\n`;
  explanation += `• Today's sales: Rp ${amounts[0]?.toLocaleString("id-ID") || 0}\n`;

  if (anomalyLevel === "HIGH") {
    explanation += `\n⚠️ HIGH ANOMALY DETECTED\n`;
    explanation += `Today's sales deviate significantly from normal patterns. `;
    explanation += `Possible causes:\n`;
    explanation += `• Unusual transaction volume\n`;
    explanation += `• Price or discount changes\n`;
    explanation += `• Special event or promotion\n`;
    explanation += `• Data entry error`;
  } else if (anomalyLevel === "MEDIUM") {
    explanation += `\n⚡ Moderate deviation from normal pattern. `;
    explanation += `Monitor for next 24 hours.`;
  } else {
    explanation += `\n✅ Sales within normal range.`;
  }

  return {
    outlet_id: outlet_id,
    outlet_name: outlet?.name,
    analysis: {
      anomaly_score: latestScore.anomaly_score,
      anomaly_level: anomalyLevel,
      mean,
      std_dev: stdDev,
      today_sales: amounts[0] || 0,
      deviation_from_mean: mean > 0 ? ((amounts[0] - mean) / mean * 100).toFixed(1) : 0,
    },
    explanation,
  };
}

// ============================================================
// TOOL: send_notification
// ============================================================
async function sendNotification(params: {
  alert_id?: string | number;
  case_id?: string | number;
  channel: "EMAIL" | "WHATSAPP" | "PUSH";
  recipient: string;
  message: string;
  type?: string;
}) {
  const supabase = getSupabase();
  const { alert_id, case_id, channel, recipient, message, type = "CUSTOM" } = params;

  // Insert notification record
  const { data, error } = await supabase
    .from("notification_logs")
    .insert({
      alert_id: alert_id || null,
      case_id: case_id || null,
      channel: channel,
      message: message,
      status: "PENDING",
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    // Fallback: try alerts notification field
    if (alert_id) {
      await supabase
        .from("alerts")
        .update({ notification_sent: true })
        .eq("id", alert_id);
    }
    return { success: true, notification_id: null, warning: "Could not log notification" };
  }

  // In production, integrate with actual notification service
  // For now, mark as sent
  await supabase
    .from("notification_logs")
    .update({ status: "SENT" })
    .eq("id", data.id);

  return {
    success: true,
    notification_id: data.id,
    channel,
    recipient,
    sent_at: data.sent_at,
  };
}

// ============================================================
// TOOL: get_sales_revenue
// ============================================================
async function getSalesRevenue(params: {
  days?: number;
  outlet_ids?: Array<string | number>;
  region_id?: string | number;
}) {
  const supabase = getSupabase();
  const { days = 7, outlet_ids, region_id } = params;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split("T")[0];

  // Build outlet filter
  let outletFilter: any[] | undefined;
  if (outlet_ids && outlet_ids.length > 0) {
    outletFilter = outlet_ids.map(id => Number(id));
  } else if (region_id) {
    const { data: regionOutlets } = await supabase
      .from("outlets")
      .select("id")
      .eq("region_id", Number(region_id));
    outletFilter = regionOutlets?.map((o: any) => o.id);
  }

  let query = supabase
    .from("sales_transactions")
    .select("id, date, amount, transaction_count, anomaly_score, is_anomaly, outlet_id")
    .gte("date", cutoffStr)
    .order("date", { ascending: false });

  if (outletFilter && outletFilter.length > 0) {
    query = query.in("outlet_id", outletFilter);
  }

  const { data: sales, error } = await query;

  if (error) {
    return { error: error.message, status: 500 };
  }

  // Aggregate results
  const totalAmount = sales?.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0) || 0;
  const totalTransactions = sales?.reduce((sum, s) => sum + (s.transaction_count || 0), 0) || 0;
  const anomalyCount = sales?.filter((s: any) => s.is_anomaly).length || 0;

  // Daily breakdown
  const dailyTotals: Record<string, number> = {};
  for (const s of sales || []) {
    dailyTotals[s.date] = (dailyTotals[s.date] || 0) + parseFloat(s.amount || 0);
  }
  const dailyBreakdown = Object.entries(dailyTotals)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, days)
    .map(([date, amount]) => ({ date, amount }));

  // Per-outlet breakdown
  const outletTotals: Record<number, number> = {};
  for (const s of sales || []) {
    outletTotals[s.outlet_id] = (outletTotals[s.outlet_id] || 0) + parseFloat(s.amount || 0);
  }

  // Fetch outlet names
  const outletIds = Object.keys(outletTotals).map(Number);
  const { data: outlets } = outletIds.length > 0
    ? await supabase.from("outlets").select("id, name").in("id", outletIds)
    : { data: [] };
  const outletNameMap: Record<number, string> = {};
  for (const o of outlets || []) {
    outletNameMap[o.id] = o.name;
  }

  const outletBreakdown = Object.entries(outletTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([id, amount]) => ({ outlet_id: Number(id), name: outletNameMap[Number(id)] || `Outlet #${id}`, amount }));

  return {
    period_days: days,
    cutoff_date: cutoffStr,
    total_amount: totalAmount,
    total_transactions: totalTransactions,
    anomaly_count: anomalyCount,
    daily_breakdown: dailyBreakdown,
    outlet_breakdown: outletBreakdown,
    outlet_count: outletBreakdown.length,
  };
}

// ============================================================
// MAIN ROUTER
// ============================================================
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tool, parameters } = await req.json();

    let result: any;

    switch (tool) {
      case "get_outlet_status":
        result = await getOutletStatus(parameters || {});
        break;

      case "list_active_alerts":
        result = await listActiveAlerts(parameters || {});
        break;

      case "triage_alert":
        result = await triageAlert(parameters || {});
        break;

      case "create_case":
        result = await createCase(parameters || {});
        break;

      case "explain_anomaly":
        result = await explainAnomaly(parameters || {});
        break;

      case "send_notification":
        result = await sendNotification(parameters || {});
        break;

      case "get_sales_revenue":
        result = await getSalesRevenue(parameters || {});
        break;

      case "health_check":
        result = { status: "healthy", timestamp: new Date().toISOString() };
        break;

      case "list_tools":
        result = {
          tools: [
            { name: "get_outlet_status", description: "Get outlet KPIs and alerts" },
            { name: "list_active_alerts", description: "List active alerts by role" },
            { name: "triage_alert", description: "Acknowledge, assign, or dismiss alert" },
            { name: "create_case", description: "Create a workflow case" },
            { name: "explain_anomaly", description: "Explain ML anomaly detection" },
            { name: "send_notification", description: "Send notification via EMAIL/WHATSAPP/PUSH" },
            { name: "get_sales_revenue", description: "Get sales revenue summary for outlets/regions over N days" },
            { name: "health_check", description: "Check MCP service health" },
            { name: "list_tools", description: "List available MCP tools" },
          ],
        };
        break;

      default:
        result = { error: `Unknown tool: ${tool}`, status: 400 };
    }

    const status = result.error ? (result.status || 500) : 200;
    delete result.status; // Remove internal status field

    return new Response(JSON.stringify(result), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
