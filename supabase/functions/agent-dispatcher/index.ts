/// <reference lib="deno.ns" />

/**
 * Agent Dispatcher - Dynamic Agent Task Creation
 * 
 * Runs every 5 minutes via pg_cron
 * 
 * Dynamically creates agent tasks based on:
 * 1. Anomaly detection (Monitor Agent)
 * 2. Stockout risk (Analyst Agent)
 * 3. Alert triage (Triage Agent)
 * 4. Notification dispatch (Executor Agent)
 * 5. Coordinator orchestration (Coordinator Agent)
 * 
 * Architecture:
 * - pg_cron → agent-dispatcher → creates agent_tasks
 * - Each task has: agent_id, task_type, status, context, priority
 * - Tasks auto-expire after 1 hour (prevents zombie tasks)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const sb = createClient(SB_URL, SB_KEY);

// Task priorities
const PRIORITY = { LOW: 3, MEDIUM: 2, HIGH: 1, CRITICAL: 0 };

// Agent definitions
const AGENTS = {
  monitor: { name: "Monitor", role: "Anomaly Detection", priority: PRIORITY.HIGH },
  analyst: { name: "Analyst", role: "Stockout Prediction", priority: PRIORITY.HIGH },
  triage: { name: "Triage", role: "Alert Routing", priority: PRIORITY.MEDIUM },
  executor: { name: "Executor", role: "Action Handler", priority: PRIORITY.LOW },
  coordinator: { name: "Coordinator", role: "Task Orchestrator", priority: PRIORITY.CRITICAL },
  athena: { name: "Athena", role: "AI Chat Agent", priority: PRIORITY.LOW },
};

// Create agent task
async function createAgentTask(
  agentId: string,
  taskType: string,
  description: string,
  context: Record<string, any>,
  priority: number = PRIORITY.MEDIUM
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await sb
      .from("agent_tasks")
      .insert({
        agent_id: agentId,
        task_type: taskType,
        description: description,
        status: "pending",
        priority: priority,
        input_data: context,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error(`Error creating task for ${agentId}:`, error);
      return null;
    }

    return data;
  } catch (e) {
    console.error(`Exception creating task:`, e);
    return null;
  }
}

// Update agent metrics (simplified - just log activity)
// Full metrics tracking would need schema alignment

// Log agent activity
async function logAgentActivity(
  agentId: string,
  level: "info" | "warn" | "error",
  message: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await sb.from("agent_logs").insert({
      agent_id: agentId,
      log_level: level,
      message: message,
      metadata: metadata,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`Error logging:`, e);
  }
}

// Check for anomalies and create Monitor tasks
async function checkAnomalies(): Promise<number> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Get recent critical alerts (last 15 min)
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

  const { data: alerts } = await sb
    .from("alerts")
    .select("id, outlet_id, severity, type, title, created_at")
    .in("severity", ["P0_CRITICAL", "P1_HIGH"])
    .gte("created_at", fifteenMinAgo);

  if (!alerts || alerts.length === 0) {
    await logAgentActivity("monitor", "info", "No anomalies detected", { alert_count: 0 });
    return 0;
  }

  // Check if we already have a recent anomaly_check task for this outlet
  const { data: existingTasks } = await sb
    .from("agent_tasks")
    .select("id, input_data")
    .eq("agent_id", "monitor")
    .eq("task_type", "anomaly_check")
    .eq("status", "pending");

  const existingOutlets = new Set(
    (existingTasks || []).map(t => t.input_data?.outlet_id).filter(Boolean)
  );

  let tasksCreated = 0;

  for (const alert of alerts) {
    if (existingOutlets.has(alert.outlet_id)) continue;

    const task = await createAgentTask(
      "monitor",
      "anomaly_check",
      `Anomaly detected at outlet ${alert.outlet_id}: ${alert.title}`,
      {
        alert_id: alert.id,
        outlet_id: alert.outlet_id,
        severity: alert.severity,
        alert_type: alert.type,
      },
      alert.severity === "P0_CRITICAL" ? PRIORITY.CRITICAL : PRIORITY.HIGH
    );

    if (task) {
      tasksCreated++;
      await logAgentActivity("monitor", "warn", `Created anomaly check task`, {
        task_id: task.id,
        outlet_id: alert.outlet_id,
        severity: alert.severity,
      });
    }
  }

  return tasksCreated;
}

// Check for stockout risks and create Analyst tasks
async function checkStockoutRisks(): Promise<number> {
  const now = new Date();
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

  // Get recent stockout alerts
  const { data: stockoutAlerts } = await sb
    .from("alerts")
    .select("id, outlet_id, title, created_at")
    .eq("type", "STOCKOUT_RISK")
    .gte("created_at", fifteenMinAgo);

  if (!stockoutAlerts || stockoutAlerts.length === 0) {
    await logAgentActivity("analyst", "info", "No stockout risks detected", { count: 0 });
    return 0;
  }

  // Check for existing analyst tasks
  const { data: existingTasks } = await sb
    .from("agent_tasks")
    .select("id, context")
    .eq("agent_id", "analyst")
    .eq("task_type", "stockout_predict")
    .eq("status", "pending");

  const existingOutlets = new Set(
    (existingTasks || []).map(t => t.input_data?.outlet_id).filter(Boolean)
  );

  let tasksCreated = 0;

  for (const alert of stockoutAlerts) {
    if (existingOutlets.has(alert.outlet_id)) continue;

    const task = await createAgentTask(
      "analyst",
      "stockout_predict",
      `Stockout risk analysis for outlet ${alert.outlet_id}`,
      {
        alert_id: alert.id,
        outlet_id: alert.outlet_id,
        alert_title: alert.title,
      },
      PRIORITY.HIGH
    );

    if (task) {
      tasksCreated++;
      await logAgentActivity("analyst", "info", `Created stockout prediction task`, {
        task_id: task.id,
        outlet_id: alert.outlet_id,
      });
    }
  }

  return tasksCreated;
}

// Check for pending alerts and create Triage tasks
async function checkPendingAlerts(): Promise<number> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  // Get un-triaged alerts
  const { data: alerts } = await sb
    .from("alerts")
    .select("id, outlet_id, severity, type, title, created_at")
    .is("assigned_to", null)
    .is("case_id", null)
    .gte("created_at", oneHourAgo);

  if (!alerts || alerts.length === 0) {
    await logAgentActivity("triage", "info", "No pending alerts for triage", { count: 0 });
    return 0;
  }

  // Check for existing triage tasks
  const { data: existingTasks } = await sb
    .from("agent_tasks")
    .select("id, context")
    .eq("agent_id", "triage")
    .eq("task_type", "alert_triage")
    .eq("status", "pending");

  const existingAlertIds = new Set(
    (existingTasks || []).map(t => t.input_data?.alert_id).filter(Boolean)
  );

  let tasksCreated = 0;

  for (const alert of alerts) {
    if (existingAlertIds.has(alert.id)) continue;

    const task = await createAgentTask(
      "triage",
      "alert_triage",
      `Triage alert: ${alert.title}`,
      {
        alert_id: alert.id,
        outlet_id: alert.outlet_id,
        severity: alert.severity,
        type: alert.type,
      },
      alert.severity === "P0_CRITICAL" ? PRIORITY.CRITICAL : PRIORITY.MEDIUM
    );

    if (task) {
      tasksCreated++;
      await logAgentActivity("triage", "info", `Created triage task`, {
        task_id: task.id,
        alert_id: alert.id,
      });
    }
  }

  return tasksCreated;
}

// Check for failed tasks and create retry tasks
async function checkFailedTasks(): Promise<number> {
  const now = new Date();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  // Get failed tasks that need retry
  const { data: failedTasks } = await sb
    .from("agent_tasks")
    .select("id, agent_id, task_type, context, retry_count")
    .eq("status", "failed")
    .gte("updated_at", thirtyMinAgo)
    .lt("retry_count", 3);

  if (!failedTasks || failedTasks.length === 0) {
    return 0;
  }

  let tasksCreated = 0;

  for (const task of failedTasks) {
    const retryCount = (task.retry_count || 0) + 1;

    const newTask = await createAgentTask(
      task.agent_id,
      task.task_type,
      `Retry #${retryCount}: ${task.task_type}`,
      {
        ...task.input_data,
        retry_of: task.id,
        retry_count: retryCount,
      },
      PRIORITY.HIGH
    );

    if (newTask) {
      // Update original task
      await sb
        .from("agent_tasks")
        .update({ retry_count: retryCount })
        .eq("id", task.id);

      tasksCreated++;
      await logAgentActivity("executor", "warn", `Retry task created`, {
        original_task: task.id,
        new_task: newTask.id,
        retry: retryCount,
      });
    }
  }

  return tasksCreated;
}

// Check for pending notifications and create Executor tasks
async function checkPendingNotifications(): Promise<number> {
  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  // Get recent high-severity alerts without notifications
  const { data: alerts } = await sb
    .from("alerts")
    .select("id, outlet_id, severity, title, created_at")
    .in("severity", ["P0_CRITICAL", "P1_HIGH"])
    .gte("created_at", tenMinAgo);

  if (!alerts || alerts.length === 0) {
    return 0;
  }

  // Check for existing notification tasks
  const { data: existingTasks } = await sb
    .from("agent_tasks")
    .select("id, context")
    .eq("agent_id", "executor")
    .eq("task_type", "notification_send")
    .eq("status", "pending");

  const existingAlertIds = new Set(
    (existingTasks || []).map(t => t.input_data?.alert_id).filter(Boolean)
  );

  let tasksCreated = 0;

  for (const alert of alerts) {
    if (existingAlertIds.has(alert.id)) continue;

    const task = await createAgentTask(
      "executor",
      "notification_send",
      `Send notification for: ${alert.title}`,
      {
        alert_id: alert.id,
        outlet_id: alert.outlet_id,
        severity: alert.severity,
        notification_type: "sla_alert",
      },
      alert.severity === "P0_CRITICAL" ? PRIORITY.CRITICAL : PRIORITY.HIGH
    );

    if (task) {
      tasksCreated++;
      await logAgentActivity("executor", "info", `Created notification task`, {
        task_id: task.id,
        alert_id: alert.id,
      });
    }
  }

  return tasksCreated;
}

// Clean up stale pending tasks (older than 1 hour)
async function cleanupStaleTasks(): Promise<number> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("agent_tasks")
    .update({
      status: "failed",
      error_message: "Task expired - no action taken",
      completed_at: now.toISOString(),
    })
    .eq("status", "pending")
    .lt("created_at", oneHourAgo)
    .select("id");

  if (error) {
    console.error("Error cleaning up stale tasks:", error);
    return 0;
  }

  const count = (data || []).length;

  if (count > 0) {
    await logAgentActivity("coordinator", "warn", `Cleaned up ${count} stale tasks`, {
      task_ids: (data || []).map((t: any) => t.id),
    });
  }

  return count;
}

// Main handler
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: HEADERS });
  }

  const startTime = Date.now();
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    dispatcher_run: true,
  };

  try {
    // Run all checks in parallel for efficiency
    const [
      anomalyCount,
      stockoutCount,
      triageCount,
      notificationCount,
      failedRetryCount,
      staleCount,
    ] = await Promise.all([
      checkAnomalies(),
      checkStockoutRisks(),
      checkPendingAlerts(),
      checkPendingNotifications(),
      checkFailedTasks(),
      cleanupStaleTasks(),
    ]);

    results.tasks_created = {
      monitor: anomalyCount,
      analyst: stockoutCount,
      triage: triageCount,
      executor: notificationCount + failedRetryCount,
      coordinator: staleCount,
    };
    results.total_tasks = anomalyCount + stockoutCount + triageCount + notificationCount + failedRetryCount;
    results.stale_cleaned = staleCount;

    // Log dispatcher run
    await logAgentActivity("coordinator", "info", `Dispatcher run completed`, {
      tasks_created: results.total_tasks,
      duration_ms: Date.now() - startTime,
    });

    results.success = true;
    results.duration_ms = Date.now() - startTime;

    return new Response(JSON.stringify(results), {
      headers: { ...HEADERS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Dispatcher error:", e);

    await logAgentActivity("coordinator", "error", `Dispatcher failed: ${e.message}`, {
      error: e.message,
      stack: e.stack,
    });

    return new Response(JSON.stringify({
      success: false,
      error: e.message,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...HEADERS, "Content-Type": "application/json" },
    });
  }
});
