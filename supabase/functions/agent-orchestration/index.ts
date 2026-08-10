/// <reference lib="deno.ns" />

/**
 * Agent Orchestration Edge Function
 * GET /functions/v1/agent-orchestration
 * Returns real agent status, tasks, logs, and metrics from DB
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function verifyAuth(token: string): Promise<{ ok: boolean; user?: any }> {
  return fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "Authorization": `Bearer ${token}`, "apikey": SUPABASE_SERVICE_KEY },
  }).then(r => r.json().then(data => ({ ok: r.ok, user: data })));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const token = authHeader.substring(7);
  const auth = await verifyAuth(token);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") || "status";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);

  try {
    // ── AGENTS ──────────────────────────────────────────────────────────────
    if (endpoint === "agents") {
      const { data: agents } = await supabase
        .from("agents")
        .select("*")
        .order("name");

      return new Response(JSON.stringify({ success: true, agents: agents || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── TASKS ────────────────────────────────────────────────────────────────
    if (endpoint === "tasks") {
      const { data: tasks, error } = await supabase
        .from("agent_tasks")
        .select("*, agents(name, role)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Compute duration_ms for completed tasks
      const enriched = (tasks || []).map(t => ({
        ...t,
        duration_ms: t.started_at && t.completed_at
          ? new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()
          : undefined,
      }));

      return new Response(JSON.stringify({ success: true, tasks: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── LOGS ────────────────────────────────────────────────────────────────
    if (endpoint === "logs") {
      const { data: logs, error } = await supabase
        .from("agent_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, logs: logs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── METRICS ─────────────────────────────────────────────────────────────
    if (endpoint === "metrics") {
      const today = new Date().toISOString().slice(0, 10);

      // Get tasks today by status
      const { data: tasksToday } = await supabase
        .from("agent_tasks")
        .select("status")
        .gte("created_at", today);

      // Get tasks today by agent
      const { data: tasksByAgent } = await supabase
        .from("agent_tasks")
        .select("agent_id, status, duration_ms")
        .gte("created_at", today);

      // Get avg response time from agent_metrics (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: avgDurations } = await supabase
        .from("agent_metrics")
        .select("agent_id, metric_value")
        .eq("metric_type", "avg_duration")
        .eq("period", "daily")
        .gte("recorded_at", sevenDaysAgo);

      // Get recent errors
      const { data: recentErrors } = await supabase
        .from("agent_tasks")
        .select("id")
        .eq("status", "failed")
        .gte("created_at", today);

      // Get agent status counts
      const { data: agentStatuses } = await supabase
        .from("agents")
        .select("status");

      const totalTasks = tasksToday?.length || 0;
      const failedTasks = recentErrors?.length || 0;
      const errorRate = totalTasks > 0 ? Math.round((failedTasks / totalTasks) * 1000) / 10 : 0;

      const statusCounts = (agentStatuses || []).reduce((acc: Record<string, number>, a: any) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {});

      // Compute per-agent avg response time from metrics
      const agentAvgDurations: Record<string, number> = {};
      (avgDurations || []).forEach((m: any) => {
        if (!agentAvgDurations[m.agent_id]) agentAvgDurations[m.agent_id] = 0;
        agentAvgDurations[m.agent_id] = m.metric_value;
      });

      const { data: allAgents } = await supabase.from("agents").select("id, tasks_completed_today, avg_response_time_ms, queue_size");

      const totalCompleted = (allAgents || []).reduce((s: number, a: any) => s + (a.tasks_completed_today || 0), 0);
      const totalQueue = (allAgents || []).reduce((s: number, a: any) => s + (a.queue_size || 0), 0);
      const avgResponseTime = allAgents && allAgents.length > 0
        ? Math.round((allAgents || []).reduce((s: number, a: any) => s + (a.avg_response_time_ms || 0), 0) / (allAgents || []).length)
        : 0;

      const metrics = {
        total_tasks_today: totalTasks,
        tasks_completed_today: (tasksToday || []).filter((t: any) => t.status === "completed").length,
        tasks_failed_today: failedTasks,
        tasks_running: (tasksToday || []).filter((t: any) => t.status === "running").length,
        tasks_pending: (tasksToday || []).filter((t: any) => t.status === "pending" || t.status === "queued").length,
        avg_response_time_ms: avgResponseTime,
        total_queue: totalQueue,
        online_agents: (statusCounts["online"] || 0) + (statusCounts["busy"] || 0),
        busy_agents: statusCounts["busy"] || 0,
        offline_agents: statusCounts["offline"] || 0,
        error_agents: statusCounts["error"] || 0,
        total_agents: allAgents?.length || 0,
        error_rate: errorRate,
        uptime_percentage: allAgents && allAgents.length > 0
          ? Math.round(((allAgents.length - (statusCounts["offline"] || 0) - (statusCounts["error"] || 0)) / allAgents.length) * 1000) / 10
          : 100,
        agent_breakdown: (allAgents || []).map((a: any) => ({
          id: a.id,
          tasks_completed_today: a.tasks_completed_today || 0,
          avg_response_time_ms: a.avg_response_time_ms || 0,
          queue_size: a.queue_size || 0,
        })),
      };

      return new Response(JSON.stringify({ success: true, metrics }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── DISPATCH: Create a new task ─────────────────────────────────────────
    if (endpoint === "dispatch") {
      const body = await req.json().catch(() => ({}));
      const { task_type, agent_id, priority = 5, input_data = {}, description } = body;

      if (!task_type) {
        return new Response(JSON.stringify({ error: "task_type required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const targetAgent = agent_id || {
        anomaly_check: "monitor",
        stockout_predict: "analyst",
        alert_triage: "triage",
        case_triage: "triage",
        user_query: "athena",
        notification_send: "executor",
        benchmark: "analyst",
        task_dispatch: "coordinator",
      }[task_type] || "coordinator";

      const { data: task, error } = await supabase
        .from("agent_tasks")
        .insert({
          task_id: taskId,
          agent_id: targetAgent,
          task_type,
          description: description || `Task: ${task_type}`,
          status: "pending",
          priority,
          input_data,
          user_id: auth.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log event
      await supabase.rpc("log_agent_event", {
        p_agent_id: "coordinator",
        p_level: "info",
        p_message: `Task dispatched: ${task_type} → ${targetAgent}`,
        p_metadata: { task_id: taskId, priority },
        p_source: "orchestration",
      });

      return new Response(JSON.stringify({ success: true, task }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── DEFAULT: Full status ─────────────────────────────────────────────────
    const [{ data: agents }, { data: tasks }, { data: logs }, { data: agentStatuses }] = await Promise.all([
      supabase.from("agents").select("*").order("name"),
      supabase.from("agent_tasks").select("*, agents(name, role)").order("created_at", { ascending: false }).limit(20),
      supabase.from("agent_logs").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("agents").select("status"),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const { data: tasksToday } = await supabase
      .from("agent_tasks").select("status").gte("created_at", today);

    const statusCounts = (agentStatuses || []).reduce((acc: Record<string, number>, a: any) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});

    const totalTasks = tasksToday?.length || 0;
    const completedTasks = (tasksToday || []).filter((t: any) => t.status === "completed").length;
    const { data: failedToday } = await supabase
      .from("agent_tasks").select("id", { count: "exact" }).eq("status", "failed").gte("created_at", today);

    const { data: allAgents } = await supabase.from("agents").select("tasks_completed_today, avg_response_time_ms, queue_size");

    const metrics = {
      total_tasks_today: totalTasks,
      tasks_completed_today: completedTasks,
      tasks_failed_today: failedToday?.length || 0,
      avg_response_time_ms: allAgents && allAgents.length > 0
        ? Math.round((allAgents || []).reduce((s: number, a: any) => s + (a.avg_response_time_ms || 0), 0) / (allAgents || []).length)
        : 0,
      total_queue: (allAgents || []).reduce((s: number, a: any) => s + (a.queue_size || 0), 0),
      online_agents: (statusCounts["online"] || 0) + (statusCounts["busy"] || 0),
      busy_agents: statusCounts["busy"] || 0,
      offline_agents: statusCounts["offline"] || 0,
      error_agents: statusCounts["error"] || 0,
      total_agents: agents?.length || 0,
      error_rate: totalTasks > 0 ? Math.round(((failedToday?.length || 0) / totalTasks) * 1000) / 10 : 0,
      uptime_percentage: agents && agents.length > 0
        ? Math.round(((agents.length - (statusCounts["offline"] || 0) - (statusCounts["error"] || 0)) / agents.length) * 1000) / 10
        : 100,
    };

    return new Response(JSON.stringify({
      success: true,
      agents: agents || [],
      tasks: (tasks || []).map((t: any) => ({
        ...t,
        duration_ms: t.started_at && t.completed_at
          ? new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()
          : undefined,
      })),
      logs: logs || [],
      metrics,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Agent orchestration error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
