/**
 * Send Financing Request
 * Sends financing request to selected financier via email
 * 
 * Triggered by: Frontend (after user selects financier)
 * Input: financing_request_id, financier_id
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "no-reply@cyberquote.com.sg";
    
    const supabase = createClient(supabaseUrl, serviceKey);
    const { request_id, financier_id } = await req.json();

    if (!request_id || !financier_id) {
      return new Response(JSON.stringify({ error: "Missing request_id or financier_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get financing request
    const { data: request, error: reqError } = await supabase
      .from("financing_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (reqError || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get financier
    const { data: financier, error: finError } = await supabase
      .from("financiers")
      .select("*")
      .eq("id", financier_id)
      .single();

    if (finError || !financier) {
      return new Response(JSON.stringify({ error: "Financier not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get outlet info
    const { data: outlet } = await supabase
      .from("outlets")
      .select("name, code")
      .eq("id", request.outlet_id)
      .single();

    // Build email content
    const emailSubject = `[CyberQuote] Financing Request - ${outlet?.name || request.outlet_id}`;
    const emailBody = buildEmailBody(request, financier, outlet);

    let emailSent = false;
    let emailError = null;

    // Send email via SendGrid if configured
    if (sendgridKey) {
      try {
        const sendgridRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sendgridKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: financier.contact_email }],
              subject: emailSubject,
            }],
            from: { email: fromEmail, name: "CyberQuote AI" },
            content: [{ type: "text/html", value: emailBody }],
          }),
        });

        if (sendgridRes.ok) {
          emailSent = true;
        } else {
          emailError = `SendGrid error: ${sendgridRes.status}`;
        }
      } catch (e) {
        emailError = `SendGrid exception: ${e.message}`;
      }
    } else {
      emailError = "no_provider_configured";
    }

    // Update request status
    await supabase
      .from("financing_requests")
      .update({
        status: "sent_to_financier",
        lender_code: financier.market,
        last_lender_response: emailError || "email_sent",
      })
      .eq("id", request_id);

    // Audit log
    await supabase.from("audit_log").insert({
      action: "financing_request_sent",
      entity_type: "financing_request",
      entity_id: request_id,
      user_id: "system",
      metadata: {
        financier_id,
        financier_name: financier.name,
        email_sent: emailSent,
        error: emailError,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: emailSent ? "Request sent successfully" : "Request logged (email not configured)",
      email_sent: emailSent,
      financier: financier.name,
      financier_email: financier.contact_email,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Send financing request error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEmailBody(request: any, financier: any, outlet: any) {
  const requestedAmount = new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: request.currency || "SGD",
  }).format(request.requested_amount);

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; color: #666; }
    .footer { padding: 15px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CyberQuote AI - Financing Request</h1>
    </div>
    <div class="content">
      <h2>New Financing Application</h2>
      <p>Dear ${financier.contact_name || financier.name},</p>
      <p>A new financing request has been submitted through the CyberQuote AI platform:</p>
      
      <div class="field">
        <span class="label">Outlet:</span> ${outlet?.name || request.outlet_id} (${outlet?.code || "N/A"})
      </div>
      <div class="field">
        <span class="label">Requested Amount:</span> ${requestedAmount}
      </div>
      <div class="field">
        <span class="label">Purpose:</span> ${request.purpose || "Business expansion"}
      </div>
      <div class="field">
        <span class="label">Requested Term:</span> ${request.requested_term_months || 24} months
      </div>
      <div class="field">
        <span class="label">Submission Date:</span> ${new Date().toLocaleDateString("en-SG")}
      </div>
      
      <p>Please log in to the CyberQuote platform to review this application and provide your decision.</p>
      
      <p>Best regards,<br>CyberQuote AI System</p>
    </div>
    <div class="footer">
      <p>This is an automated message from CyberQuote AI Franchise Platform.</p>
      <p>© 2026 CyberQuote. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
