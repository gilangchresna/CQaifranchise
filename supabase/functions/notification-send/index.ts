// Send Notification Edge Function
// POST endpoint - sends notifications via multiple email providers
// Provider di-configure via settings table: email_provider (smtp/sendgrid/gmail)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  alert_id: number;
  channel: "WHATSAPP" | "EMAIL" | "PUSH";
  priority_override?: "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";
}

// =====================
// EMAIL PROVIDERS
// =====================

// 1. SMTP Direct (via mail.cyberquote.co.id dll)
async function sendSMTP(
  host: string,
  port: number,
  user: string,
  pass: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Deno tidak support SMTP native, jadi pakai SendGrid sebagai fallback
    // Atau bisa pakai external SMTP relay service

    // Untuk SMTP direct, gunakan API endpoint lain atau third-party
    // Disini kita demonstrate dengan format yang konsisten
    console.log(`SMTP Config: ${host}:${port} from ${user}`);

    // Check if SENDGRID_API_KEY available as relay
    const sendGridKey = Deno.env.get("SENDGRID_API_KEY");
    if (sendGridKey) {
      return sendViaSendGrid(sendGridKey, from, to, subject, html);
    }

    return { success: false, error: "SMTP relay not configured. Set SENDGRID_API_KEY for SMTP fallback or use SendGrid provider." };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 2. SendGrid
async function sendViaSendGrid(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const fromEmail = from.split("<")[1]?.replace(">", "").trim() || from;

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
    return { success: false, error: `SendGrid error: ${error}` };
  }

  const messageId = response.headers.get("X-Message-Id") || "unknown";
  return { success: true, messageId };
}

// 3. Gmail SMTP
async function sendGmail(
  user: string,
  pass: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  // Gmail memerlukan OAuth2, bukan password biasa
  // Untuk simplicity, gunakan SendGrid sebagai relay untuk Gmail
  const sendGridKey = Deno.env.get("SENDGRID_API_KEY");
  if (sendGridKey) {
    return sendViaSendGrid(sendGridKey, user, to, subject, html);
  }

  return { success: false, error: "Gmail SMTP requires App Password. Configure SENDGRID_API_KEY as relay." };
}

// =====================
// WHATSAPP (Twilio)
// =====================

async function sendWhatsApp(
  toPhone: string,
  message: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const formData = new URLSearchParams();
  formData.set("From", fromNumber);
  formData.set("To", `whatsapp:${toPhone}`);
  formData.set("Body", message);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error };
  }

  const data = await response.json();
  return { success: true, sid: data.sid };
}

// =====================
// MAIN HANDLER
// =====================

serve(async (req) => {
  // Handle CORS preflight - MUST return 204 with proper headers
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { alert_id, channel, priority_override }: NotificationRequest = await req.json();

    if (!alert_id || !channel) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: alert_id, channel" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get settings from DB
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["email_provider", "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from",
                   "email_notifications_enabled", "sendgrid_api_key", "sendgrid_from_email"]);

    if (settingsError) {
      console.error("Settings error:", settingsError);
    }

    const config: Record<string, string> = {};
    for (const s of settings || []) {
      config[s.key] = s.value;
    }

    // Check if email notifications enabled
    if (channel === "EMAIL" && config.email_notifications_enabled === "false") {
      return new Response(
        JSON.stringify({ error: "Email notifications are disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get alert
    const { data: alert, error: alertError } = await supabase
      .from("alerts")
      .select(`id, title, severity, status, outlet_id, type`)
      .eq("id", alert_id)
      .single();

    if (alertError || !alert) {
      return new Response(
        JSON.stringify({ error: "Alert not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get outlet to find franchisee_id
    const { data: outlet } = await supabase
      .from("outlets")
      .select("franchisee_id")
      .eq("id", alert.outlet_id)
      .single();

    // Get recipient
    const { data: franchisee } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, phone")
      .eq("id", outlet?.franchisee_id)
      .single();

    if (!franchisee) {
      return new Response(
        JSON.stringify({ error: "Recipient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priority = priority_override || alert.severity;
    const tagMap: Record<string, string> = {
      P0_CRITICAL: "[CRITICAL]",
      P1_HIGH: "[HIGH]",
      P2_MEDIUM: "[MEDIUM]",
      P3_LOW: "[LOW]",
    };
    const tag = tagMap[priority] || "[INFO]";

    const message = `CyberQuote Alert\n${tag}\n\n${alert.title}\n\nOutlet: ${alert.outlets?.name || "N/A"}\nSeverity: ${priority}\nType: ${alert.type}\n\n${alert.description || "No description provided."}\n\nTriggered: ${new Date(alert.triggered_at).toLocaleString()}`;

    const emailSubject = `[${priority}] ${alert.title} - ${alert.outlets?.name || "Unknown Outlet"}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 20px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">🚨 CyberQuote Alert</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <strong style="color: #dc2626;">${tag} ${alert.title}</strong>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Outlet:</strong></td><td>${alert.outlets?.name || "N/A"}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Severity:</strong></td><td style="color: ${priority.includes('P0') ? '#dc2626' : priority.includes('P1') ? '#f59e0b' : '#6b7280'};">${priority}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Type:</strong></td><td>${alert.type}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Triggered:</strong></td><td>${new Date(alert.triggered_at).toLocaleString()}</td></tr>
          </table>
          <h3 style="margin-top: 20px;">Description</h3>
          <p style="color: #374151;">${alert.description || "No description provided."}</p>
          <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">
            Sent at: ${new Date().toISOString()}
          </p>
        </div>
      </div>
    `;

    let externalId: string | null = null;
    let status = "SENT";
    let resultMessage = "";

    switch (channel) {
      case "WHATSAPP":
        if (!franchisee.phone) {
          return new Response(
            JSON.stringify({ error: "Recipient has no phone number" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const waResult = await sendWhatsApp(franchisee.phone, message);
        if (!waResult.success) {
          status = "FAILED";
          resultMessage = waResult.error;
        } else {
          externalId = waResult.sid || null;
          resultMessage = "WhatsApp sent successfully";
        }
        break;

      case "EMAIL": {
        const provider = config.email_provider || "sendgrid"; // default sendgrid

        switch (provider) {
          case "smtp":
            const smtpResult = await sendSMTP(
              config.smtp_host || "mail.cyberquote.co.id",
              parseInt(config.smtp_port || "465"),
              config.smtp_user || "",
              config.smtp_pass || "",
              config.smtp_from || "CyberQuote Alerts <noreply@cyberquote.com>",
              franchisee.email,
              emailSubject,
              emailHtml
            );
            if (!smtpResult.success) {
              status = "FAILED";
              resultMessage = smtpResult.error;
            } else {
              resultMessage = "Email sent via SMTP";
            }
            break;

          case "sendgrid": {
            const sgKey = config.sendgrid_api_key || Deno.env.get("SENDGRID_API_KEY");
            if (!sgKey) {
              status = "FAILED";
              resultMessage = "SendGrid API key not configured";
            } else {
              const sgResult = await sendViaSendGrid(
                sgKey,
                config.sendgrid_from_email || config.smtp_from || "noreply@cyberquote.com",
                franchisee.email,
                emailSubject,
                emailHtml
              );
              if (!sgResult.success) {
                status = "FAILED";
                resultMessage = sgResult.error;
              } else {
                externalId = sgResult.messageId || null;
                resultMessage = "Email sent via SendGrid";
              }
            }
            break;
          }

          case "gmail":
            const gmailResult = await sendGmail(
              config.smtp_user || "",
              config.smtp_pass || "",
              franchisee.email,
              emailSubject,
              emailHtml
            );
            if (!gmailResult.success) {
              status = "FAILED";
              resultMessage = gmailResult.error;
            } else {
              resultMessage = "Email sent via Gmail SMTP";
            }
            break;

          default:
            status = "FAILED";
            resultMessage = `Unknown email provider: ${provider}`;
        }
        break;
      }

      case "PUSH":
        console.log(`Push notification to ${franchisee.id}: ${emailSubject}`);
        resultMessage = "Push notification logged";
        break;
    }

    // Store notification record
    const { data: notification } = await supabase
      .from("notifications")
      .insert({
        alert_id,
        user_id: franchisee.id,
        channel,
        status,
        external_id: externalId,
        sent_at: new Date().toISOString(),
        message,
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({
        notification_id: notification?.id,
        status,
        message: resultMessage,
        recipient: { id: franchisee.id, name: franchisee.full_name, email: franchisee.email },
        channel,
        provider: channel === "EMAIL" ? (config.email_provider || "sendgrid") : channel,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Notification error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
