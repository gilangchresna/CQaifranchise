/**
 * Agent Status - Returns current status of all agents
 * Edge Function: agent-status
 */

import { createClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Get recent tasks (last 24 hours)
    const { data: recentTasks, error: tasksError } = await supabase
      .from('agent_tasks')
      .select('*')
      .gte('created_at', twentyFourHoursAgo)

    if (tasksError) throw tasksError

    // Get latest metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('agent_metrics')
      .select('*')
      .gte('recorded_at', twentyFourHoursAgo)

    if (metricsError) throw metricsError

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
    const summary = {
      total_tasks_today: (recentTasks || []).length,
      total_completed: agentStatuses.reduce((sum, a) => sum + a.tasks_completed, 0),
      total_failed: agentStatuses.reduce((sum, a) => sum + a.tasks_failed, 0),
      avg_uptime: agentStatuses.reduce((sum, a) => sum + a.uptime_percent, 0) / agentStatuses.length,
      coordinator_up: agentStatuses.find(a => a.agent_id === 'coordinator')?.status !== 'offline'
    }

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
