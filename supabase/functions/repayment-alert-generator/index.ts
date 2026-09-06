/// <reference lib="deno.ns" />

/**
 * Repayment Alert Generator Edge Function
 *
 * Generates alerts and cases for repayment-related risk events.
 * Triggered by lender-bridge webhook or risk scorer escalation.
 *
 * POST /functions/v1/repayment-alert-generator
 *
 * Body: {
 *   application_id: string,
 *   franchisee_id: string,
 *   outlet_id?: number,
 *   event_type: string,
 *   severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
 *   message: string,
 *   previous_level?: string
 * }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Severity to priority mapping
const SEVERITY_PRIORITY: Record<string, string> = {
  CRITICAL: 'URGENT',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

// Alert types
const ALERT_TYPES: Record<string, string> = {
  EMI_OVERDUE: 'REPAYMENT_WARNING',
  DELINQUENCY_STARTED: 'REPAYMENT_RISK',
  DEFAULT_NOTICE: 'REPAYMENT_CRITICAL',
  RISK_ESCALATION: 'REPAYMENT_ESCALATION',
  PARTIAL_PAYMENT: 'REPAYMENT_INFO',
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      application_id,
      franchisee_id,
      outlet_id,
      event_type,
      severity,
      message,
      previous_level
    } = body;

    // Validate required fields
    if (!application_id || !franchisee_id || !event_type || !severity || !message) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required fields: application_id, franchisee_id, event_type, severity, message"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get application details for context
    const { data: application } = await supabase
      .from('financing_applications')
      .select('*, outlets:outlet_id(id, name, region_id)')
      .eq('id', application_id)
      .maybeSingle();

    // 2. Determine alert type
    const alertType = ALERT_TYPES[event_type] || 'REPAYMENT_GENERAL';

    // 3. Create alert record
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .insert({
        alert_type: alertType,
        severity: severity,
        title: getAlertTitle(event_type, severity),
        message: message,
        entity_type: 'FINANCING_APPLICATION',
        entity_id: application_id,
        outlet_id: outlet_id || application?.outlet_id || null,
        region_id: application?.outlets?.region_id || null,
        metadata: {
          event_type,
          franchisee_id,
          application_id,
          requested_amount: application?.requested_amount,
          approved_amount: application?.approved_amount,
          previous_risk_level: previous_level || null,
          source: 'REPAYMENT_SYSTEM'
        },
        status: 'OPEN',
        priority: SEVERITY_PRIORITY[severity] || 'MEDIUM',
      })
      .select()
      .single();

    if (alertError) {
      console.error('Failed to create alert:', alertError);
      throw alertError;
    }

    // 4. Create case for critical issues
    let caseCreated = null;
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .insert({
          case_type: 'REPAYMENT_ESCALATION',
          priority: SEVERITY_PRIORITY[severity],
          title: `Payment Issue: ${event_type} - ${application?.outlets?.name || 'Unknown Outlet'}`,
          description: message,
          entity_type: 'FINANCING_APPLICATION',
          entity_id: application_id,
          outlet_id: outlet_id || application?.outlet_id || null,
          created_by: null, // System created
          status: 'OPEN',
        })
        .select()
        .single();

      if (caseError) {
        console.error('Failed to create case:', caseError);
        // Non-fatal, continue
      } else {
        caseCreated = caseData;
      }
    }

    // 5. Send notification to franchisee
    try {
      await supabase.functions.invoke('notification-send', {
        body: {
          user_id: franchisee_id,
          title: `Payment Alert: ${getAlertTitle(event_type, severity)}`,
          message: message,
          channel: 'ALL',
          priority: severity === 'CRITICAL' || severity === 'HIGH' ? 'HIGH' : 'NORMAL',
          metadata: {
            alert_id: alert.id,
            case_id: caseCreated?.id,
            application_id,
            event_type,
          }
        }
      });
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError);
      // Non-fatal, continue
    }

    // 6. If HIGH or CRITICAL, also notify HQ/Regional managers
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      try {
        // Get HQ admins and regional managers
        const { data: managers } = await supabase
          .from('user_profiles')
          .select('id')
          .in('role', ['HQ_ADMIN', 'REGIONAL_MANAGER']);

        if (managers && managers.length > 0) {
          for (const manager of managers) {
            await supabase.functions.invoke('notification-send', {
              body: {
                user_id: manager.id,
                title: `[${severity}] ${getAlertTitle(event_type, severity)}`,
                message: `${message}\n\nOutlet: ${application?.outlets?.name || 'N/A'}\nApplication: ${application_id}`,
                channel: 'ALL',
                priority: 'HIGH',
                metadata: {
                  alert_id: alert.id,
                  case_id: caseCreated?.id,
                  application_id,
                  event_type,
                  severity,
                }
              }
            }).catch(() => {}); // Ignore individual failures
          }
        }
      } catch (e) {
        console.error('Failed to notify managers:', e);
        // Non-fatal
      }
    }

    return new Response(JSON.stringify({
      success: true,
      alert: alert,
      case: caseCreated,
      notified_franchisee: true,
      notified_managers: severity === 'HIGH' || severity === 'CRITICAL',
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Repayment Alert Generator Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Internal server error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getAlertTitle(eventType: string, severity: string): string {
  const titles: Record<string, string> = {
    EMI_OVERDUE: 'EMI Payment Overdue',
    DELINQUENCY_STARTED: 'Delinquency Status Activated',
    DEFAULT_NOTICE: 'Payment Default Notice Issued',
    RISK_ESCALATION: 'Risk Level Escalation',
    PARTIAL_PAYMENT: 'Partial Payment Received',
    FULL_REPAYMENT: 'Financing Fully Repaid',
  };

  return titles[eventType] || `Payment Event: ${eventType}`;
}
