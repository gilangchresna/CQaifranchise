// alert-to-case Edge Function
// Auto-creates cases from high-priority alerts (P0/P1)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Severity to Priority mapping
const severityToPriority: Record<string, string> = {
  "P0_CRITICAL": "URGENT",
  "P1_HIGH": "HIGH",
  "P2_MEDIUM": "MEDIUM",
  "P3_LOW": "LOW",
}

// SLA hours by priority
const slaHours: Record<string, number> = {
  "URGENT": 1,
  "HIGH": 4,
  "MEDIUM": 24,
  "LOW": 48,
}

// Auto-assignment by alert type
const typeToAgent: Record<string, string> = {
  "STOCKOUT_RISK": "analyst",
  "SALES_ANOMALY": "monitor",
  "SLA_BREACH": "triage",
  "PAYMENT_OVERDUE": "coordinator",
}

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // First, get IDs of alerts that already have cases
    const { data: existingCases } = await supabase
      .from("cases")
      .select("alert_id")
      .not("alert_id", "is", null)

    const existingAlertIds = new Set(existingCases?.map(c => c.alert_id) || [])
    
    // Get all NEW alerts with P0/P1 severity
    const { data: alerts, error: alertError } = await supabase
      .from("alerts")
      .select("*")
      .eq("status", "NEW")
      .in("severity", ["P0_CRITICAL", "P1_HIGH"])
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50)

    if (alertError) {
      console.error("Error fetching alerts:", alertError)
      throw alertError
    }

    console.log(`Found ${alerts?.length || 0} potential alerts, ${existingAlertIds.size} already have cases`)

    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No alerts to process",
        cases_created: 0
      }), { headers: { "Content-Type": "application/json" } })
    }

    // Filter out alerts that already have cases
    const eligibleAlerts = alerts.filter(a => !existingAlertIds.has(a.id))
    console.log(`Processing ${eligibleAlerts.length} eligible alerts`)

    let casesCreated = 0
    let casesSkipped = 0
    const results: any[] = []

    for (const alert of eligibleAlerts) {
      try {
        // Determine priority from severity
        const priority = severityToPriority[alert.severity] || "MEDIUM"
        
        // Determine assigned agent from alert type
        const assignedAgent = typeToAgent[alert.type] || "coordinator"
        
        // Calculate SLA deadline
        const slaHoursValue = slaHours[priority] || 24
        const slaDeadline = new Date(Date.now() + slaHoursValue * 60 * 60 * 1000).toISOString()

        // Extract outlet info from title if available
        let outletName = "Unknown"
        const outletMatch = alert.title.match(/at (.+?)$/) || alert.title.match(/in (.+?)$/)
        if (outletMatch) {
          outletName = outletMatch[1].trim()
        }

        // Create case
        const { data: newCase, error: caseError } = await supabase
          .from("cases")
          .insert({
            title: alert.title,
            description: `${alert.description || ""}\n\n---\nAuto-created from Alert #${alert.id}\nSeverity: ${alert.severity}\nOutlet: ${outletName}\nSource: AI Agent Orchestration`,
            priority: priority,
            status: "NEW",
            alert_id: alert.id,
            region_id: alert.region_id,
            sla_deadline: slaDeadline,
          })
          .select()
          .single()

        if (caseError) {
          console.error(`Error creating case for alert ${alert.id}:`, caseError)
          casesSkipped++
          continue
        }

        // Create agent task for assigned agent
        await supabase
          .from("agent_tasks")
          .insert({
            agent_id: assignedAgent,
            task_type: "case_review",
            status: "pending",
            priority: priority === "URGENT" ? 1 : priority === "HIGH" ? 2 : 3,
            input_data: {
              case_id: newCase.id,
              alert_id: alert.id,
              alert_type: alert.type,
              outlet: outletName,
              action: "review_case"
            }
          })

        // Log action
        await supabase
          .from("agent_logs")
          .insert({
            agent_id: "coordinator",
            action: "case_created",
            details: {
              case_id: newCase.id,
              alert_id: alert.id,
              priority: priority,
              assigned_to: assignedAgent
            }
          })

        casesCreated++
        results.push({
          alert_id: alert.id,
          case_id: newCase.id,
          priority: priority,
          assigned_to: assignedAgent
        })

        console.log(`Created case ${newCase.id} from alert ${alert.id}`)
      } catch (err) {
        console.error(`Error processing alert ${alert.id}:`, err)
        casesSkipped++
      }
    }

    console.log(`Summary: ${casesCreated} cases created, ${casesSkipped} skipped`)

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${eligibleAlerts.length} eligible alerts`,
      cases_created: casesCreated,
      cases_skipped: casesSkipped,
      results: results
    }), { headers: { "Content-Type": "application/json" } })

  } catch (err) {
    console.error("Unhandled error:", err)
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
