/// <reference lib="deno.ns" />

/**
 * Athena Insights Edge Function
 * AI-powered outlet analysis using Gemini API
 *
 * POST /functions/v1/athena-insights
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OutletInsightRequest {
  outlet_id: number;
  outlet_name: string;
  outlet_code: string;
  sales: number;
  transaction_count: number;
  avg_transaction: number;
  stock_risk_percent: number;
  low_stock_items: Array<{
    sku: string;
    product_name: string;
    current_stock: number;
    min_stock: number;
    risk_level: string;
  }>;
  comparison?: {
    yesterday: number;
    yesterday_change: number;
    last_week: number;
    last_week_change: number;
  };
  hourly_sales: Record<string, number>;
}

interface InsightResponse {
  summary: string;
  key_findings: string[];
  recommendations: Array<{
    priority: "HIGH" | "MEDIUM" | "LOW";
    action: string;
    reason: string;
  }>;
  alerts: string[];
  forecast?: {
    tomorrow: string;
    trend: "up" | "down" | "stable";
    confidence: string;
  };
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

  // Verify JWT authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.substring(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
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

  try {
    const body: OutletInsightRequest = await req.json();

    if (!body.outlet_id || !body.outlet_name) {
      return new Response(
        JSON.stringify({ error: "outlet_id and outlet_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt for Gemini
    const prompt = buildInsightPrompt(body);

    // Call Gemini API
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey || geminiApiKey === "MY_GEMINI_API_KEY" || geminiApiKey === "") {
      // Fallback to structured analysis without AI
      const response = generateFallbackInsights(body);
      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", errorText);
        throw new Error("Gemini API failed");
      }

      const result = await response.json();
      const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Parse AI response into structured format
      const insights = parseAIResponse(aiResponse, body);

      return new Response(
        JSON.stringify(insights),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (apiError) {
      console.error("API call failed, using fallback:", apiError);
      const response = generateFallbackInsights(body);
      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildInsightPrompt(data: OutletInsightRequest): string {
  const lowStockList = data.low_stock_items
    .slice(0, 5)
    .map(item => `- ${item.product_name} (${item.sku}): ${item.current_stock} units (min: ${item.min_stock})`)
    .join("\n");

  const hourlyData = Object.entries(data.hourly_sales)
    .map(([hour, sales]) => `${hour}: S$${sales}`)
    .join(", ");

  return `You are Athena, an AI assistant for CyberQuote franchise monitoring platform.

Analyze this outlet's performance and provide actionable insights:

**Outlet:** ${data.outlet_name} (${data.outlet_code})
**Today's Sales:** S$${data.sales.toLocaleString()}
**Transactions:** ${data.transaction_count}
**Avg Transaction:** S$${data.avg_transaction.toFixed(2)}
**Stock Risk:** ${data.stock_risk_percent}%
${data.comparison ? `**vs Yesterday:** ${data.comparison.yesterday_change > 0 ? '+' : ''}${data.comparison.yesterday_change}% (S$${data.comparison.yesterday.toLocaleString()})` : ''}
${data.comparison ? `**vs Last Week:** ${data.comparison.last_week_change > 0 ? '+' : ''}${data.comparison.last_week_change}% (S$${data.comparison.last_week.toLocaleString()})` : ''}

**Low Stock Items:**
${lowStockList || "No critical low stock items"}

**Hourly Sales:** ${hourlyData || "No hourly data available"}

Please provide:
1. A brief summary (2-3 sentences)
2. 3-4 key findings
3. 2-3 prioritized recommendations
4. Any critical alerts

Format your response in Indonesian/English mix for franchise owners. Be specific and actionable.`;
}

function parseAIResponse(aiText: string, data: OutletInsightRequest): InsightResponse {
  // Extract key findings, recommendations from AI text
  const lines = aiText.split("\n").filter(l => l.trim());
  
  const response: InsightResponse = {
    summary: lines.slice(0, 3).join(" ").substring(0, 500),
    key_findings: lines.filter(l => l.startsWith("-") || l.startsWith("•") || l.includes("Finding")).slice(0, 4),
    recommendations: [],
    alerts: [],
  };

  // Add alerts based on data
  if (data.stock_risk_percent > 50) {
    response.alerts.push(`⚠️ Stock risk is HIGH (${data.stock_risk_percent}%) - consider restocking`);
  }
  if (data.low_stock_items.length > 0) {
    response.alerts.push(`📦 ${data.low_stock_items.length} items need restocking attention`);
  }
  if (data.comparison && data.comparison.yesterday_change < -10) {
    response.alerts.push(`📉 Sales dropped ${Math.abs(data.comparison.yesterday_change)}% vs yesterday`);
  }

  return response;
}

function generateFallbackInsights(data: OutletInsightRequest): InsightResponse {
  const keyFindings: string[] = [];
  const recommendations: InsightResponse["recommendations"] = [];
  const alerts: string[] = [];

  // Analyze sales performance
  if (data.sales > 5000) {
    keyFindings.push("💰 Strong revenue performance today");
  } else if (data.sales > 2000) {
    keyFindings.push("📈 Moderate sales, within expected range");
  } else {
    keyFindings.push("📉 Lower than average sales today");
  }

  // Stock risk analysis
  if (data.stock_risk_percent > 70) {
    keyFindings.push("🚨 Critical stock risk level - immediate action needed");
    recommendations.push({
      priority: "HIGH",
      action: "Emergency restock for critical items",
      reason: `Stock risk at ${data.stock_risk_percent}% exceeds safe threshold`
    });
    alerts.push(`⚠️ Stock risk CRITICAL: ${data.stock_risk_percent}%`);
  } else if (data.stock_risk_percent > 40) {
    keyFindings.push("⚠️ Moderate stock risk - monitor closely");
    recommendations.push({
      priority: "MEDIUM",
      action: "Schedule routine restock within 48 hours",
      reason: `Stock risk at ${data.stock_risk_percent}% approaching warning level`
    });
  } else {
    keyFindings.push("✅ Stock levels are healthy");
  }

  // Low stock items
  if (data.low_stock_items.length > 0) {
    const topItems = data.low_stock_items.slice(0, 3).map(i => i.product_name).join(", ");
    keyFindings.push(`📦 ${data.low_stock_items.length} items low: ${topItems}`);
    recommendations.push({
      priority: "MEDIUM",
      action: `Restock: ${data.low_stock_items[0]?.product_name || "priority items"}`,
      reason: "Items below minimum stock level"
    });
  }

  // Comparison with yesterday
  if (data.comparison) {
    if (data.comparison.yesterday_change > 10) {
      keyFindings.push("📈 Significant improvement vs yesterday");
    } else if (data.comparison.yesterday_change < -10) {
      keyFindings.push("📉 Significant drop vs yesterday - investigate cause");
      recommendations.push({
        priority: "MEDIUM",
        action: "Review factors: staffing, inventory, marketing",
        reason: `Sales ${Math.abs(data.comparison.yesterday_change)}% lower than yesterday`
      });
    }
  }

  // Transaction analysis
  if (data.transaction_count > 50) {
    keyFindings.push(`🛒 High transaction volume: ${data.transaction_count} orders`);
  } else if (data.transaction_count > 20) {
    keyFindings.push(`🛒 Moderate transaction count: ${data.transaction_count} orders`);
  }

  // Forecast (simple heuristic)
  let forecastTrend: "up" | "down" | "stable" = "stable";
  let forecastConfidence = "Medium";
  
  if (data.comparison) {
    if (data.comparison.yesterday_change > 5 && data.comparison.last_week_change > 5) {
      forecastTrend = "up";
      forecastConfidence = "High";
    } else if (data.comparison.yesterday_change < -10 || data.comparison.last_week_change < -15) {
      forecastTrend = "down";
      forecastConfidence = "High";
    }
  }

  return {
    summary: `${data.outlet_name} recorded S$${data.sales.toLocaleString()} revenue from ${data.transaction_count} transactions. ${data.stock_risk_percent > 50 ? "Stock risk requires attention." : "Stock levels are manageable."}`,
    key_findings: keyFindings,
    recommendations: recommendations.length > 0 ? recommendations : [{
      priority: "LOW",
      action: "Continue monitoring",
      reason: "No immediate actions required"
    }],
    alerts,
    forecast: {
      tomorrow: forecastTrend === "up" ? "Expected to improve" : forecastTrend === "down" ? "May continue declining" : "Expected to remain stable",
      trend: forecastTrend,
      confidence: forecastConfidence
    }
  };
}
