/// <reference lib="deno.ns" />

/**
 * Lender Bridge Edge Function
 * Generic bridge-loan financing integration for franchisee setup.
 *
 * Why this exists: franchisee onboarding (see public.pilot_outreach:
 * contacted_at -> demo_scheduled_at -> agreement_signed_at ->
 * onboarding_completed_at) has a capital gap between signing the franchise
 * agreement and opening the outlet — fit-out, opening inventory, staffing.
 * This function is the integration point that lets that gap be funded by an
 * external lender's bridge-loan product, without hard-coding any one
 * lender's API. It follows the same "connector + adapter" pattern already
 * used for POS systems in pos-connector/index.ts.
 *
 * POST /functions/v1/lender-bridge
 *   action: "submit_application" | "get_status" | "cancel_application"
 *
 * POST /functions/v1/lender-bridge/webhook   (see handleLenderWebhook below;
 *   deployed as the same function — action is inferred from the URL path so
 *   this can be registered directly as the lender's webhook callback URL)
 *
 * Lender configuration (base_url, api_key, auth style) is read from
 * public.integrations where type = 'LENDER' and name = lender_code, so a
 * real lender can be plugged in later purely via config (Integrations UI),
 * with no code change. Until a lender is configured, requests run in
 * "simulate" mode so the flow can be demoed and the app UI built against it
 * today — mirroring how pos-connector simulates POS systems.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function handleSubmit(req: Request, supabase: any, auth: { userId: string; role: string }, body: SubmitApplicationBody) {
  if (!body.requested_amount || body.requested_amount <= 0) {
    return { status: 400, body: { success: false, error: "requested_amount must be a positive number" } };
  }
  const purpose = body.purpose && VALID_PURPOSES.includes(body.purpose) ? body.purpose : "FRANCHISEE_SETUP";
  const lenderCode = body.lender_code || "GENERIC";

  // Franchisees may only submit for themselves; HQ/Regional may submit on
  // behalf of a franchisee during onboarding.
  const franchiseeId =
    auth.role === "HQ_ADMIN" || auth.role === "REGIONAL_MANAGER"
      ? body.franchisee_id || auth.userId
      : auth.userId;

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

  // Idempotency: if we've already recorded this exact lender event, no-op.
  if (eventId) {
    const { data: existing } = await supabase
      .from("lender_webhook_events")
      .select("id")
      .eq("lender_code", lenderCode)
      .eq("event_id", eventId)
      .maybeSingle();
    if (existing) {
      return { status: 200, body: { success: true, deduped: true } };
    }
  }

  let application: any = null;
  if (applicationRef) {
    const { data } = await supabase
      .from("financing_applications")
      .select("*")
      .or(`id.eq.${applicationRef},lender_reference_id.eq.${applicationRef}`)
      .maybeSingle();
    application = data;
  }

  const { data: eventRow, error: eventError } = await supabase
    .from("lender_webhook_events")
    .insert({
      application_id: application?.id ?? null,
      lender_code: lenderCode,
      event_id: eventId,
      event_type: payload.event_type || "status_update",
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
  if (["APPROVED", "DECLINED"].includes(payload.status)) update.decided_at = new Date().toISOString();
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
      if (expected && secret !== expected) {
        return new Response(JSON.stringify({ success: false, error: "Invalid webhook secret" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
