/// <reference lib="deno.ns" />

/**
 * Peer Benchmarking Edge Function
 * Compare outlet performance against peer groups
 * 
 * GET /functions/v1/peer-benchmark
 * Query params: outlet_id, region, type, period
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const outletId = url.searchParams.get("outlet_id");
  const region = url.searchParams.get("region");
  const outletType = url.searchParams.get("type");
  const locationType = url.searchParams.get("location");
  const period = url.searchParams.get("period") || "daily";
  const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // =========================================
    // GET PEER METRICS (no join - compute locally)
    // =========================================
    let query = supabase
      .from("peer_metrics")
      .select("*")
      .eq("metric_date", date)
      .eq("period_type", period)
      .order("revenue", { ascending: false });

    if (region) query = query.eq("peer_region", region);
    if (outletType) query = query.eq("peer_type", outletType);
    if (locationType) query = query.eq("peer_location", locationType);

    const { data: peerMetrics, error: metricsError } = await query;

    if (metricsError) throw metricsError;

    // =========================================
    // GET OUTLET INFO FOR EACH METRIC
    // =========================================
    const outletIds = peerMetrics?.map(m => m.outlet_id) || [];
    let outletMap: any = {};

    if (outletIds.length > 0) {
      const { data: outlets } = await supabase
        .from("outlets")
        .select("id, code, name, region_id")
        .in("id", outletIds);

      outlets?.forEach(o => {
        outletMap[o.id] = o;
      });
    }

    // =========================================
    // GET CLASSIFICATIONS
    // =========================================
    const { data: classifications } = await supabase
      .from("outlet_classifications")
      .select("*")
      .eq("is_active", true);

    const classMap: any = {};
    classifications?.forEach(c => {
      classMap[c.outlet_id] = c;
    });

    // =========================================
    // BUILD RESPONSE
    // =========================================
    const response = {
      date,
      period,
      peer_groups: {
        region: region || "all",
        type: outletType || "all",
        location: locationType || "all",
      },
      aggregates: calculateAggregates(peerMetrics || []),
      outlets: peerMetrics?.map(m => ({
        outlet_id: m.outlet_id,
        outlet_code: m.outlet_code,
        outlet_name: outletMap[m.outlet_id]?.name || m.outlet_code,
        region: m.peer_region,
        revenue: m.revenue,
        peer_avg_revenue: m.peer_avg_revenue,
        vs_peer_pct: m.revenue_vs_peer_pct,
        rank: m.revenue_rank,
        percentile: m.revenue_percentile,
        staff_productivity: m.staff_productivity,
        inventory_turnover: m.inventory_turnover,
        peer_score: m.peer_score,
        status: getStatus(m),
        is_top_performer: m.is_top_performer,
        is_underperformer: m.is_underperformer,
      })) || [],
      top_performers: peerMetrics
        ?.filter(m => m.is_top_performer)
        .map(m => ({
          outlet_code: m.outlet_code,
          outlet_name: outletMap[m.outlet_id]?.name || m.outlet_code,
          revenue: m.revenue,
          peer_score: m.peer_score,
          vs_peer_pct: m.revenue_vs_peer_pct,
        })) || [],
      underperformers: peerMetrics
        ?.filter(m => m.is_underperformer)
        .map(m => ({
          outlet_code: m.outlet_code,
          outlet_name: outletMap[m.outlet_id]?.name || m.outlet_code,
          revenue: m.revenue,
          vs_peer_pct: m.revenue_vs_peer_pct,
          gap_to_avg: (m.peer_avg_revenue || 0) - (m.revenue || 0),
        })) || [],
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Peer Benchmark Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateAggregates(metrics: any[]): any {
  if (!metrics || metrics.length === 0) {
    return {
      total_outlets: 0,
      avg_revenue: 0,
      avg_peer_score: 0,
      top_performers: 0,
      underperformers: 0,
      avg_vs_peer_pct: 0,
    };
  }

  const totalRevenue = metrics.reduce((sum, m) => sum + (m.revenue || 0), 0);
  const totalPeerRevenue = metrics.reduce((sum, m) => sum + (m.peer_avg_revenue || 0), 0);
  const totalScore = metrics.reduce((sum, m) => sum + (m.peer_score || 0), 0);

  return {
    total_outlets: metrics.length,
    avg_revenue: Math.round((totalRevenue / metrics.length) * 100) / 100,
    avg_peer_score: Math.round((totalScore / metrics.length) * 100) / 100,
    avg_vs_peer_pct: totalPeerRevenue > 0
      ? Math.round(((totalRevenue - totalPeerRevenue) / totalPeerRevenue * 100) * 100) / 100
      : 0,
    top_performers: metrics.filter(m => m.is_top_performer).length,
    underperformers: metrics.filter(m => m.is_underperformer).length,
  };
}

function getStatus(metric: any): string {
  if (metric.is_top_performer) return "top";
  if (metric.is_underperformer) return "underperforming";
  if (metric.is_above_peer) return "above_average";
  return "average";
}
