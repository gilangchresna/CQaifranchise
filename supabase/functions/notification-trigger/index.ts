/// <reference lib="deno.ns" />

/**
 * Notification Trigger Edge Function
 * Automatically sends notifications when alerts are created or cases are updated
 *
 * POST /functions/v1/notification-trigger
 *
 * Request Body:
 * {
 *   event_type: "ALERT_CREATED" | "CASE_ASSIGNED" | "CASE_UPDATED" | "SLA_WARNING",
 *   entity_id: number,            // alert_id or case_id
 *   channels?: string[],         // Optional: ["EMAIL", "WHATSAPP"]
 *   severity_override?: string    // Optional: Override severity level
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   notifications_sent: number,
 *   channels: string[],
 *   recipients: string[],
 *   errors?: string[]
 * }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventType = "ALERT_CREATED" | "CASE_ASSIGNED" | "CASE_UPDATED" | "SLA_WARNING";
type Channel = "EMAIL" | "WHATSAPP" | "PUSH";
type Severity = "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";

interface NotificationTriggerRequest {
  event_type: EventType;
  entity_id: number;
  channels?: Channel[];
  severity_override?: Severity;
}

interface NotificationTriggerResponse {
  success: boolean;
  notifications_sent: number;
  channels: Channel[];
  recipients: string[];
  errors?: string[];
}

interface AlertInfo {
  id: number;
  type: string;
  severity: Severity;
  status: string;
  title: string;
  description: string;
  score: number;
  triggered_at: string;
  outlet: {
    id: number;
    name: string;
    code: string;
    region: {
      id: number;
      name: string;
    };
  };
}

interface CaseInfo {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  sla_deadline: string | null;
  created_at: string;
  alert: AlertInfo | null;
  assigned_to: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
}

interface OutletInfo {
  id: number;
  name: string;
  code: string;
  region: {
    id: number;
    name: string;
  };
  franchisee: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
}

interface UserInfo {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  region_id: number | null;
  notification_email: boolean;
  notification_whatsapp: boolean;
}

interface Recipient {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  channels: Channel[];
}

/**
 * Generate email subject based on event type
 */
function generateEmailSubject(eventType: EventType, alert: AlertInfo | null, caseInfo: CaseInfo | null): string {
  switch (eventType) {
    case "ALERT_CREATED":
      const severity = alert?.severity || "UNKNOWN";
      return `[${severity}] CyberQuote Alert: ${alert?.title || "New Alert"}`;
    case "CASE_ASSIGNED":
      return `[CyberQuote] Case Assigned: ${caseInfo?.title || "New Case"}`;
    case "CASE_UPDATED":
      return `[CyberQuote] Case Update: ${caseInfo?.title || "Case Updated"}`;
    case "SLA_WARNING":
      return `⚠️ [URGENT] SLA Warning: ${caseInfo?.title || "Case"}`;
    default:
      return "[CyberQuote] Notification";
  }
}

/**
 * Generate email HTML body
 */
function generateEmailHtml(
  eventType: EventType,
  alert: AlertInfo | null,
  caseInfo: CaseInfo | null
): string {
  const baseColor = "#2563eb";
  const alertColor = alert?.severity?.includes("P0") || alert?.severity?.includes("P1") ? "#dc2626" : baseColor;

  let content = "";

  switch (eventType) {
    case "ALERT_CREATED":
      content = `
        <h2 style="color: ${alertColor}; margin-bottom: 16px;">📢 New Alert Created</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold;">Alert Type</td><td style="padding: 8px;">${alert?.type || "Unknown"}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: bold;">Severity</td><td style="padding: 8px; color: ${alertColor}; font-weight: bold;">${alert?.severity || "Unknown"}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Outlet</td><td style="padding: 8px;">${alert?.outlet?.name || "Unknown"} (${alert?.outlet?.code || "N/A"})</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: bold;">Region</td><td style="padding: 8px;">${alert?.outlet?.region?.name || "Unknown"}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Score</td><td style="padding: 8px;">${Math.round((alert?.score || 0) * 100)}%</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: bold;">Time</td><td style="padding: 8px;">${new Date(alert?.triggered_at || Date.now()).toLocaleString()}</td></tr>
        </table>
        <div style="margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 8px;">
          <p><strong>Description:</strong></p>
          <p>${alert?.description || "No description provided."}</p>
        </div>
      `;
      break;

    case "CASE_ASSIGNED":
      content = `
        <h2 style="color: #059669; margin-bottom: 16px;">📋 Case Assigned to You</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold;">Case</td><td style="padding: 8px;">${caseInfo?.title || "Unknown"}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: bold;">Priority</td><td style="padding: 8px; font-weight: bold;">${caseInfo?.priority || "MEDIUM"}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Status</td><td style="padding: 8px;">${caseInfo?.status || "NEW"}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: bold;">SLA Deadline</td><td style="padding: 8px;">${caseInfo?.sla_deadline ? new Date(caseInfo.sla_deadline).toLocaleString() : "Not set"}</td></tr>
        </table>
        ${caseInfo?.description ? `<div style="margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 8px;"><p>${caseInfo.description}</p></div>` : ""}
      `;
      break;

    case "CASE_UPDATED":
      content = `
        <h2 style="color: #7c3aed; margin-bottom: 16px;">🔄 Case Updated</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold;">Case</td><td style="padding: 8px;">${caseInfo?.title || "Unknown"}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: bold;">New Status</td><td style="padding: 8px; font-weight: bold;">${caseInfo?.status || "Updated"}</td></tr>
        </table>
      `;
      break;

    case "SLA_WARNING":
      content = `
        <h2 style="color: #dc2626; margin-bottom: 16px;">⚠️ SLA Warning - Action Required!</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold;">Case</td><td style="padding: 8px;">${caseInfo?.title || "Unknown"}</td></tr>
          <tr style="background: #fef2f2;"><td style="padding: 8px; font-weight: bold; color: #dc2626;">Deadline</td><td style="padding: 8px; color: #dc2626;">${caseInfo?.sla_deadline ? new Date(caseInfo.sla_deadline).toLocaleString() : "Overdue!"}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Priority</td><td style="padding: 8px;">${caseInfo?.priority || "HIGH"}</td></tr>
        </table>
        <div style="margin-top: 16px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
          <p style="color: #dc2626; margin: 0;"><strong>This case is approaching or has exceeded its SLA deadline.</strong></p>
        </div>
      `;
      break;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${baseColor}, #1d4ed8); padding: 20px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">CyberQuote</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0;">AI-Powered Franchise Monitoring</p>
      </div>
      <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        ${content}
      </div>
      <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
        <p>CyberQuote - CyberConsulting Indonesia</p>
        <p>© ${new Date().getFullYear()} CyberConsulting. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text email body
 */
function generateEmailText(
  eventType: EventType,
  alert: AlertInfo | null,
  caseInfo: CaseInfo | null
): string {
  switch (eventType) {
    case "ALERT_CREATED":
      return `
CYBERQUOTE - NEW ALERT

Alert Type: ${alert?.type || "Unknown"}
Severity: ${alert?.severity || "Unknown"}
Outlet: ${alert?.outlet?.name || "Unknown"} (${alert?.outlet?.code || "N/A"})
Region: ${alert?.outlet?.region?.name || "Unknown"}
Score: ${Math.round((alert?.score || 0) * 100)}%
Time: ${new Date(alert?.triggered_at || Date.now()).toLocaleString()}

Description:
${alert?.description || "No description provided."}

---
CyberQuote - CyberConsulting Indonesia
      `.trim();

    case "CASE_ASSIGNED":
      return `
CYBERQUOTE - CASE ASSIGNED TO YOU

Case: ${caseInfo?.title || "Unknown"}
Priority: ${caseInfo?.priority || "MEDIUM"}
Status: ${caseInfo?.status || "NEW"}
SLA Deadline: ${caseInfo?.sla_deadline ? new Date(caseInfo.sla_deadline).toLocaleString() : "Not set"}

Description:
${caseInfo?.description || "No description provided."}

---
CyberQuote - CyberConsulting Indonesia
      `.trim();

    case "SLA_WARNING":
      return `
⚠️ CYBERQUOTE - SLA WARNING - ACTION REQUIRED! ⚠️

Case: ${caseInfo?.title || "Unknown"}
Deadline: ${caseInfo?.sla_deadline ? new Date(caseInfo.sla_deadline).toLocaleString() : "OVERDUE!"}
Priority: ${caseInfo?.priority || "HIGH"}

This case is approaching or has exceeded its SLA deadline.
Please take immediate action.

---
CyberQuote - CyberConsulting Indonesia
      `.trim();

    default:
      return `CyberQuote Notification`;
  }
}

/**
 * Generate WhatsApp message
 */
function generateWhatsAppMessage(
  eventType: EventType,
  alert: AlertInfo | null,
  caseInfo: CaseInfo | null
): string {
  switch (eventType) {
    case "ALERT_CREATED":
      return `
📢 *CyberQuote - New Alert*

Type: ${alert?.type || "Unknown"}
Severity: *${alert?.severity || "Unknown"}*
Outlet: ${alert?.outlet?.name || "Unknown"}
Region: ${alert?.outlet?.region?.name || "Unknown"}
Score: ${Math.round((alert?.score || 0) * 100)}%

${alert?.description?.substring(0, 100) || "New alert triggered"}...
      `.trim();

    case "CASE_ASSIGNED":
      return `
📋 *CyberQuote - Case Assigned*

Case: ${caseInfo?.title || "Unknown"}
Priority: *${caseInfo?.priority || "MEDIUM"}*
SLA: ${caseInfo?.sla_deadline ? new Date(caseInfo.sla_deadline).toLocaleString() : "Not set"}

Please review and take action.
      `.trim();

    case "SLA_WARNING":
      return `
⚠️ *URGENT - SLA Warning!*

Case: ${caseInfo?.title || "Unknown"}
Deadline: ${caseInfo?.sla_deadline ? new Date(caseInfo.sla_deadline).toLocaleString() : "OVERDUE!"}

⚡ Immediate action required!
      `.trim();

    default:
      return "CyberQuote Notification";
  }
}

/**
 * Determine recipients based on event type and entity
 */
async function determineRecipients(
  supabase: any,
  eventType: EventType,
  alert: AlertInfo | null,
  caseInfo: CaseInfo | null,
  severityOverride?: Severity
): Promise<Recipient[]> {
  const recipients: Recipient[] = [];
  const severity = severityOverride || (alert?.severity as Severity) || "P2_MEDIUM";

  // Get user notification preferences from settings
  const { data: settings } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["default_notification_email", "default_notification_whatsapp"]);

  const defaultEmail = settings?.find(s => s.key === "default_notification_email")?.value !== "false";
  const defaultWhatsapp = settings?.find(s => s.key === "default_notification_whatsapp")?.value !== "false";

  // Add assigned user for case events
  if (caseInfo?.assigned_to) {
    const channels: Channel[] = [];
    if (caseInfo.assigned_to.email && defaultEmail) channels.push("EMAIL");
    if (caseInfo.assigned_to.phone && defaultWhatsapp) channels.push("WHATSAPP");

    if (channels.length > 0) {
      recipients.push({
        user_id: caseInfo.assigned_to.id,
        name: caseInfo.assigned_to.full_name,
        email: caseInfo.assigned_to.email,
        phone: caseInfo.assigned_to.phone,
        channels,
      });
    }
  }

  // For ALERT_CREATED, notify outlet's franchisee and regional manager
  if (eventType === "ALERT_CREATED" && alert?.outlet) {
    // Get franchisee
    const { data: franchisee } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, phone")
      .eq("role", "FRANCHISEE_OWNER").eq("outlet_id", outletId)
      .single();

    if (franchisee) {
      const channels: Channel[] = [];
      if (franchisee.email) channels.push("EMAIL");
      if (franchisee.phone) channels.push("WHATSAPP");

      recipients.push({
        user_id: franchisee.id,
        name: franchisee.full_name,
        email: franchisee.email,
        phone: franchisee.phone,
        channels,
      });
    }

    // Get regional manager for outlet's region
    const { data: regionalManager } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, phone")
      .eq("role", "REGIONAL_MANAGER")
      .eq("region_id", alert.outlet.region?.id)
      .single();

    if (regionalManager) {
      const channels: Channel[] = [];
      if (regionalManager.email) channels.push("EMAIL");
      if (regionalManager.phone) channels.push("WHATSAPP");

      recipients.push({
        user_id: regionalManager.id,
        name: regionalManager.full_name,
        email: regionalManager.email,
        phone: regionalManager.phone,
        channels,
      });
    }
  }

  // For P0_CRITICAL and P1_HIGH, also notify HQ_ADMIN
  if (severity === "P0_CRITICAL" || severity === "P1_HIGH") {
    const { data: hqAdmins } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, phone")
      .eq("role", "HQ_ADMIN");

    for (const admin of hqAdmins || []) {
      // Don't add duplicate if already in list
      if (!recipients.find(r => r.user_id === admin.id)) {
        const channels: Channel[] = [];
        if (admin.email) channels.push("EMAIL");
        if (admin.phone) channels.push("WHATSAPP");

        recipients.push({
          user_id: admin.id,
          name: admin.full_name,
          email: admin.email,
          phone: admin.phone,
          channels,
        });
      }
    }
  }

  return recipients;
}

/**
 * Send notification via existing notification-send function
 */
async function sendNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  alertId: number,
  channel: Channel
): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/notification-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        alert_id: alertId,
        channel: channel,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to send ${channel} notification:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error sending ${channel} notification:`, error);
    return false;
  }
}

/**
 * Send direct notification (bypasses notification-send for more control)
 */
async function sendDirectEmail(
  toEmail: string,
  subject: string,
  textContent: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  const sendGridKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@cyberquote.com";

  if (!sendGridKey) {
    return { success: false, error: "SendGrid API key not configured" };
  }

  try {
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
        content: [
          { type: "text/plain", value: textContent },
          { type: "text/html", value: htmlContent },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendDirectWhatsApp(
  toPhone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  try {
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

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Log notification to database
 */
async function logNotification(
  supabase: any,
  alertId: number | null,
  caseId: number | null,
  recipientEmail: string,
  recipientPhone: string | null,
  channel: Channel,
  status: string,
  error?: string
): Promise<void> {
  try {
    await supabase.from("notification_logs").insert({
      alert_id: alertId,
      case_id: caseId,
      recipient_email: recipientEmail,
      recipient_phone: recipientPhone,
      channel,
      status,
      error_message: error,
      sent_at: status === 'SENT' ? new Date().toISOString() : null,
    });
  } catch (logError) {
    console.error("Failed to log notification:", logError);
  }
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
    const body: NotificationTriggerRequest = await req.json();

    // Validate required fields
    if (!body.event_type) {
      return new Response(
        JSON.stringify({ success: false, error: "event_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.entity_id || typeof body.entity_id !== "number") {
      return new Response(
        JSON.stringify({ success: false, error: "entity_id is required and must be a number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validEventTypes = ["ALERT_CREATED", "CASE_ASSIGNED", "CASE_UPDATED", "SLA_WARNING"];
    if (!validEventTypes.includes(body.event_type)) {
      return new Response(
        JSON.stringify({ success: false, error: `event_type must be one of: ${validEventTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch entity based on event type
    let alert: AlertInfo | null = null;
    let caseInfo: CaseInfo | null = null;

    if (body.event_type === "ALERT_CREATED") {
      const { data } = await supabase
        .from("alerts")
        .select(`
          *,
          outlets (
            id, name, code,
            regions (id, name)
          )
        `)
        .eq("id", body.entity_id)
        .single();

      if (data) {
        alert = data as unknown as AlertInfo;
      }
    } else {
      // For CASE_* events, fetch the case
      const { data } = await supabase
        .from("cases")
        .select(`
          *,
          alerts (
            *,
            outlets (
              id, name, code,
              regions (id, name)
            )
          ),
          assigned_user:user_profiles!assigned_to_id (
            id, full_name, email, phone
          )
        `)
        .eq("id", body.entity_id)
        .single();

      if (data) {
        caseInfo = {
          id: data.id,
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          sla_deadline: data.sla_deadline,
          created_at: data.created_at,
          alert: data.alerts as unknown as AlertInfo | null,
          assigned_to: data.assigned_user as any,
        };
        alert = caseInfo.alert;
      }
    }

    // If no entity found, return error
    if (!alert && !caseInfo) {
      return new Response(
        JSON.stringify({ success: false, error: `Entity ${body.entity_id} not found` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine recipients
    const recipients = await determineRecipients(
      supabase,
      body.event_type,
      alert,
      caseInfo,
      body.severity_override
    );

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          notifications_sent: 0,
          channels: [],
          recipients: [],
          message: "No recipients found",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate message content
    const subject = generateEmailSubject(body.event_type, alert, caseInfo);
    const emailHtml = generateEmailHtml(body.event_type, alert, caseInfo);
    const emailText = generateEmailText(body.event_type, alert, caseInfo);
    const whatsappMessage = generateWhatsAppMessage(body.event_type, alert, caseInfo);

    // Send notifications
    const errors: string[] = [];
    let notificationsSent = 0;
    const allRecipients: string[] = [];

    for (const recipient of recipients) {
      allRecipients.push(recipient.email);

      // Determine channels to use
      const channelsToUse = body.channels?.length
        ? recipient.channels.filter(c => body.channels!.includes(c))
        : recipient.channels;

      for (const channel of channelsToUse) {
        let success = false;

        if (channel === "EMAIL" && recipient.email) {
          const result = await sendDirectEmail(recipient.email, subject, emailText, emailHtml);
          success = result.success;
          if (!success && result.error) {
            errors.push(`Email to ${recipient.email}: ${result.error}`);
          }
          await logNotification(
            supabase,
            alert?.id || null,
            caseInfo?.id || null,
            recipient.email,
            null,
            channel,
            success ? "SENT" : "FAILED",
            success ? undefined : errors[errors.length - 1]
          );
        }

        if (channel === "WHATSAPP" && recipient.phone) {
          const result = await sendDirectWhatsApp(recipient.phone, whatsappMessage);
          success = result.success;
          if (!success && result.error) {
            errors.push(`WhatsApp to ${recipient.phone}: ${result.error}`);
          }
          await logNotification(
            supabase,
            alert?.id || null,
            caseInfo?.id || null,
            recipient.email,
            recipient.phone,
            channel,
            success ? "SENT" : "FAILED",
            success ? undefined : errors[errors.length - 1]
          );
        }

        if (success) {
          notificationsSent++;
          console.log(`Sent ${channel} notification to ${recipient.email || recipient.phone}`);
        }
      }
    }

    const response: NotificationTriggerResponse = {
      success: true,
      notifications_sent: notificationsSent,
      channels: [...new Set(recipients.flatMap(r => r.channels))] as Channel[],
      recipients: allRecipients,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log(`Notification trigger completed: ${notificationsSent} sent to ${recipients.length} recipients`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Notification trigger error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
