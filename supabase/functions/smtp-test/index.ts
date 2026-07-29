/// <reference lib="deno.ns" />

/**
 * SMTP Test Edge Function
 * Tests SendGrid/SMTP email configuration
 *
 * POST /functions/v1/smtp-test
 *
 * Request Body:
 * {
 *   "to_email": "test@example.com",
 *   "subject": "Test Email",
 *   "body": "Test message body"
 * }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmtpTestRequest {
  to_email: string;
  subject?: string;
  body?: string;
}

interface SmtpTestResponse {
  success: boolean;
  provider: string;
  config_status: "configured" | "missing_api_key" | "missing_credentials";
  email_sent?: boolean;
  message_id?: string;
  error?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: SmtpTestRequest = await req.json();

    // Validate email
    if (!body.to_email) {
      return new Response(
        JSON.stringify({ success: false, error: "to_email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check SendGrid configuration
    const sendGridKey = Deno.env.get("SENDGRID_API_KEY");
    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@cyberquote.com";

    if (!sendGridKey) {
      return new Response(
        JSON.stringify({
          success: false,
          provider: "sendgrid",
          config_status: "missing_api_key",
          error: "SENDGRID_API_KEY not configured in Edge Functions secrets"
        } as SmtpTestResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare test email
    const subject = body.subject || "CyberQuote SMTP Test";
    const textBody = body.body || "This is a test email from CyberQuote. If you receive this, your SMTP configuration is working!";
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 20px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">🧪 CyberQuote SMTP Test</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>Hello,</p>
          <p>This is a test email from <strong>CyberQuote</strong>.</p>
          <p>If you receive this email, your SMTP configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Sent at: ${new Date().toISOString()}<br>
            Provider: SendGrid
          </p>
        </div>
      </div>
    `;

    // Send test email via SendGrid
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sendGridKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: body.to_email }] }],
          from: { email: fromEmail, name: "CyberQuote" },
          reply_to: { email: fromEmail, name: "CyberQuote" },
          subject,
          content: [
            { type: "text/plain", value: textBody },
            { type: "text/html", value: htmlBody },
          ],
        }),
      });

      if (response.ok) {
        const messageId = response.headers.get("X-Message-Id") || "unknown";
        console.log(`Test email sent to ${body.to_email}, Message ID: ${messageId}`);

        return new Response(
          JSON.stringify({
            success: true,
            provider: "sendgrid",
            config_status: "configured",
            email_sent: true,
            message_id: messageId,
          } as SmtpTestResponse),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const error = await response.text();
        console.error("SendGrid error:", error);

        return new Response(
          JSON.stringify({
            success: false,
            provider: "sendgrid",
            config_status: "configured",
            email_sent: false,
            error: `SendGrid API error: ${error}`,
          } as SmtpTestResponse),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          provider: "sendgrid",
          config_status: "configured",
          email_sent: false,
          error: `Failed to send: ${error.message}`,
        } as SmtpTestResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("SMTP test error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
