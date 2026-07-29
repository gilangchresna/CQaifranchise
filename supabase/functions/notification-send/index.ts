// Send Notification Edge Function
// POST endpoint - sends notifications via Twilio WhatsApp or SendGrid Email

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

interface TwilioResponse {
  sid?: string;
  error?: string;
}

interface SendGridResponse {
  messageId?: string;
  errors?: string[];
}

// Twilio WhatsApp sender
async function sendWhatsAppNotification(
  toPhone: string,
  message: string,
): Promise<TwilioResponse> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio credentials not configured");
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
    return { error };
  }

  const data = await response.json();
  return { sid: data.sid };
}

// SendGrid Email sender
async function sendEmailNotification(
  toEmail: string,
  subject: string,
  htmlContent: string,
): Promise<SendGridResponse> {
  const sendGridKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@cyberquote.com";

  if (!sendGridKey) {
    throw new Error("SendGrid API key not configured");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sendGridKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail },
      subject,
      content: [{ type: "text/html", value: htmlContent }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { errors: [error] };
  }

  const messageId = response.headers.get("X-Message-Id") || "unknown";
  return { messageId };
}

// Push notification placeholder (would use Firebase Cloud Messaging)
async function sendPushNotification(
  deviceToken: string,
  title: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  console.log(`Push notification to ${deviceToken}: ${title}`);
  return { success: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { alert_id, channel, priority_override }: NotificationRequest = await req.json();

    if (!alert_id || !channel) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: alert_id, channel" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate channel
    if (!["WHATSAPP", "EMAIL", "PUSH"].includes(channel)) {
      return new Response(
        JSON.stringify({ error: "Invalid channel. Must be WHATSAPP, EMAIL, or PUSH" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch alert with outlet info
    const { data: alert, error: alertError } = await supabase
      .from("alerts")
      .select(`
        *,
        outlets (
          id,
          name,
          code,
          region:regions (
            id,
            name
          )
        )
      `)
      .eq("id", alert_id)
      .single();

    if (alertError || !alert) {
      return new Response(
        JSON.stringify({ error: "Alert not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch outlet to get franchisee_id
    const { data: outlet, error: outletError } = await supabase
      .from("outlets")
      .select("franchisee_id")
      .eq("id", alert.outlet_id)
      .single();

    if (outletError || !outlet) {
      return new Response(
        JSON.stringify({ error: "Outlet not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch recipient (franchisee owner) info using franchisee_id
    const { data: franchisee, error: franchiseeError } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, phone")
      .eq("id", outlet.franchisee_id)
      .single();

    if (franchiseeError || !franchisee) {
      return new Response(
        JSON.stringify({ error: "Recipient (franchisee) not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Determine priority
    const priority = priority_override || alert.severity;

    // Build notification message (ASCII-safe)
    const alertTag: Record<string, string> = {
      P0_CRITICAL: "[CRITICAL]",
      P1_HIGH: "[HIGH]",
      P2_MEDIUM: "[MEDIUM]",
      P3_LOW: "[LOW]",
    };

    const tag = alertTag[priority] || "[INFO]";
    const message = `CyberQuote Alert\n${tag}\n\n${alert.title}\n\nOutlet: ${alert.outlets?.name || "N/A"}\nSeverity: ${priority}\nType: ${alert.type}\n\n${alert.description || "No description provided."}\n\nTriggered: ${new Date(alert.triggered_at).toLocaleString()}`;

    const emailSubject = `[${priority}] ${alert.title} - ${alert.outlets?.name || "Unknown Outlet"}`;
    const emailHtml = `
      <h2>CyberQuote Alert</h2>
      <h3>${tag} ${alert.title}</h3>
      <table>
        <tr><td><strong>Outlet:</strong></td><td>${alert.outlets?.name || "N/A"}</td></tr>
        <tr><td><strong>Severity:</strong></td><td>${priority}</td></tr>
        <tr><td><strong>Type:</strong></td><td>${alert.type}</td></tr>
        <tr><td><strong>Triggered:</strong></td><td>${new Date(alert.triggered_at).toLocaleString()}</td></tr>
      </table>
      <h4>Description</h4>
      <p>${alert.description || "No description provided."}</p>
      <p><a href="${Deno.env.get("APP_URL") || "#"}/alerts/${alert.id}">View Alert Details</a></p>
    `;

    // Send notification based on channel
    let externalId: string | null = null;
    let status = "SENT";

    switch (channel) {
      case "WHATSAPP":
        if (!franchisee.phone) {
          return new Response(
            JSON.stringify({ error: "Recipient has no phone number" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const whatsappResult = await sendWhatsAppNotification(franchisee.phone, message);
        if (whatsappResult.error) {
          status = "FAILED";
          externalId = null;
          console.error("WhatsApp send error:", whatsappResult.error);
        } else {
          externalId = whatsappResult.sid || null;
        }
        break;

      case "EMAIL":
        const emailResult = await sendEmailNotification(
          franchisee.email,
          emailSubject,
          emailHtml,
        );
        if (emailResult.errors) {
          status = "FAILED";
          console.error("Email send errors:", emailResult.errors);
        } else {
          externalId = emailResult.messageId || null;
        }
        break;

      case "PUSH":
        const pushResult = await sendPushNotification(
          franchisee.id.toString(),
          emailSubject,
          message,
        );
        if (!pushResult.success) {
          status = "FAILED";
        }
        break;
    }

    // Store notification record
    const sentAt = new Date().toISOString();
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .insert({
        alert_id,
        user_id: franchisee.id,
        channel,
        status,
        external_id: externalId,
        sent_at: sentAt,
        message,
      })
      .select()
      .single();

    if (notificationError) {
      console.error("Failed to store notification:", notificationError);
      return new Response(
        JSON.stringify({
          warning: "Notification sent but failed to store record",
          error: notificationError.message,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        notification_id: notification.id,
        status: notification.status,
        sent_at: notification.sent_at,
        recipient: {
          id: franchisee.id,
          name: franchisee.full_name,
        },
        channel,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Notification send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
