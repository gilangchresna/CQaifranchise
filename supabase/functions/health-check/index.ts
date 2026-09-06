/**
 * Health Check Edge Function
 * GET /functions/v1/health-check
 * Returns system status, DB connectivity, and ML function health
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  latency_ms: number;
  error?: string;
}

interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime_seconds: number;
  checks: {
    database: HealthStatus;
    ml_anomaly_function: HealthStatus;
    ml_stockout_function: HealthStatus;
    alert_generation: HealthStatus;
    notifications: HealthStatus;
  };
  metrics: {
    active_alerts: number;
    cases_pending: number;
    outlets_total: number;
    outlets_active: number;
    ml_models_loaded: number;
    recent_errors_1h: number;
  };
}

async function checkDatabaseHealth(supabase: ReturnType<typeof createClient>): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const { error } = await supabase
      .from("outlets")
      .select("id")
      .limit(1);
    
    if (error) throw error;
    
    return {
      status: "healthy",
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "unhealthy",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}

async function checkFunctionHealth(
  supabase: ReturnType<typeof createClient>, 
  functionName: string
): Promise<HealthStatus> {
  const start = Date.now();
  try {
    // Check if function exists by checking recent logs/metrics
    // For ML functions, check ml_scheduler_runs
    const { data, error } = await supabase
      .from("ml_scheduler_runs")
      .select("id, status, completed_at")
      .order("started_at", { ascending: false })
      .limit(1);
    
    if (error) {
      // Function might not have runs yet - check function list
      return {
        status: "degraded",
        latency_ms: Date.now() - start,
        error: `No scheduler runs found: ${error.message}`,
      };
    }
    
    if (!data || data.length === 0) {
      return {
        status: "degraded",
        latency_ms: Date.now() - start,
        error: "No scheduler runs recorded yet",
      };
    }
    
    const lastRun = data[0];
    const hoursSinceLastRun = lastRun.completed_at 
      ? (Date.now() - new Date(lastRun.completed_at).getTime()) / (1000 * 60 * 60)
      : 24;
    
    if (hoursSinceLastRun > 24) {
      return {
        status: "degraded",
        latency_ms: Date.now() - start,
        error: `Last run was ${hoursSinceLastRun.toFixed(1)} hours ago`,
      };
    }
    
    return {
      status: "healthy",
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "unhealthy",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function getSystemMetrics(supabase: ReturnType<typeof createClient>) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const [
    { count: activeAlerts },
    { count: casesPending },
    { count: outletsTotal },
    { count: outletsActive },
    { count: mlModels },
    { count: recentErrors },
  ] = await Promise.all([
    supabase.from("alerts").select("id", { count: "exact", head: true })
      .neq("status", "CLOSED"),
    supabase.from("cases").select("id", { count: "exact", head: true })
      .not("status", "in", "('RESOLVED','CLOSED')"),
    supabase.from("outlets").select("id", { count: "exact", head: true }),
    supabase.from("outlets").select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    supabase.from("ml_scores").select("model_type", { count: "exact", head: true })
      .gte("scored_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("ml_scheduler_runs").select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("started_at", oneHourAgo),
  ]);
  
  return {
    active_alerts: activeAlerts ?? 0,
    cases_pending: casesPending ?? 0,
    outlets_total: outletsTotal ?? 0,
    outlets_active: outletsActive ?? 0,
    ml_models_loaded: mlModels ?? 0,
    recent_errors_1h: recentErrors ?? 0,
  };
}

serve(async (req: Request) => {
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Run all health checks in parallel
    const [dbHealth, mlAnomalyHealth, mlStockoutHealth] = await Promise.all([
      checkDatabaseHealth(supabase),
      checkFunctionHealth(supabase, "ml-anomaly-score"),
      checkFunctionHealth(supabase, "ml-stockout-risk"),
    ]);

    // Check alert generation health
    const alertHealth = await checkFunctionHealth(supabase, "alert-generator");
    
    // Check notification health
    const notificationHealth = await checkFunctionHealth(supabase, "notification-send");
    
    // Get system metrics
    const metrics = await getSystemMetrics(supabase);

    // Determine overall health
    const allStatuses = [
      dbHealth.status,
      mlAnomalyHealth.status,
      mlStockoutHealth.status,
      alertHealth.status,
      notificationHealth.status,
    ];
    
    let overall: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (allStatuses.includes("unhealthy")) {
      overall = "unhealthy";
    } else if (allStatuses.includes("degraded")) {
      overall = "degraded";
    }

    const response: SystemHealth = {
      overall,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      checks: {
        database: dbHealth,
        ml_anomaly_function: mlAnomalyHealth,
        ml_stockout_function: mlStockoutHealth,
        alert_generation: alertHealth,
        notifications: notificationHealth,
      },
      metrics,
    };

    const statusCode = overall === "healthy" ? 200 : overall === "degraded" ? 200 : 503;

    return new Response(JSON.stringify(response, null, 2), {
      status: statusCode,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({
        overall: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
