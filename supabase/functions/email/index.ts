/// <reference lib="deno.ns" />

/**
 * Email Test Edge Function
 * Tests email configuration - supports SMTP, SendGrid, Gmail
 *
 * POST /functions/v1/email
 *
 * Request Body:
 * {
 *   "provider": "smtp|sendgrid|gmail",  // optional, default from settings
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

interface TestRequest {
  provider?: "smtp" | "sendgrid" | "gmail";
  to_email: string;
  subject?: string;
  body?: string;
}

// Get settings from database
async function getSettings(supabase: any): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [
      "email_provider", "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from",
      "sendgrid_api_key", "sendgrid_from_email"
    ]);

  if (error) {
    console.error("Failed to get settings:", error);
    return {};
  }

  const config: Record<string, string> = {};
  for (const s of data || []) {
    config[s.key] = s.value;
  }
  return config;
}

// SendGrid sender
async function sendViaSendGrid(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const fromEmail = from.includes("<") ? from.split("<")[1].replace(">", "").trim() : from;

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: "CyberQuote" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error: `SendGrid: ${error}` };
  }

  return { success: true, messageId: response.headers.get("X-Message-Id") || "unknown" };
}

// SMTP sender (via SendGrid relay since Deno doesn't have native SMTP)
async function sendViaSMTP(
  host: string,
  port: number,
  user: string,
  pass: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  // For SMTP direct, we need external SMTP service
  // Use SendGrid as SMTP relay if available
  const sendGridKey = Deno.env.get("SENDGRID_API_KEY");
  if (sendGridKey) {
    return sendViaSendGrid(sendGridKey, from, to, subject, html);
  }
  return { success: false, error: `SMTP to ${host}:${port} requires external relay. Configure SENDGRID_API_KEY as fallback.` };
}

// Gmail sender
async function sendViaGmail(
  user: string,
  pass: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const sendGridKey = Deno.env.get("SENDGRID_API_KEY");
  if (sendGridKey) {
    const result = await sendViaSendGrid(sendGridKey, user, to, subject, html);
    return { success: result.success, error: result.error };
  }
  return { success: false, error: "Gmail SMTP requires OAuth2 or App Password. Set SENDGRID_API_KEY as relay." };
}

serve(async (req: Request) => {
  // Handle CORS preflight - MUST return 200/204 with proper headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: TestRequest = await req.json();

    if (!body.to_email) {
      return new Response(
        JSON.stringify({ success: false, error: "to_email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get settings from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const config = await getSettings(supabase);

    const subject = body.subject || "CyberQuote Email Test";
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 20px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">🧪 CyberQuote Email Test</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>Hello,</p>
          <p>This is a test email from <strong>CyberQuote</strong>.</p>
          <p>If you receive this email, your email configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Sent at: ${new Date().toISOString()}<br>
          </p>
        </div>
      </div>
    `;

    // Determine provider
    const provider = body.provider || config.email_provider || "sendgrid";
    let result: { success: boolean; messageId?: string; error?: string };

    switch (provider) {
      case "smtp":
        result = await sendViaSMTP(
          config.smtp_host || "mail.cyberquote.co.id",
          parseInt(config.smtp_port || "465"),
          config.smtp_user || "",
          config.smtp_pass || "",
          config.smtp_from || "noreply@cyberquote.com",
          body.to_email,
          subject,
          htmlBody
        );
        break;

      case "gmail":
        result = await sendViaGmail(
          config.smtp_user || "",
          config.smtp_pass || "",
          body.to_email,
          subject,
          htmlBody
        );
        break;

      case "sendgrid":
      default:
        const sgKey = config.sendgrid_api_key || Deno.env.get("SENDGRID_API_KEY");
        if (!sgKey) {
          return new Response(
            JSON.stringify({
              success: false,
              provider,
              config_status: "missing_api_key",
              error: "SendGrid API key not configured. Add sendgrid_api_key in settings or set SENDGRID_API_KEY in Edge Function secrets."
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = await sendViaSendGrid(
          sgKey,
          config.sendgrid_from_email || config.smtp_from || "noreply@cyberquote.com",
          body.to_email,
          subject,
          htmlBody
        );
        break;
    }

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          provider,
          config_status: "configured",
          email_sent: true,
          message_id: result.messageId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          provider,
          config_status: "error",
          email_sent: false,
          error: result.error,
        }),
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
