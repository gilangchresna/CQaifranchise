/**
 * CyberQuote Webhook Ingestion Edge Function
 * Handles POS/sales data ingestion from external systems with HMAC-SHA256 validation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WebhookPayload, WebhookResponse, validateWebhookPayload, parseItemsToJSON } from "../_shared/types.ts";

const WEBHOOK_SECRET_HEADER = "x-signature-256";
const DEFAULT_HMAC_SECRET = Deno.env.get("WEBHOOK_HMAC_SECRET") || "whsec_default_dev_secret_change_in_production";

async function verifyHmacSignature(payload: Uint8Array, signature: string, secret: string): Promise<boolean> {
  if (!signature) {
    return false;
  }

  let receivedDigest = signature;
  if (signature.startsWith("sha256=")) {
    receivedDigest = signature.slice(7);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, payload);
  const expectedDigest = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (receivedDigest.length !== expectedDigest.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < receivedDigest.length; i++) {
    result |= receivedDigest.charCodeAt(i) ^ expectedDigest.charCodeAt(i);
  }

  return result === 0;
}

async function checkIdempotency(supabase: any, transactionId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("sales_transactions")
    .select("id")
    .eq("transaction_id", transactionId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data?.id || null;
}

async function validateOutletExists(supabase: any, outletId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from("outlets")
    .select("id")
    .eq("id", outletId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return !!data;
}

async function insertTransaction(
  supabase: any,
  payload: WebhookPayload
): Promise<number> {
  const transactionCount = payload.items?.length || 1;
  const itemsJson = parseItemsToJSON(payload.items || []);
  const metadata = itemsJson ? { items: JSON.parse(itemsJson) } : undefined;
  const date = new Date(payload.timestamp);

  // Convert to Singapore Time (SGT/UTC+8)
  const sgDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
  const dateStr = sgDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("sales_transactions")
    .insert({
      transaction_id: payload.transaction_id.trim(),
      outlet_id: payload.outlet_id,
      date: dateStr,
      amount: payload.amount,
      transaction_count: transactionCount,
      metadata: metadata,
      is_anomaly: false,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const signature = req.headers.get(WEBHOOK_SECRET_HEADER);
  if (!signature) {
    return new Response(
      JSON.stringify({ error: "Missing signature header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.arrayBuffer();
  const bodyBytes = new Uint8Array(body);

  const isValid = await verifyHmacSignature(bodyBytes, signature, DEFAULT_HMAC_SECRET);
  if (!isValid) {
    return new Response(
      JSON.stringify({ error: "Invalid webhook signature" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(body)) as WebhookPayload;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const validation = validateWebhookPayload(payload);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        messages: validation.errors,
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const existingId = await checkIdempotency(supabase, payload.transaction_id.trim());
    if (existingId) {
      const response: WebhookResponse = {
        status: "ok",
        message: "Transaction already exists",
        transaction_id: existingId,
        is_duplicate: true,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const outletExists = await validateOutletExists(supabase, payload.outlet_id);
    if (!outletExists) {
      return new Response(
        JSON.stringify({
          error: "Outlet not found",
          message: `Outlet with id ${payload.outlet_id} not found`,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const transactionId = await insertTransaction(supabase, payload);

    const response: WebhookResponse = {
      status: "created",
      message: "Transaction ingested successfully",
      transaction_id: transactionId,
      is_duplicate: false,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);

    if (error.code === "23505") {
      const response: WebhookResponse = {
        status: "ok",
        message: "Transaction already exists (concurrent request)",
        is_duplicate: true,
      };
      return new Response(JSON.stringify(response), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message || "An unexpected error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
