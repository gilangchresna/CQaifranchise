/// <reference lib="deno.ns" />

/**
 * Lender Bridge Edge Function
 * Generic bridge-loan financing integration for franchisee setup.
 *
 * POST /functions/v1/lender-bridge
 *   action: "submit_application" | "get_status" | "cancel_application"
 *
 * POST /functions/v1/lender-bridge/webhook
 *   inbound from lender — approvals, declines, disbursement, repayments
 *   Query param ?type=repayment for payment-specific events
 *
 * POST /functions/v1/lender-bridge/webhook?type=repayment
 *   repayment-specific webhook for EMI payments, delinquency, etc.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGINS") || "https://c-qaifranchise.vercel.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lender-webhook-secret",
  "Access-Control-Max-Age": "86400",
};

// =============================================================================
// EVENT TYPE CONSTANTS
// =============================================================================

const REPAYMENT_EVENT_TYPES = {
  APPLICATION_SUBMITTED: 'APPLICATION_SUBMITTED',
  APPLICATION_APPROVED: 'APPLICATION_APPROVED',
  APPLICATION_DECLINED: 'APPLICATION_DECLINED',
  DISBURSEMENT_COMPLETED: 'DISBURSEMENT_COMPLETED',
  EMI_DUE: 'EMI_DUE',
  EMI_PAID: 'EMI_PAID',
  EMI_OVERDUE: 'EMI_OVERDUE',
  PARTIAL_PAYMENT: 'PARTIAL_PAYMENT',
  DELINQUENCY_STARTED: 'DELINQUENCY_STARTED',
  DELINQUENCY_RESOLVED: 'DELINQUENCY_RESOLVED',
  DEFAULT_NOTICE: 'DEFAULT_NOTICE',
  FULL_REPAYMENT: 'FULL_REPAYMENT',
  EARLY_REPAYMENT: 'EARLY_REPAYMENT',
  STATUS_CHANGE: 'STATUS_CHANGE',
} as const;

type RepaymentEventType = typeof REPAYMENT_EVENT_TYPES[keyof typeof REPAYMENT_EVENT_TYPES];

const DELINQUENCY_LEVELS = ['NONE', 'MILD', 'MODERATE', 'SEVERE', 'CRITICAL'] as const;
const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const VALID_PURPOSES = ["FRANCHISEE_SETUP", "INVENTORY", "EQUIPMENT", "WORKING_CAPITAL"];

interface SubmitApplicationBody {
  action: "submit_application";
  franchisee_id?: string; // defaults to the authenticated user
  outlet_id?: number;
  pilot_outreach_id?: number;
  purpose?: string;
  requested_amount: number;
  currency?: string;
  requested_term_months?: number;
  lender_code?: string;
}

interface StatusBody {
  action: "get_status";
  application_id: string;
}

interface CancelBody {
  action: "cancel_application";
  application_id: string;
}

async function verifyAuth(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authorized: false as const, status: 401, error: "Missing Authorization header" };
  }
  const token = authHeader.substring(7);
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  if (!resp.ok) return { authorized: false as const, status: 401, error: "Invalid token" };
  const userData = await resp.json();
  return {
    authorized: true as const,
    userId: userData.id as string,
    role: (userData.user_metadata?.role as string) || "FRANCHISEE_OWNER",
  };
}

/** Look up lender adapter config from public.integrations (type='LENDER'). */
async function getLenderConfig(supabase: any, lenderCode: string) {
  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("type", "LENDER")
    .eq("name", lenderCode)
    .maybeSingle();
  return data || null;
}

/**
 * Call the real lender API if configured, otherwise simulate a response so
 * the product flow works end-to-end before a lender contract is signed.
 */
async function callLender(
  action: "submit" | "status" | "cancel",
  lenderConfig: any,
  payload: Record<string, any>
): Promise<{ simulated: boolean; data: any }> {
  if (lenderConfig?.config?.base_url && lenderConfig?.config?.api_key) {
    // Real lender call. Kept generic (REST + bearer token) since the actual
    // contract depends on which lender CyberQuote signs with; adjust the
    // path/auth here once that lender's API spec is known.
    const resp = await fetch(`${lenderConfig.config.base_url}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lenderConfig.config.api_key}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(`Lender API error (${resp.status}): ${JSON.stringify(data)}`);
    return { simulated: false, data };
  }

  // Simulate mode — no lender configured yet.
  await new Promise((r) => setTimeout(r, 150));
  if (action === "submit") {
    return {
      simulated: true,
      data: {
        lender_reference_id: `SIM-${Date.now()}`,
        status: "UNDER_REVIEW",
        message: "No lender configured (public.integrations type=LENDER) — running in simulate mode.",
      },
    };
  }
  if (action === "status") {
    return { simulated: true, data: { status: payload.last_known_status || "UNDER_REVIEW" } };
  }
  return { simulated: true, data: { status: "CANCELLED" } };
}

/** Read a single setting value. Returns fallback if not found. */
async function getSetting(supabase: any, key: string, fallback: string = ""): Promise<string> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? fallback;
}

async function handleSubmit(req: Request, supabase: any, auth: { userId: string; role: string }, body: SubmitApplicationBody) {
  if (!body.requested_amount || body.requested_amount <= 0) {
    return { status: 400, body: { success: false, error: "requested_amount must be a positive number" } };
  }
  
  // FIX 1.2: Validate amount is not excessive
  const MAX_AMOUNT = 10000000; // 10M SGD max
  if (body.requested_amount > MAX_AMOUNT) {
    return { status: 400, body: { success: false, error: `requested_amount exceeds maximum of ${MAX_AMOUNT}` } };
  }
  
  const purpose = body.purpose && VALID_PURPOSES.includes(body.purpose) ? body.purpose : "FRANCHISEE_SETUP";
  const lenderCode = body.lender_code || "GENERIC";

  // Franchisees may only submit for themselves; HQ/Regional may submit on
  // behalf of a franchisee during onboarding.
  const franchiseeId =
    auth.role === "HQ_ADMIN" || auth.role === "REGIONAL_MANAGER"
      ? body.franchisee_id || auth.userId
      : auth.userId;

  // FIX 1.2: Rate limiting - max 5 applications per day per franchisee
  const today = new Date().toISOString().split('T')[0];
  const { count: dailyCount } = await supabase
    .from("financing_applications")
    .select('id', { count: 'exact', head: true })
    .eq('franchisee_id', franchiseeId)
    .gte('submitted_at', today);
  
  if ((dailyCount || 0) >= 5) {
    return { 
      status: 429, 
      body: { 
        success: false, 
        error: "Rate limit exceeded. Maximum 5 applications per day." 
      } 
    };
  }
  
  const submittedPayload = {
    franchisee_id: franchiseeId,
    outlet_id: body.outlet_id ?? null,
    purpose,
    requested_amount: body.requested_amount,
    currency: body.currency || "SGD",
    requested_term_months: body.requested_term_months ?? null,
  };

  const { data: application, error } = await supabase
    .from("financing_applications")
    .insert({
      franchisee_id: franchiseeId,
      outlet_id: body.outlet_id ?? null,
      pilot_outreach_id: body.pilot_outreach_id ?? null,
      purpose,
      requested_amount: body.requested_amount,
      currency: body.currency || "SGD",
      requested_term_months: body.requested_term_months ?? null,
      lender_code: lenderCode,
      status: "SUBMITTED",
      submitted_payload: submittedPayload,
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  // FIX #5: Check loan HITL threshold — if enabled and amount >= threshold,
  // hold application for human approval instead of auto-submitting to lender.
  const hitlEnabled = (await getSetting(supabase, "loan_hitl_enabled")) === "true";
  const hitlThreshold = parseFloat(await getSetting(supabase, "loan_hitl_threshold", "0"));
  const needsHitl = hitlEnabled && hitlThreshold > 0 && body.requested_amount >= hitlThreshold;

  if (needsHitl) {
    // Insert into approval_requests so HQ can review before lender submission.
    await supabase.from("approval_requests").insert({
      request_type: "LOAN_SUBMIT",
      trigger_source: "lender-bridge",
      related_entity_id: application.id,
      related_entity_type: "financing_application",
      request_payload: {
        franchisee_id: franchiseeId,
        outlet_id: body.outlet_id ?? null,
        purpose,
        requested_amount: body.requested_amount,
        currency: body.currency || "SGD",
        requested_term_months: body.requested_term_months ?? null,
        lender_code: lenderCode,
      },
      reasoning: `Loan amount S$${body.requested_amount.toLocaleString()} exceeds HITL threshold S$${hitlThreshold.toLocaleString()}`,
      priority: body.requested_amount >= hitlThreshold * 2 ? "HIGH" : "MEDIUM",
      approver_role: "HQ_ADMIN",
      outlet_id: body.outlet_id ?? null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h default
    });

    return {
      status: 202,
      body: {
        success: true,
        application_id: application.id,
        status: "PENDING_HUMAN_APPROVAL",
        message: `Loan amount exceeds threshold. Pending HQ approval before submission to lender.`,
      },
    };
  }

  const lenderConfig = await getLenderConfig(supabase, lenderCode);
  let lenderResult;
  try {
    lenderResult = await callLender("submit", lenderConfig, submittedPayload);
  } catch (err: any) {
    // Application stays recorded even if the lender call fails — status
    // reflects that a human/ops needs to retry, rather than losing the request.
    await supabase
      .from("financing_applications")
      .update({ status: "SUBMITTED", last_lender_response: { error: err.message } })
      .eq("id", application.id);
    return {
      status: 502,
      body: { success: false, error: "Lender submission failed", application_id: application.id, details: err.message },
    };
  }

  const newStatus = lenderResult.data.status || "UNDER_REVIEW";
  await supabase
    .from("financing_applications")
    .update({
      status: newStatus,
      lender_reference_id: lenderResult.data.lender_reference_id ?? null,
      last_lender_response: lenderResult.data,
    })
    .eq("id", application.id);

  return {
    status: 200,
    body: {
      success: true,
      application_id: application.id,
      status: newStatus,
      lender_reference_id: lenderResult.data.lender_reference_id ?? null,
      simulated: lenderResult.simulated,
    },
  };
}

async function handleStatus(supabase: any, auth: { userId: string; role: string }, body: StatusBody) {
  const { data: application, error } = await supabase
    .from("financing_applications")
    .select("*")
    .eq("id", body.application_id)
    .maybeSingle();

  if (error) throw error;
  if (!application) return { status: 404, body: { success: false, error: "Application not found" } };
  if (
    application.franchisee_id !== auth.userId &&
    auth.role !== "HQ_ADMIN" &&
    auth.role !== "REGIONAL_MANAGER"
  ) {
    return { status: 403, body: { success: false, error: "Not authorized to view this application" } };
  }
  return { status: 200, body: { success: true, application } };
}

async function handleCancel(supabase: any, auth: { userId: string; role: string }, body: CancelBody) {
  const { data: application, error: fetchError } = await supabase
    .from("financing_applications")
    .select("id, franchisee_id, status")
    .eq("id", body.application_id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!application) return { status: 404, body: { success: false, error: "Application not found" } };
  if (application.franchisee_id !== auth.userId && auth.role !== "HQ_ADMIN") {
    return { status: 403, body: { success: false, error: "Not authorized to cancel this application" } };
  }
  if (["DISBURSED", "REPAYING", "CLOSED"].includes(application.status)) {
    return { status: 409, body: { success: false, error: `Cannot cancel an application in status ${application.status}` } };
  }

  const { error } = await supabase
    .from("financing_applications")
    .update({ status: "CANCELLED", decided_at: new Date().toISOString() })
    .eq("id", application.id);
  if (error) throw error;

  return { status: 200, body: { success: true, application_id: application.id, status: "CANCELLED" } };
}

/**
 * Inbound webhook from the lender — approvals, declines, disbursement
 * confirmations. Every payload is stored in lender_webhook_events first
 * (audit trail + idempotency via lender_code+event_id), then applied to the
 * matching financing_applications row.
 */
async function handleLenderWebhook(req: Request, supabase: any) {
  const payload = await req.json().catch(() => ({}));
  const lenderCode = payload.lender_code || "GENERIC";
  const eventId = payload.event_id || null;
  const applicationRef = payload.application_id || payload.lender_reference_id;

  // Idempotency: use eventId if present, otherwise composite hash of key fields
  const dedupKey = eventId 
    || (payload.application_id || '') + '|' + (payload.lender_reference_id || '') + '|' + (payload.status || '') + '|' + (payload.event_type || '');
  
  if (dedupKey !== '|||') {
    const { data: existing } = await supabase
      .from("lender_webhook_events")
      .select("id")
      .eq("lender_code", lenderCode)
      .eq("dedup_key", dedupKey)
      .maybeSingle();
    if (existing) {
      return { status: 200, body: { success: true, deduped: true } };
    }
    // Store dedup_key for future checks
    payload._dedup_key = dedupKey;
  }

  let application: any = null;
  if (applicationRef) {
    const { data } = await supabase
      .from("financing_applications")
      .select("*")
      .or(`id.eq.${applicationRef}`)
      .maybeSingle();
    if (!data) {
      const { data: byLenderRef } = await supabase
        .from("financing_applications")
        .select("*")
        .eq("lender_reference_id", applicationRef)
        .maybeSingle();
      application = byLenderRef;
    } else {
      application = data;
    }
  }

  const { data: eventRow, error: eventError } = await supabase
    .from("lender_webhook_events")
    .insert({
      application_id: application?.id ?? null,
      lender_code: lenderCode,
      event_id: eventId,
      event_type: payload.event_type || "status_update",
      dedup_key: (payload as any)._dedup_key ?? null,
      payload,
    })
    .select()
    .single();

  if (eventError) throw eventError;

  if (!application) {
    await supabase
      .from("lender_webhook_events")
      .update({ processing_error: "No matching financing_applications row found" })
      .eq("id", eventRow.id);
    return { status: 202, body: { success: true, matched: false, note: "Event stored, no matching application" } };
  }

  const update: Record<string, any> = { last_lender_response: payload };
  if (payload.status) update.status = payload.status;
  if (payload.approved_amount !== undefined) update.approved_amount = payload.approved_amount;
  if (payload.interest_rate_bps !== undefined) update.interest_rate_bps = payload.interest_rate_bps;
  if (payload.disbursed_amount !== undefined) update.disbursed_amount = payload.disbursed_amount;
  if (payload.status === "DISBURSED") update.disbursed_at = new Date().toISOString();
  
  // FIX 1.5: Set decided_at for APPROVED, DECLINED, or APPLICATION_DECLINED
  if (["APPROVED", "DECLINED", "APPLICATION_DECLINED"].includes(payload.status)) {
    update.decided_at = new Date().toISOString();
  }
  if (payload.decision_reason) update.decision_reason = payload.decision_reason;

  await supabase.from("financing_applications").update(update).eq("id", application.id);
  await supabase.from("lender_webhook_events").update({ processed: true }).eq("id", eventRow.id);

  // Notify the franchisee via the existing notification pipeline so status
  // changes (e.g. APPROVED) reach them without polling.
  try {
    await supabase.functions.invoke("notification-send", {
      body: {
        user_id: application.franchisee_id,
        title: `Financing application ${payload.status || "updated"}`,
        message: `Your bridge-loan application (${application.id}) is now ${payload.status || "updated"}.`,
        channel: "ALL",
      },
    });
  } catch (_e) {
    // Non-fatal — the status change is already persisted.
  }

  return { status: 200, body: { success: true, matched: true, application_id: application.id, status: update.status || application.status } };
}

// =============================================================================
// REPAYMENT EVENT HANDLING
// =============================================================================

/**
 * Handle repayment-specific webhooks from lenders.
 * These include EMI payments, delinquency, overdue notices, etc.
 */
async function handleRepaymentWebhook(req: Request, supabase: any) {
  const payload = await req.json();
  const lenderCode = payload.lender_code || 'GENERIC';
  const eventId = payload.event_id || null;
  const eventType = (payload.event_type || 'STATUS_CHANGE') as RepaymentEventType;
  const webhookType = new URL(req.url).searchParams.get('type');

  // Validate event type
  const validTypes = Object.values(REPAYMENT_EVENT_TYPES);
  if (!validTypes.includes(eventType)) {
    return { status: 400, body: { success: false, error: `Invalid event_type: ${eventType}` } };
  }

  // FIX 1.3: Validate amount if provided
  if (payload.amount !== undefined && payload.amount !== null) {
    if (typeof payload.amount !== 'number' || payload.amount <= 0) {
      return { 
        status: 400, 
        body: { success: false, error: 'amount must be a positive number' } 
      };
    }
    // Validate currency if provided
    const validCurrencies = ['SGD', 'MYR', 'IDR', 'USD'];
    if (payload.currency && !validCurrencies.includes(payload.currency)) {
      return { 
        status: 400, 
        body: { success: false, error: `Invalid currency: ${payload.currency}. Must be one of: ${validCurrencies.join(', ')}` } 
      };
    }
  }
  
  // FIX 1.3: Validate days_overdue if provided
  if (payload.days_overdue !== undefined && payload.days_overdue < 0) {
    return { 
      status: 400, 
      body: { success: false, error: 'days_overdue cannot be negative' } 
    };
  }

  // 1. Idempotency check on repayment_events
  // Use eventId if present, otherwise composite hash of key fields
  const dedupKey = eventId
    || (payload.application_id || '') + '|' + (payload.lender_reference_id || '') + '|' + (payload.event_type || '') + '|' + (payload.amount || '') + '|' + (payload.emi_number || '');

  if (dedupKey !== '|||||') {
    const { data: existing } = await supabase
      .from('repayment_events')
      .select('id')
      .eq('lender_code', lenderCode)
      .eq('dedup_key', dedupKey)
      .maybeSingle();
    if (existing) {
      return { status: 200, body: { success: true, deduped: true } };
    }
    // Store dedup_key for future checks
    payload._dedup_key = dedupKey;
  }

  // 2. Find application
  const applicationRef = payload.application_id || payload.lender_reference_id;
  let application: any = null;
  if (applicationRef) {
    const { data } = await supabase
      .from('financing_applications')
      .select('*')
      .eq('id', applicationRef)
      .maybeSingle();
    if (!data) {
      const { data: byLenderRef } = await supabase
        .from('financing_applications')
        .select('*')
        .eq('lender_reference_id', applicationRef)
        .maybeSingle();
      application = byLenderRef;
    } else {
      application = data;
    }
  }

  // 3. Store raw repayment event
  const { data: eventRow, error: eventError } = await supabase
    .from('repayment_events')
    .insert({
      application_id: application?.id ?? null,
      lender_code: lenderCode,
      event_id: eventId,
      event_type: eventType,
      event_subtype: payload.event_subtype || null,
      amount: payload.amount || null,
      currency: payload.currency || 'SGD',
      payment_reference: payload.payment_reference || null,
      emi_number: payload.emi_number || null,
      scheduled_date: payload.scheduled_date || null,
      days_overdue: payload.days_overdue || 0,
      delinquency_level: payload.delinquency_level || 'NONE',
      dedup_key: (payload as any)._dedup_key ?? null,
      raw_payload: payload,
      source: 'LENDER_WEBHOOK',
      processed: false,
    })
    .select()
    .single();

  if (eventError) {
    console.error('Failed to store repayment event:', eventError);
    throw eventError;
  }

  // 4. Process event if application found
  if (application) {
    await processRepaymentEvent(supabase, application, payload, eventType);
  }

  // 5. Mark as processed
  await supabase
    .from('repayment_events')
    .update({ processed: true })
    .eq('id', eventRow.id);

  return {
    status: 200,
    body: {
      success: true,
      event_id: eventRow.id,
      application_id: application?.id,
      matched: !!application
    }
  };
}

/**
 * Process a repayment event and update related records.
 */
async function processRepaymentEvent(
  supabase: any,
  application: any,
  payload: any,
  eventType: RepaymentEventType
) {
  const updates: Record<string, any> = { last_lender_response: payload };

  // Update application status based on event type
  switch (eventType) {
    case REPAYMENT_EVENT_TYPES.DISBURSEMENT_COMPLETED:
      updates.status = 'REPAYING';
      updates.disbursed_at = payload.disbursed_at || new Date().toISOString();
      updates.disbursed_amount = payload.disbursed_amount || application.approved_amount;
      break;

    case REPAYMENT_EVENT_TYPES.EMI_PAID:
    case REPAYMENT_EVENT_TYPES.PARTIAL_PAYMENT:
      updates.status = 'REPAYING';
      await updateRepaymentSchedule(supabase, application.id, payload, eventType);
      break;

    case REPAYMENT_EVENT_TYPES.EMI_OVERDUE:
    case REPAYMENT_EVENT_TYPES.DELINQUENCY_STARTED:
      updates.status = 'REPAYING'; // Still repaying but delinquent
      await updateRepaymentSchedule(supabase, application.id, payload, eventType);
      break;

    case REPAYMENT_EVENT_TYPES.FULL_REPAYMENT:
    case REPAYMENT_EVENT_TYPES.EARLY_REPAYMENT:
      updates.status = 'CLOSED';
      updates.closed_at = new Date().toISOString();
      break;

    case REPAYMENT_EVENT_TYPES.STATUS_CHANGE:
      if (payload.status) updates.status = payload.status;
      break;
  }

  // Apply updates
  await supabase
    .from('financing_applications')
    .update(updates)
    .eq('id', application.id);

  // Trigger downstream actions
  await triggerDownstreamActions(supabase, application, eventType, payload);
}

/**
 * Update repayment schedule based on payment event.
 */
async function updateRepaymentSchedule(
  supabase: any,
  applicationId: string,
  payload: any,
  eventType: RepaymentEventType
) {
  const emiNumber = payload.emi_number;
  if (!emiNumber) return;

  // Check if schedule entry exists
  const { data: existing } = await supabase
    .from('repayment_schedule')
    .select('*')
    .eq('application_id', applicationId)
    .eq('emi_number', emiNumber)
    .maybeSingle();

  if (existing) {
    // Update existing entry
    const scheduleUpdate: Record<string, any> = { updated_at: new Date().toISOString() };

    if (eventType === REPAYMENT_EVENT_TYPES.EMI_PAID) {
      scheduleUpdate.status = 'PAID';
      scheduleUpdate.paid_amount = payload.amount || existing.total_amount;
      scheduleUpdate.paid_at = payload.paid_at || new Date().toISOString();
      scheduleUpdate.payment_reference = payload.payment_reference || null;
    } else if (eventType === REPAYMENT_EVENT_TYPES.PARTIAL_PAYMENT) {
      scheduleUpdate.status = 'PARTIAL';
      scheduleUpdate.paid_amount = (existing.paid_amount || 0) + (payload.amount || 0);
      scheduleUpdate.payment_reference = payload.payment_reference || null;
    } else if (eventType === REPAYMENT_EVENT_TYPES.EMI_OVERDUE || eventType === REPAYMENT_EVENT_TYPES.DELINQUENCY_STARTED) {
      scheduleUpdate.status = 'OVERDUE';
      scheduleUpdate.days_overdue = payload.days_overdue || 1;
    }

    await supabase
      .from('repayment_schedule')
      .update(scheduleUpdate)
      .eq('id', existing.id);
  }
}

/**
 * Trigger downstream actions (risk scoring, alerts, notifications).
 */
async function triggerDownstreamActions(
  supabase: any,
  application: any,
  eventType: RepaymentEventType,
  payload: any
) {
  const actions: Promise<any>[] = [];

  // 1. Recalculate risk score
  actions.push(
    supabase.functions.invoke('repayment-risk-scorer', {
      body: { application_id: application.id }
    }).catch(e => console.error('Risk scorer error:', e))
  );

  // 2. Create alert for risk events
  const riskEventTypes = [
    REPAYMENT_EVENT_TYPES.EMI_OVERDUE,
    REPAYMENT_EVENT_TYPES.DELINQUENCY_STARTED,
    REPAYMENT_EVENT_TYPES.DEFAULT_NOTICE
  ];

  if (riskEventTypes.includes(eventType)) {
    actions.push(
      supabase.functions.invoke('repayment-alert-generator', {
        body: {
          application_id: application.id,
          franchisee_id: application.franchisee_id,
          outlet_id: application.outlet_id,
          event_type: eventType,
          severity: getSeverity(eventType, payload),
          message: getAlertMessage(eventType, payload),
        }
      }).catch(e => console.error('Alert generator error:', e))
    );
  }

  // 3. Notify via existing notification system
  actions.push(
    supabase.functions.invoke('notification-send', {
      body: {
        user_id: application.franchisee_id,
        title: `Payment Update: ${eventType}`,
        message: getNotificationMessage(eventType, payload),
        channel: 'ALL',
        priority: getPriority(eventType),
      }
    }).catch(e => console.error('Notification error:', e))
  );

  // Execute all actions in parallel
  await Promise.allSettled(actions);
}

function getSeverity(eventType: RepaymentEventType, payload: any): string {
  switch (eventType) {
    case REPAYMENT_EVENT_TYPES.DEFAULT_NOTICE: return 'CRITICAL';
    case REPAYMENT_EVENT_TYPES.DELINQUENCY_STARTED: return 'HIGH';
    case REPAYMENT_EVENT_TYPES.EMI_OVERDUE: return 'MEDIUM';
    default: return 'LOW';
  }
}

function getPriority(eventType: RepaymentEventType): string {
  switch (eventType) {
    case REPAYMENT_EVENT_TYPES.DEFAULT_NOTICE:
    case REPAYMENT_EVENT_TYPES.DELINQUENCY_STARTED:
    case REPAYMENT_EVENT_TYPES.EMI_OVERDUE:
      return 'HIGH';
    default: return 'NORMAL';
  }
}

function getAlertMessage(eventType: RepaymentEventType, payload: any): string {
  switch (eventType) {
    case REPAYMENT_EVENT_TYPES.EMI_OVERDUE:
      return `EMI #${payload.emi_number} is ${payload.days_overdue || 1} days overdue. Amount: ${payload.currency || 'SGD'} ${payload.amount || 'N/A'}`;
    case REPAYMENT_EVENT_TYPES.DELINQUENCY_STARTED:
      return `Delinquency started for EMI #${payload.emi_number}. Level: ${payload.delinquency_level || 'MILD'}. Days overdue: ${payload.days_overdue || 0}`;
    case REPAYMENT_EVENT_TYPES.DEFAULT_NOTICE:
      return `Payment default notice issued for application. Immediate attention required.`;
    default:
      return `Payment event: ${eventType}`;
  }
}

function getNotificationMessage(eventType: RepaymentEventType, payload: any): string {
  switch (eventType) {
    case REPAYMENT_EVENT_TYPES.EMI_PAID:
      return `EMI #${payload.emi_number} payment of ${payload.currency || 'SGD'} ${payload.amount} received.`;
    case REPAYMENT_EVENT_TYPES.PARTIAL_PAYMENT:
      return `Partial payment of ${payload.currency || 'SGD'} ${payload.amount} received for EMI #${payload.emi_number}.`;
    case REPAYMENT_EVENT_TYPES.EMI_OVERDUE:
      return `EMI #${payload.emi_number} is overdue by ${payload.days_overdue || 1} days.`;
    case REPAYMENT_EVENT_TYPES.DELINQUENCY_STARTED:
      return `Your account is now in delinquency status. Please contact us immediately.`;
    case REPAYMENT_EVENT_TYPES.FULL_REPAYMENT:
      return `Congratulations! Your financing has been fully repaid.`;
    default:
      return `Payment status update: ${eventType}`;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const isWebhook = url.pathname.endsWith("/webhook");

  try {
    if (isWebhook) {
      // Lender webhooks authenticate via a shared secret header, not a user JWT.
      const secret = req.headers.get("x-lender-webhook-secret");
      const expected = Deno.env.get("LENDER_WEBHOOK_SECRET");
      
      // SECURITY FIX: Fail closed if no secret configured
      if (!expected) {
        console.error('CRITICAL: LENDER_WEBHOOK_SECRET not configured - rejecting webhook');
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Webhook endpoint not configured. Contact administrator." 
        }), {
          status: 503, // Service Unavailable
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // SECURITY FIX: Reject if no secret provided
      if (!secret || secret !== expected) {
        console.error('Lender Webhook: Invalid or missing webhook secret');
        return new Response(JSON.stringify({ success: false, error: "Invalid webhook secret" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if this is a repayment-specific webhook
      const webhookType = url.searchParams.get('type');
      if (webhookType === 'repayment') {
        const result = await handleRepaymentWebhook(req, supabase);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Original lender webhook (approvals, declines, disbursement)
      const result = await handleLenderWebhook(req, supabase);
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "Method not allowed. Use POST." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = await verifyAuth(req, supabaseUrl, serviceKey);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    let result;
    switch (body.action) {
      case "submit_application":
        result = await handleSubmit(req, supabase, auth, body);
        break;
      case "get_status":
        result = await handleStatus(supabase, auth, body);
        break;
      case "cancel_application":
        result = await handleCancel(supabase, auth, body);
        break;
      default:
        result = { status: 400, body: { success: false, error: "action must be one of: submit_application, get_status, cancel_application" } };
    }

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Lender Bridge Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
