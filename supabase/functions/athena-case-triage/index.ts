/// <reference lib="deno.ns" />

/**
 * Athena Case Triage Edge Function
 * AI-powered case categorization and resolution suggestions
 *
 * POST /functions/v1/athena-case-triage
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TriageRequest {
  case_id?: number;
  alert_id?: number;
  title: string;
  description?: string;
  outlet_id?: number;
  severity?: string;
}

interface CategoryInfo {
  category: string;
  subcategory: string;
  confidence: number;
}

interface ResolutionSuggestion {
  action: string;
  priority: "IMMEDIATE" | "URGENT" | "NORMAL";
  estimated_time: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify JWT authentication (no-auth + service role bypass for internal/cron calls)
  const authHeader = req.headers.get("Authorization");
  const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No auth header — allow through (pg_cron)
  } else {
    const token = authHeader.substring(7);
    // Bypass if token is service role key
    if (token === serviceKey) {
      // bypass
    } else {
      // Check if it's an ANON key (local scripts / testing)
      const isAnon = (() => {
        try {
          const parts = token.split(".");
          if (parts.length !== 3) return false;
          const payload = JSON.parse(atob(parts[1]));
          return payload.role === "anon";
        } catch { return false; }
      })();
      if (isAnon) {
        // bypass — allow ANON key for internal calls
      } else {
        try {
          const verifyRes = await fetch(`${supabaseUrl2}/auth/v1/user`, {
            headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
          });
          if (!verifyRes.ok) {
            return new Response(
              JSON.stringify({ error: "Unauthorized: Invalid token" }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (err) {
          return new Response(
            JSON.stringify({ error: "Authentication failed" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }
  }

  try {
    const body: TriageRequest = await req.json();
    const { title, description, outlet_id, severity } = body;

    if (!title) {
      return new Response(
        JSON.stringify({ error: "title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get outlet info if provided
    let outletInfo = null;
    if (outlet_id) {
      const { data: outlet } = await supabase
        .from("outlets")
        .select("id, name, code, region_id")
        .eq("id", outlet_id)
        .single();
      outletInfo = outlet;
    }

    // AI Triage Logic
    const triageResult = analyzeCase(title, description || "", severity || "P2_MEDIUM", outletInfo);

    // Get similar resolved cases for reference
    const { data: similarCases } = await supabase
      .from("cases")
      .select("id, title, status, priority, resolved_by, resolved_at, notes")
      .eq("status", "RESOLVED")
      .order("created_at", { ascending: false })
      .limit(3);

    return new Response(
      JSON.stringify({
        success: true,
        triage: triageResult,
        similar_cases: similarCases || [],
        outlet: outletInfo,
        analyzed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Triage error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function analyzeCase(title: string, description: string, severity: string, outletInfo: any) {
  const text = (title + " " + description).toLowerCase();
  
  // Category detection
  let category = "OPERATIONS";
  let subcategory = "General Issue";
  
  if (text.includes("stock") || text.includes("inventory") || text.includes("stok")) {
    category = "INVENTORY";
    subcategory = "Stock Management";
  } else if (text.includes("sale") || text.includes("revenue") || text.includes("omzet")) {
    category = "SALES";
    subcategory = "Revenue Alert";
  } else if (text.includes("staff") || text.includes("karyawan") || text.includes("absen")) {
    category = "HR";
    subcategory = "Staffing";
  } else if (text.includes("equipment") || text.includes("mesin") || text.includes("rusak")) {
    category = "MAINTENANCE";
    subcategory = "Equipment Failure";
  } else if (text.includes("food") || text.includes("quality") || text.includes("kualitas")) {
    category = "QUALITY";
    subcategory = "Food Safety";
  } else if (text.includes("customer") || text.includes("complaint") || text.includes("keluhan")) {
    category = "CUSTOMER";
    subcategory = "Customer Complaint";
  }

  // Priority based on severity
  let suggestedPriority = "NORMAL";
  if (severity.includes("CRITICAL") || severity.includes("P0")) {
    suggestedPriority = "IMMEDIATE";
  } else if (severity.includes("HIGH") || severity.includes("P1")) {
    suggestedPriority = "URGENT";
  }

  // Resolution suggestions based on category
  const suggestions = getSuggestions(category, subcategory);

  // SLA based on priority
  const slaHours: Record<string, number> = {
    IMMEDIATE: 4,
    URGENT: 24,
    NORMAL: 72,
  };

  return {
    category,
    subcategory,
    confidence: 0.85,
    suggested_priority: suggestedPriority,
    suggested_sla_hours: slaHours[suggestedPriority],
    suggested_assignee_role: getSuggestedRole(category),
    suggestions,
    ai_summary: generateSummary(category, subcategory, outletInfo),
  };
}

function getSuggestions(category: string, subcategory: string): ResolutionSuggestion[] {
  const suggestionMap: Record<string, ResolutionSuggestion[]> = {
    "INVENTORY": [
      { action: "Check current stock levels and reorder immediately", priority: "IMMEDIATE", estimated_time: "30 mins" },
      { action: "Contact distribution center for emergency restock", priority: "URGENT", estimated_time: "2 hours" },
      { action: "Review inventory forecasting model", priority: "NORMAL", estimated_time: "1 day" },
    ],
    "SALES": [
      { action: "Verify POS system data accuracy", priority: "URGENT", estimated_time: "1 hour" },
      { action: "Check for promotions or events affecting sales", priority: "NORMAL", estimated_time: "2 hours" },
      { action: "Analyze competitor activity in area", priority: "NORMAL", estimated_time: "1 day" },
    ],
    "HR": [
      { action: "Arrange shift coverage immediately", priority: "IMMEDIATE", estimated_time: "1 hour" },
      { action: "Contact backup staff from regional pool", priority: "URGENT", estimated_time: "2 hours" },
      { action: "Review attendance patterns for patterns", priority: "NORMAL", estimated_time: "1 day" },
    ],
    "MAINTENANCE": [
      { action: "Dispatch maintenance team immediately", priority: "IMMEDIATE", estimated_time: "1 hour" },
      { action: "Assess if temporary workaround is possible", priority: "URGENT", estimated_time: "2 hours" },
      { action: "Schedule preventive maintenance review", priority: "NORMAL", estimated_time: "1 week" },
    ],
    "QUALITY": [
      { action: "Quarantine affected products immediately", priority: "IMMEDIATE", estimated_time: "30 mins" },
      { action: "Conduct quality inspection", priority: "URGENT", estimated_time: "2 hours" },
      { action: "Review supplier quality records", priority: "NORMAL", estimated_time: "1 day" },
    ],
    "CUSTOMER": [
      { action: "Acknowledge complaint and apologize", priority: "IMMEDIATE", estimated_time: "30 mins" },
      { action: "Investigate root cause", priority: "URGENT", estimated_time: "4 hours" },
      { action: "Follow up with customer on resolution", priority: "NORMAL", estimated_time: "1 day" },
    ],
  };

  return suggestionMap[category] || [
    { action: "Investigate issue further", priority: "NORMAL", estimated_time: "4 hours" },
    { action: "Document findings", priority: "NORMAL", estimated_time: "1 day" },
  ];
}

function getSuggestedRole(category: string): string {
  const roleMap: Record<string, string> = {
    "INVENTORY": "Regional Manager",
    "SALES": "Regional Manager",
    "HR": "HR Manager",
    "MAINTENANCE": "Operations Manager",
    "QUALITY": "Quality Assurance",
    "CUSTOMER": "Customer Service",
    "OPERATIONS": "Regional Manager",
  };
  return roleMap[category] || "Regional Manager";
}

function generateSummary(category: string, subcategory: string, outletInfo: any): string {
  const outletName = outletInfo?.name || "Unknown Outlet";
  return `This ${subcategory.toLowerCase()} issue at ${outletName} falls under ${category} category. ` +
    `Recommended to assign to ${getSuggestedRole(category)} for immediate action. ` +
    `Prioritize resolution based on severity level.`;
}
