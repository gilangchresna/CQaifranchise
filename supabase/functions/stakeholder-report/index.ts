/// <reference lib="deno.ns" />

/**
 * Stakeholder Report Edge Function
 * Backend reporting for external/internal stakeholders — a step above the
 * in-app dashboard-api/dashboard-full/dashboard-stats functions, which are
 * built for the React UI. This function is meant to be pulled by:
 *  - a scheduled cron (see supabase/functions/cron-run + ml-scheduler for the
 *    existing pattern) that emails or pushes a periodic PDF/CSV to investors,
 *    lenders, or franchise HQ leadership
 *  - a BI tool / spreadsheet via direct HTTP GET with a service token
 *  - the Financing / Integrations UI, to attach a report to a bridge-loan
 *    application so a lender can see outlet performance directly
 *
 * GET or POST /functions/v1/stakeholder-report
 *   period: 'today' | '7d' | '30d' | 'month' | 'ytd'  (default '30d')
 *   format: 'json' | 'csv'                             (default 'json')
 *   region_id / outlet_id: optional scope filters
 *
 * Every call is logged to public.report_exports for auditability — "who
 * pulled which numbers, when" is itself a reporting requirement once
 * external parties (lenders, investors) are receiving these numbers.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getDateRange(period: string) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  let startDate: string;
  let periodLabel: string;

  switch (period) {
    case "today":
      startDate = todayStr;
      periodLabel = "Today";
      break;
    case "7d":
      startDate = new Date(today.getTime() - 6 * 86400000).toISOString().split("T")[0];
      periodLabel = "Last 7 Days";
      break;
    case "30d":
      startDate = new Date(today.getTime() - 29 * 86400000).toISOString().split("T")[0];
      periodLabel = "Last 30 Days";
      break;
    case "month":
      startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      periodLabel = "This Month";
      break;
    case "ytd":
      startDate = `${today.getFullYear()}-01-01`;
      periodLabel = "Year to Date";
      break;
    default:
      startDate = new Date(today.getTime() - 29 * 86400000).toISOString().split("T")[0];
      periodLabel = "Last 30 Days";
  }
  return { startDate, endDate: todayStr, periodLabel };
}

async function verifyAuth(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authorized: false as const, status: 401, error: "Missing Authorization header" };
  }
  const token = authHeader.substring(7);
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  if (!resp.ok) return { authorized: false as const, status: 401, error: "Invalid token" };
  const userData = await resp.json();
  return {
    authorized: true as const,
    userId: userData.id as string,
    role: (userData.user_metadata?.role as string) || "FRANCHISEE_OWNER",
  };
}

function toCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(","));
  return lines.join("\n");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const auth = await verifyAuth(req, supabaseUrl, serviceKey);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    let params: Record<string, any> = {};
    if (req.method === "POST") {
      params = await req.json().catch(() => ({}));
    } else {
      params = Object.fromEntries(url.searchParams.entries());
    }

    const period = params.period || "30d";
    const format = params.format === "csv" ? "csv" : "json";
    const regionId = params.region_id ? Number(params.region_id) : null;
    const outletId = params.outlet_id ? Number(params.outlet_id) : null;
    const { startDate, endDate, periodLabel } = getDateRange(period);

    // ---- Scope: outlets this caller/report may cover ----
    let outletsQuery = supabase.from("outlets").select("id, code, name, city, status, daily_target, region_id");
    if (auth.role === "FRANCHISEE_OWNER" || auth.role === "FRANCHISEE_STAFF") {
      outletsQuery = outletsQuery.eq("franchisee_id", auth.userId);
    } else if (regionId) {
      outletsQuery = outletsQuery.eq("region_id", regionId);
    }
    if (outletId) outletsQuery = outletsQuery.eq("id", outletId);
    const { data: outlets, error: outletsError } = await outletsQuery;
    if (outletsError) throw outletsError;

    const outletIds = (outlets || []).map((o: any) => o.id);

    // ---- Sales performance ----
    const { data: sales, error: salesError } = await supabase
      .from("sales_transactions")
      .select("outlet_id, amount, net_amount, date")
      .in("outlet_id", outletIds.length ? outletIds : [-1])
      .gte("date", startDate)
      .lte("date", endDate);
    if (salesError) throw salesError;

    // ---- Alerts / operational health ----
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("outlet_id, type, severity, status, triggered_at")
      .in("outlet_id", outletIds.length ? outletIds : [-1])
      .gte("triggered_at", `${startDate}T00:00:00Z`);
    if (alertsError) throw alertsError;

    // ---- Financing pipeline (bridge loans in flight for these outlets) ----
    const { data: financing } = await supabase
      .from("financing_applications")
      .select("outlet_id, status, requested_amount, approved_amount, disbursed_amount, currency, created_at")
      .in("outlet_id", outletIds.length ? outletIds : [-1]);

    // ---- Aggregate per outlet ----
    const perOutlet: Record<number, any> = {};
    for (const o of outlets || []) {
      perOutlet[o.id] = {
        outlet_id: o.id,
        outlet_code: o.code,
        outlet_name: o.name,
        city: o.city,
        region: (o as any).regions?.name || null,
        status: o.status,
        daily_target: o.daily_target,
        revenue: 0,
        transaction_count: 0,
        open_alerts: 0,
        critical_alerts: 0,
        financing_status: "NONE",
      };
    }
    for (const s of sales || []) {
      const row = perOutlet[s.outlet_id];
      if (!row) continue;
      row.revenue += parseFloat(s.net_amount ?? s.amount ?? 0);
      row.transaction_count += 1;
    }
    for (const a of alerts || []) {
      const row = perOutlet[a.outlet_id];
      if (!row) continue;
      if (a.status !== "RESOLVED" && a.status !== "CLOSED") row.open_alerts += 1;
      if (a.severity === "P0_CRITICAL" || a.severity === "CRITICAL") row.critical_alerts += 1;
    }
    for (const f of financing || []) {
      const row = perOutlet[f.outlet_id];
      if (row) row.financing_status = f.status;
    }

    const outletRows = Object.values(perOutlet);
    const totals = {
      total_revenue: outletRows.reduce((sum: number, r: any) => sum + r.revenue, 0),
      total_transactions: outletRows.reduce((sum: number, r: any) => sum + r.transaction_count, 0),
      total_open_alerts: outletRows.reduce((sum: number, r: any) => sum + r.open_alerts, 0),
      total_critical_alerts: outletRows.reduce((sum: number, r: any) => sum + r.critical_alerts, 0),
      outlets_covered: outletRows.length,
    };

    // ---- Audit log this export ----
    await supabase.from("report_exports").insert({
      requested_by: auth.userId,
      report_type: "STAKEHOLDER_SUMMARY",
      period,
      format,
      region_id: regionId,
      outlet_id: outletId,
      row_count: outletRows.length,
    });

    const responsePayload = {
      success: true,
      generated_at: new Date().toISOString(),
      period,
      period_label: periodLabel,
      date_range: { start: startDate, end: endDate },
      totals,
      outlets: outletRows,
    };

    if (format === "csv") {
      const csv = toCSV(outletRows as Record<string, any>[]);
      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="cyberquote-stakeholder-report-${startDate}_${endDate}.csv"`,
        },
      });
    }

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Stakeholder Report Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
