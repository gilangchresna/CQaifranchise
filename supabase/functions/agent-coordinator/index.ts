/**
 * Agent Coordinator - The Brain of Agent Orchestration
 * Routes tasks to appropriate agents based on task type
 *
 * Edge Function: agent-coordinator
 */

import { createClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Agent endpoints (Edge Functions)
const AGENT_ENDPOINTS: Record<string, string> = {
  monitor: `${SUPABASE_URL}/functions/v1/ml-anomaly-v2`,
  analyst: `${SUPABASE_URL}/functions/v1/ml-stockout-v2`,
  triage: `${SUPABASE_URL}/functions/v1/athena-case-triage`,
  athena: `${SUPABASE_URL}/functions/v1/athena-chat`,
  executor: `${SUPABASE_URL}/functions/v1/notification-send`
}

interface TaskRequest {
  task_type: 'anomaly_check' | 'stockout_predict' | 'alert_triage' | 'case_triage' | 'user_query' | 'notification_send' | 'benchmark' | 'task_dispatch'
  priority?: number
  input_data?: Record<string, any>
  user_id?: string
}

interface TaskResponse {
  success: boolean
  task_id?: string
  agent_id?: string
  result?: any
  error?: string
  execution_time_ms?: number
}

// Map task types to agent IDs
function getAgentForTask(taskType: string): string {
  const mapping: Record<string, string> = {
    'anomaly_check': 'monitor',
    'stockout_predict': 'analyst',
    'alert_triage': 'triage',
    'case_triage': 'triage',
    'user_query': 'athena',
    'notification_send': 'executor',
    'benchmark': 'analyst',
    'task_dispatch': 'coordinator'
  }
  return mapping[taskType] || 'coordinator'
}

// Log agent event
async function logEvent(agentId: string, level: string, message: string, metadata?: any, taskId?: string) {
  try {
    await supabase.rpc('log_agent_event', {
      p_agent_id: agentId,
      p_level: level,
      p_message: message,
      p_metadata: metadata || null,
      p_task_id: taskId || null,
      p_source: 'coordinator'
    })
  } catch (e) {
    console.error('Failed to log event:', e)
  }
}

// Create task record
async function createTask(taskType: string, agentId: string, priority: number, inputData: any): Promise<string> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .insert({
      agent_id: agentId,
      task_type: taskType,
      status: 'pending',
      priority: priority,
      input_data: inputData
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create task: ${error.message}`)
  return data.id
}

// Update task status
async function updateTaskStatus(taskId: string, status: string, outputData?: any, errorMessage?: string) {
  const update: any = { status }
  if (status === 'running') update.started_at = new Date().toISOString()
  if (status === 'completed' || status === 'failed') update.completed_at = new Date().toISOString()
  if (outputData) update.output_data = outputData
  if (errorMessage) update.error_message = errorMessage

  await supabase.from('agent_tasks').update(update).eq('id', taskId)
}

// Call external agent
async function callAgent(agentId: string, inputData: any, authToken?: string): Promise<any> {
  const endpoint = AGENT_ENDPOINTS[agentId]
  if (!endpoint) {
    throw new Error(`Unknown agent: ${agentId}`)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(inputData)
    })

    if (!response.ok) {
      throw new Error(`Agent ${agentId} returned ${response.status}`)
    }

    return await response.json()
  } catch (e) {
    throw new Error(`Failed to call agent ${agentId}: ${e.message}`)
  }
}

// Record metric
async function recordMetric(agentId: string, metricType: string, value: number, unit: string = 'count') {
  await supabase.from('agent_metrics').insert({
    agent_id: agentId,
    metric_type: metricType,
    metric_value: value,
    metric_unit: unit,
    recorded_at: new Date().toISOString()
  })
}

// Main handler
Deno.serve(async (req: Request) => {
  const startTime = Date.now()

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://cqaifranchise.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get auth session
    const authHeader = req.headers.get('Authorization')
    let userId: string | undefined
    let session: any

    if (authHeader) {
      const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      userId = data.user?.id
      session = data.user
    }

    // Parse request
    const body: TaskRequest = await req.json()
    const { task_type, priority = 5, input_data = {} } = body

    if (!task_type) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required field: task_type'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Determine target agent
    const targetAgent = getAgentForTask(task_type)

    // Create task record
    const taskId = await createTask(task_type, targetAgent, priority, { ...input_data, user_id: userId })

    await logEvent('coordinator', 'info', `Routing task ${taskId}: ${task_type} → ${targetAgent}`, { priority, user_id: userId }, taskId)

    // Update to running
    await updateTaskStatus(taskId, 'running')

    let result: any

    try {
      // Call the target agent (or handle internally for coordinator tasks)
      if (targetAgent === 'coordinator') {
        // Coordinator handles routing decisions internally
        result = {
          routed: true,
          task_type,
          target_agent: 'self',
          message: 'Coordinator task processed'
        }
      } else {
        // Call external agent
        result = await callAgent(targetAgent, { ...input_data, task_id: taskId }, authHeader?.replace('Bearer ', ''))
      }

      // Success
      await updateTaskStatus(taskId, 'completed', result)
      await logEvent('coordinator', 'info', `Task ${taskId} completed successfully`, { agent: targetAgent }, taskId)

      // Record dispatch metric
      await recordMetric('coordinator', 'tasks_completed', 1)

      const executionTime = Date.now() - startTime
      await recordMetric('coordinator', 'avg_duration', executionTime, 'ms')

      return new Response(JSON.stringify({
        success: true,
        task_id: taskId,
        agent_id: targetAgent,
        result,
        execution_time_ms: executionTime
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (agentError: any) {
      // Agent failed
      await updateTaskStatus(taskId, 'failed', null, agentError.message)
      await logEvent('coordinator', 'error', `Task ${taskId} failed: ${agentError.message}`, { agent: targetAgent }, taskId)

      await recordMetric('coordinator', 'errors', 1)

      return new Response(JSON.stringify({
        success: false,
        task_id: taskId,
        agent_id: targetAgent,
        error: agentError.message,
        execution_time_ms: Date.now() - startTime
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

  } catch (error: any) {
    await logEvent('coordinator', 'error', `Coordinator error: ${error.message}`, { stack: error.stack })

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
