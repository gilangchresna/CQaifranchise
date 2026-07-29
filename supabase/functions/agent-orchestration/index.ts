/// <reference lib="deno.ns" />

/**
 * Agent Orchestration Edge Function
 * Serves agent status, task pipeline, and logs
 *
 * GET /functions/v1/agent-orchestration
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "online" | "busy" | "offline" | "error";
  last_active: string;
  tasks_completed_today: number;
  avg_response_time_ms: number;
  queue_size: number;
  description: string;
  capabilities: string[];
}

interface AgentTask {
  id: string;
  agent_id: string;
  agent_name: string;
  task_type: string;
  description: string;
  status: "queued" | "running" | "completed" | "failed";
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  result?: string;
}

interface AgentLog {
  id: string;
  agent_id: string;
  agent_name: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Mock agent data
const agents: Agent[] = [
  {
    id: "athena",
    name: "Athena",
    role: "Main AI Assistant",
    status: "online",
    last_active: new Date().toISOString(),
    tasks_completed_today: 1247,
    avg_response_time_ms: 245,
    queue_size: 0,
    description: "Primary AI assistant for natural language queries and summaries",
    capabilities: ["Chat", "Summarize", "Explain", "Recommend"],
  },
  {
    id: "monitor",
    name: "Monitor",
    role: "Alert & Monitoring Agent",
    status: "online",
    last_active: new Date().toISOString(),
    tasks_completed_today: 8923,
    avg_response_time_ms: 12,
    queue_size: 0,
    description: "24/7 monitoring of outlet metrics, anomaly detection, alert triggers",
    capabilities: ["Z-score", "Stockout Detection", "Alert Triggers", "Real-time Watch"],
  },
  {
    id: "analyst",
    name: "Analyst",
    role: "Data Analysis Agent",
    status: "busy",
    last_active: new Date().toISOString(),
    tasks_completed_today: 234,
    avg_response_time_ms: 1847,
    queue_size: 3,
    description: "Analyzes trends, generates insights, produces reports",
    capabilities: ["Trend Analysis", "Forecasting", "Report Generation", "Benchmarking"],
  },
  {
    id: "coordinator",
    name: "Coordinator",
    role: "Task Routing Agent",
    status: "online",
    last_active: new Date().toISOString(),
    tasks_completed_today: 456,
    avg_response_time_ms: 89,
    queue_size: 1,
    description: "Routes requests to appropriate agents, assigns cases, handles escalation",
    capabilities: ["Task Routing", "Case Assignment", "Escalation", "Priority Queue"],
  },
  {
    id: "triage",
    name: "Triage",
    role: "Case Triage Agent",
    status: "online",
    last_active: new Date().toISOString(),
    tasks_completed_today: 189,
    avg_response_time_ms: 423,
    queue_size: 2,
    description: "Categorizes incoming issues, suggests resolution paths",
    capabilities: ["Categorization", "Priority Scoring", "SLA Calculation", "Similar Case Lookup"],
  },
  {
    id: "executor",
    name: "Executor",
    role: "Action Execution Agent",
    status: "online",
    last_active: new Date().toISOString(),
    tasks_completed_today: 67,
    avg_response_time_ms: 156,
    queue_size: 0,
    description: "Executes automated actions: create case, send notification, update CRM",
    capabilities: ["Create Case", "Send Alert", "Notify", "CRM Update", "Webhook Trigger"],
  },
];

// Generate recent tasks
function generateRecentTasks(): AgentTask[] {
  const taskTypes = [
    { type: "chat", desc: "User query about outlet performance", agent: "athena" },
    { type: "alert", desc: "Z-score anomaly detected for MYB-002", agent: "monitor" },
    { type: "analysis", desc: "Revenue trend analysis for July", agent: "analyst" },
    { type: "triage", desc: "Stock alert categorization for WKN-001", agent: "triage" },
    { type: "route", desc: "Route case to Regional Manager", agent: "coordinator" },
    { type: "execute", desc: "Create case from alert #4521", agent: "executor" },
    { type: "summarize", desc: "Daily outlet summary generation", agent: "athena" },
    { type: "forecast", desc: "Tomorrow's sales forecast", agent: "analyst" },
  ];

  const now = new Date();
  return taskTypes.map((t, idx) => {
    const agent = agents.find(a => a.id === t.agent)!;
    const startTime = new Date(now.getTime() - (idx + 1) * 60000);
    const isComplete = idx > 1;
    return {
      id: `task-${Date.now() - idx}`,
      agent_id: t.agent,
      agent_name: agent.name,
      task_type: t.type,
      description: t.desc,
      status: isComplete ? "completed" : (idx === 2 ? "running" : "queued"),
      started_at: startTime.toISOString(),
      completed_at: isComplete ? new Date(startTime.getTime() + Math.random() * 5000).toISOString() : undefined,
      duration_ms: isComplete ? Math.floor(Math.random() * 5000) + 100 : undefined,
    };
  });
}

// Generate logs
function generateLogs(): AgentLog[] {
  const logMessages = [
    { agent: "monitor", level: "info", msg: "Z-score calculation completed for all 24 outlets" },
    { agent: "monitor", level: "debug", msg: "Baseline refreshed: 30-day rolling average updated" },
    { agent: "athena", level: "info", msg: "User query processed: outlet performance summary" },
    { agent: "coordinator", level: "info", msg: "Task routed to Analyst agent" },
    { agent: "analyst", level: "info", msg: "Trend analysis started for region JKT" },
    { agent: "triage", level: "info", msg: "Case categorized as INVENTORY with HIGH priority" },
    { agent: "executor", level: "info", msg: "Case #4521 created successfully" },
    { agent: "monitor", level: "warn", msg: "Stock risk threshold exceeded at WKN-001" },
    { agent: "coordinator", level: "info", msg: "Escalation triggered: P0 case requires attention" },
    { agent: "athena", level: "debug", msg: "Context window: 3421 tokens / 8192 max" },
  ];

  const now = new Date();
  return logMessages.map((l, idx) => {
    const agent = agents.find(a => a.id === l.agent)!;
    return {
      id: `log-${Date.now() - idx}`,
      agent_id: l.agent,
      agent_name: agent.name,
      level: l.level as any,
      message: l.msg,
      timestamp: new Date(now.getTime() - idx * 30000).toISOString(),
      metadata: { request_id: `req-${1000 + idx}` },
    };
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify JWT authentication for all requests
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.substring(7);

  try {
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${token}`, "apikey": supabaseServiceKey },
    });

    if (!verifyRes.ok) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Authentication failed" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") || "status";

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (endpoint === "agents") {
      return new Response(
        JSON.stringify({ success: true, agents }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "tasks") {
      const tasks = generateRecentTasks();
      return new Response(
        JSON.stringify({ success: true, tasks }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "logs") {
      const logs = generateLogs();
      return new Response(
        JSON.stringify({ success: true, logs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "metrics") {
      const metrics = {
        total_tasks_today: agents.reduce((sum, a) => sum + a.tasks_completed_today, 0),
        avg_response_time: Math.round(
          agents.reduce((sum, a) => sum + a.avg_response_time_ms, 0) / agents.length
        ),
        total_queue: agents.reduce((sum, a) => sum + a.queue_size, 0),
        online_agents: agents.filter(a => a.status === "online" || a.status === "busy").length,
        total_agents: agents.length,
        uptime_percentage: 99.7,
        error_rate: 0.3,
      };
      return new Response(
        JSON.stringify({ success: true, metrics }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: return full status
    return new Response(
      JSON.stringify({
        success: true,
        agents,
        tasks: generateRecentTasks(),
        logs: generateLogs(),
        metrics: {
          total_tasks_today: agents.reduce((sum, a) => sum + a.tasks_completed_today, 0),
          avg_response_time: Math.round(
            agents.reduce((sum, a) => sum + a.avg_response_time_ms, 0) / agents.length
          ),
          total_queue: agents.reduce((sum, a) => sum + a.queue_size, 0),
          online_agents: agents.filter(a => a.status === "online" || a.status === "busy").length,
          total_agents: agents.length,
          uptime_percentage: 99.7,
          error_rate: 0.3,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Agent orchestration error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
