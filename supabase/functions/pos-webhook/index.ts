/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Valid payment methods
const VALID_PAYMENT_METHODS = ['cash', 'card', 'qrcode', 'ewallet', 'gofood', 'grabfood', 'shopeefood', 'dine_in'];
const VALID_PLATFORMS = ['dine_in', 'gofood', 'grabfood', 'shopeefood', 'pos'];

// HMAC secret for POS webhook authentication
const POS_WEBHOOK_SECRET = Deno.env.get('POS_WEBHOOK_SECRET');

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pos-signature",
};

/**
 * Verify HMAC-SHA256 signature for POS webhook
 * Returns true if signature is valid, false otherwise
 */
async function verifyHMAC(req: Request): Promise<boolean> {
  const signature = req.headers.get('x-pos-signature');
  
  // If no secret configured, reject ALL requests (fail closed)
  if (!POS_WEBHOOK_SECRET) {
    console.error('SECURITY: POS_WEBHOOK_SECRET not configured - rejecting all requests');
    return false;
  }
  
  // If no signature provided, reject
  if (!signature) {
    console.error('POS Webhook: Missing x-pos-signature header');
    return false;
  }
  
  // Get raw body for HMAC calculation
  const body = await req.text();
  
  // Calculate expected HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(POS_WEBHOOK_SECRET);
  const messageData = encoder.encode(body);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureArray = new Uint8Array(signatureBuffer);
  const expectedHex = Array.from(signatureArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Timing-safe comparison
  if (signature.length !== expectedHex.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  
  return result === 0;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
// Production: HMAC enforced — no DEV_BYPASS

// ========== HMAC AUTHENTICATION ==========
// SECURITY FIX: Verify HMAC signature for all POST requests
if (req.method === "POST") {
  const hmacValid = await verifyHMAC(req.clone());
  if (!hmacValid) {
    console.error("POS Webhook: HMAC verification failed");
    return new Response(JSON.stringify({
      success: false,
      error: "Unauthorized: Invalid or missing signature"
    }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();

    // ========== VALIDATION ==========
    const errors: string[] = [];

    // Required fields
    if (!body.transaction_id) errors.push("transaction_id is required");
    if (!body.outlet_id) errors.push("outlet_id is required");
    if (!body.date) errors.push("date is required");
    if (body.amount === undefined || body.amount === null) errors.push("amount is required");

    // Type validation
    if (body.outlet_id && (typeof body.outlet_id !== 'number' || body.outlet_id <= 0)) {
      errors.push("outlet_id must be a positive number");
    }
    if (body.amount && (typeof body.amount !== 'number' || body.amount < 0)) {
      errors.push("amount must be a non-negative number");
    }
    if (body.discount && (typeof body.discount !== 'number' || body.discount < 0)) {
      errors.push("discount must be non-negative");
    }
    if (body.tax && (typeof body.tax !== 'number' || body.tax < 0)) {
      errors.push("tax must be non-negative");
    }
    if (body.cost && (typeof body.cost !== 'number' || body.cost < 0)) {
      errors.push("cost must be non-negative");
    }

    // Payment method validation
    if (body.payment_method && !VALID_PAYMENT_METHODS.includes(body.payment_method)) {
      errors.push(`payment_method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
    }

    // Platform validation
    if (body.platform && !VALID_PLATFORMS.includes(body.platform)) {
      errors.push(`platform must be one of: ${VALID_PLATFORMS.join(', ')}`);
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ success: false, errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ========== VERIFY OUTLET EXISTS ==========
    const { data: outlet, error: outletError } = await supabase
      .from("outlets")
      .select("id")
      .eq("id", body.outlet_id)
      .single();

    if (outletError || !outlet) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid outlet_id",
        message: `Outlet ${body.outlet_id} does not exist`
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // ========== DATA TRANSFORMATION ==========
    // Auto-calculate hour and day_of_week if not provided
    const dateObj = new Date(body.date);
    const hour = body.hour ?? dateObj.getHours();
    const day_of_week = body.day_of_week ?? dateObj.getDay();

    // Calculate financial fields
    const discount = body.discount ?? 0;
    const tax = body.tax ?? 0;
    const cost = body.cost ?? 0;
    const platform_fee = body.platform_fee ?? 0;

    // Calculate net_amount: amount - discount + tax
    const net_amount = body.net_amount ?? (body.amount - discount + tax);

    // Calculate settlement_amount: net_amount - platform_fee
    const settlement_amount = body.settlement_amount ?? (net_amount - platform_fee);

    // Calculate profit: net_amount - cost
    const profit = net_amount - cost;

    // ========== BUILD INSERT DATA ==========
    const insertData = {
      transaction_id: body.transaction_id,
      outlet_id: body.outlet_id,
      date: body.date,
      amount: body.amount,
      transaction_count: body.transaction_count ?? 1,
      hour,
      day_of_week,
      payment_method: body.payment_method ?? 'dine_in',
      customer_id: body.customer_id ?? null,
      staff_id: body.staff_id ?? null,
      discount,
      tax,
      cost,
      net_amount,
      platform: body.platform ?? 'dine_in',
      platform_order_id: body.platform_order_id ?? null,
      platform_fee,
      settlement_amount,
    };

    // ========== INSERT ==========
    const { data, error } = await supabase
      .from("sales_transactions")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // Handle duplicate transaction_id
      if (error.code === '23505') {
        return new Response(JSON.stringify({
          success: false,
          error: "Duplicate transaction_id",
          message: `Transaction ${body.transaction_id} already exists`
        }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Transaction recorded",
      data: {
        id: data.id,
        transaction_id: data.transaction_id,
        outlet_id: data.outlet_id,
        date: data.date,
        amount: data.amount,
        payment_method: data.payment_method,
        platform: data.platform,
        discount: data.discount,
        tax: data.tax,
        cost: data.cost,
        net_amount: data.net_amount,
        platform_fee: data.platform_fee,
        settlement_amount: data.settlement_amount,
        profit: data.net_amount - data.cost,
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("POS Webhook Error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: "Internal server error",
      details: err instanceof Error ? err.message : String(err)
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
