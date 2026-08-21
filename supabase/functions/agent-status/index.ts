/**
 * Agent Status - Returns current status of all agents
 * Edge Function: agent-status
 * SECURITY: Requires authentication
 */

import { createClient } from "jsr:@supabase/supabase-js@2"
import { verifyAuth, unauthorizedResponse } from "../_shared/auth-helper.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

interface AgentStatus {
  agent_id: string
  name: string
  role: string
  status: 'online' | 'busy' | 'offline' | 'error'
  tasks_pending: number
  tasks_running: number
  tasks_completed: number
  tasks_failed: number
  tasks_completed_today: number
  avg_response_time_ms: number
  uptime_percent: number
  last_activity: string | null
  description: string
}

// Calculate agent status from recent tasks
function calculateStatus(tasks: any[]): 'online' | 'busy' | 'offline' | 'error' {
  const runningTasks = tasks.filter(t => t.status === 'running')
  const failedTasks = tasks.filter(t => t.status === 'failed')

  if (runningTasks.length > 0) return 'busy'
  if (failedTasks.length > 2) return 'error'
  return 'online'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // SECURITY: Verify authentication (no-auth allowed for internal/cron calls)
  const auth = await verifyAuth(req, true, true)
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error)
  }

  try {
    // Calculate 24 hours ago in UTC
    // Edge Functions run on Deno Deploy (UTC)
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get recent tasks (last 24 hours in UTC)
    const { data: recentTasks, error: tasksError } = await supabase
      .from('agent_tasks')
      .select('*')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    if (tasksError) {
      console.error('Tasks error:', tasksError);
      throw tasksError;
    }

    // Get latest metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('agent_metrics')
      .select('*')
      .gte('recorded_at', twentyFourHoursAgo.toISOString())
      .order('recorded_at', { ascending: false });

    if (metricsError) {
      console.error('Metrics error:', metricsError);
      throw metricsError;
    }
    
    console.log(`Found ${recentTasks?.length || 0} tasks in last 24 hours`);
    console.log(`Found ${metrics?.length || 0} metrics in last 24 hours`);

    // Define all agents
    const agentDefinitions = [
      { id: 'athena', name: 'Athena', role: 'AI Chat Agent', description: 'Primary AI assistant for franchisee queries' },
      { id: 'monitor', name: 'Monitor', role: 'Anomaly Detection', description: 'Real-time anomaly detection in sales data' },
      { id: 'analyst', name: 'Analyst', role: 'Stockout Prediction', description: 'Stockout prediction + peer benchmarking' },
      { id: 'triage', name: 'Triage', role: 'Alert Routing', description: 'Route incoming alerts to correct handler' },
      { id: 'coordinator', name: 'Coordinator', role: 'Task Orchestrator', description: 'Orchestrate all agents, route tasks' },
      { id: 'executor', name: 'Executor', role: 'Action Handler', description: 'Execute actions based on decisions' }
    ]

    // Build agent statuses
    const agentStatuses: AgentStatus[] = agentDefinitions.map(agent => {
      const agentTasks = (recentTasks || []).filter(t => t.agent_id === agent.id)
      const agentMetrics = (metrics || []).filter(m => m.agent_id === agent.id)

      // Calculate metrics
      const uptimeMetric = agentMetrics.find(m => m.metric_type === 'uptime')
      const avgDurationMetric = agentMetrics.find(m => m.metric_type === 'avg_duration')

      const tasks_completed_today = agentTasks.filter(t => t.status === 'completed').length
      const tasks_failed = agentTasks.filter(t => t.status === 'failed').length

      // Get last activity
      const lastTask = agentTasks.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]

      return {
        agent_id: agent.id,
        name: agent.name,
        role: agent.role,
        status: calculateStatus(agentTasks),
        tasks_pending: agentTasks.filter(t => t.status === 'pending').length,
        tasks_running: agentTasks.filter(t => t.status === 'running').length,
        tasks_completed: tasks_completed_today,
        tasks_failed,
        tasks_completed_today,
        avg_response_time_ms: avgDurationMetric?.metric_value || 0,
        uptime_percent: uptimeMetric?.metric_value || 100,
        last_activity: lastTask?.created_at || null,
        description: agent.description
      }
    })

    // Summary stats
    // Note: Use recentTasks count directly, not agentStatuses which might have issues
    const totalTasksInWindow = (recentTasks || []).length;
    const totalCompleted = (recentTasks || []).filter(t => t.status === 'completed').length;
    const totalFailed = (recentTasks || []).filter(t => t.status === 'failed').length;
    
    const summary = {
      total_tasks_today: totalTasksInWindow,
      total_completed: totalCompleted,
      total_failed: totalFailed,
      avg_uptime: agentStatuses.length > 0 
        ? agentStatuses.reduce((sum, a) => sum + a.uptime_percent, 0) / agentStatuses.length 
        : 100,
      coordinator_up: agentStatuses.find(a => a.agent_id === 'coordinator')?.status !== 'offline'
    };

    return new Response(JSON.stringify({
      success: true,
      agents: agentStatuses,
      summary,
      last_updated: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
