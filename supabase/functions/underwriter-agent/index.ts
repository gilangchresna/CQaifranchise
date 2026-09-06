/**
 * Underwriter Agent
 * Evaluates loan applications and generates risk scores + loan sizing recommendations
 * 
 * Triggered by: financing_requests with status 'submitted'
 * Creates: risk_scores, loan_sizing_recommendations, audit_log
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FinancingRequest {
  id: string;
  franchisee_id: string;
  outlet_id: number;
  purpose: string;
  requested_amount: number;
  currency: string;
  requested_term_months: number;
  market: string;
}

interface RiskScore {
  outlet_id: number;
  franchisee_id: string;
  score_type: string;
  score_value: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: Record<string, number>;
  recommendation: string;
  assessed_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get pending financing requests
    const { data: requests, error: reqError } = await supabase
      .from("financing_requests")
      .select("*")
      .eq("status", "submitted")
      .limit(10);

    if (reqError) throw reqError;
    if (!requests || requests.length === 0) {
      return new Response(JSON.stringify({ message: "No pending requests", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const request of requests) {
      const reqData = request as unknown as FinancingRequest;

      // Calculate risk score based on available data
      const riskScore = await calculateRiskScore(supabase, reqData);
      
      // Calculate loan sizing recommendation
      const loanSizing = await calculateLoanSizing(supabase, reqData, riskScore);

      // Insert risk scores
      await supabase.from("risk_scores").insert({
        outlet_id: reqData.outlet_id,
        franchisee_id: reqData.franchisee_id,
        score_type: "credit_risk",
        score_value: riskScore.score_value,
        risk_level: riskScore.risk_level,
        factors: riskScore.factors,
        recommendation: riskScore.recommendation,
        assessed_at: new Date().toISOString(),
      });

      // Insert loan sizing recommendation
      if (loanSizing) {
        await supabase.from("loan_sizing_recommendations").insert({
          franchisee_id: reqData.franchisee_id,
          outlet_id: reqData.outlet_id,
          application_id: reqData.id,
          requested_amount: reqData.requested_amount,
          recommended_amount: loanSizing.recommended_amount,
          approved_amount: loanSizing.approved_amount,
          interest_rate_bps: loanSizing.interest_rate_bps,
          term_months: loanSizing.term_months,
          dscr_min: loanSizing.dscr_min,
          monthly_payment: loanSizing.monthly_payment,
          status: "pending_review",
          created_at: new Date().toISOString(),
        });
      }

      // Update request status
      await supabase
        .from("financing_requests")
        .update({ status: "underwriting_complete" })
        .eq("id", reqData.id);

      // Audit log
      await supabase.from("audit_log").insert({
        action: "underwriting_complete",
        entity_type: "financing_request",
        entity_id: reqData.id,
        user_id: "system",
        metadata: { risk_score: riskScore, loan_sizing: loanSizing },
      });

      processed++;
    }

    return new Response(JSON.stringify({
      success: true,
      processed,
      message: `Underwritten ${processed} financing request(s)`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Underwriter error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function calculateRiskScore(supabase: any, request: FinancingRequest): Promise<RiskScore> {
  // Fetch outlet financial data
  const { data: outlet } = await supabase
    .from("outlets")
    .select("*")
    .eq("id", request.outlet_id)
    .single();

  // Fetch recent sales performance
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: sales } = await supabase
    .from("sales_transactions")
    .select("amount")
    .eq("outlet_id", request.outlet_id)
    .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

  // Calculate average daily revenue
  const totalRevenue = (sales || []).reduce((sum: number, s: any) => sum + parseFloat(s.amount || 0), 0);
  const avgDailyRevenue = totalRevenue / 30;

  // Calculate risk factors
  const factors: Record<string, number> = {
    revenue_score: avgDailyRevenue > 1000 ? 80 : avgDailyRevenue > 500 ? 60 : 40,
    amount_ratio: request.requested_amount / (avgDailyRevenue * 365) < 0.5 ? 80 : 60,
    term_score: request.requested_term_months <= 24 ? 80 : 60,
  };

  // Calculate composite score (0-100)
  const scoreValue = Object.values(factors).reduce((a, b) => a + b, 0) / Object.values(factors).length;

  let riskLevel: RiskScore["risk_level"];
  let recommendation: string;

  if (scoreValue >= 75) {
    riskLevel = "LOW";
    recommendation = "Approve - Strong financial position";
  } else if (scoreValue >= 60) {
    riskLevel = "MEDIUM";
    recommendation = "Approve with conditions - Monitor cash flow";
  } else if (scoreValue >= 45) {
    riskLevel = "HIGH";
    recommendation = "Review required - High leverage";
  } else {
    riskLevel = "CRITICAL";
    recommendation = "Decline - Insufficient financial data";
  }

  return {
    outlet_id: request.outlet_id,
    franchisee_id: request.franchisee_id,
    score_type: "credit_risk",
    score_value: scoreValue,
    risk_level: riskLevel,
    factors,
    recommendation,
    assessed_at: new Date().toISOString(),
  };
}

async function calculateLoanSizing(
  supabase: any, 
  request: FinancingRequest, 
  riskScore: RiskScore
): Promise<{
  recommended_amount: number;
  approved_amount: number;
  interest_rate_bps: number;
  term_months: number;
  dscr_min: number;
  monthly_payment: number;
} | null> {
  // Calculate based on risk level
  let maxLTV = 0.7;
  let baseRateBps = 800; // 8%
  
  switch (riskScore.risk_level) {
    case "LOW":
      maxLTV = 0.8;
      baseRateBps = 650; // 6.5%
      break;
    case "MEDIUM":
      maxLTV = 0.65;
      baseRateBps = 850; // 8.5%
      break;
    case "HIGH":
      maxLTV = 0.5;
      baseRateBps = 1100; // 11%
      break;
    case "CRITICAL":
      return null; // No loan sizing for critical
  }

  // Get outlet valuation estimate (based on annual revenue)
  const { data: sales } = await supabase
    .from("sales_transactions")
    .select("amount")
    .eq("outlet_id", request.outlet_id)
    .gte("date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

  const annualRevenue = (sales || []).reduce((sum: number, s: any) => sum + parseFloat(s.amount || 0), 0);
  const estimatedValue = annualRevenue * 0.5; // Simple valuation

  const recommendedAmount = Math.min(
    request.requested_amount,
    estimatedValue * maxLTV
  );

  const approvedAmount = recommendedAmount * 0.9; // Conservative buffer
  const termMonths = Math.min(request.requested_term_months, 36);
  const monthlyRate = baseRateBps / 10000 / 12;
  const monthlyPayment = approvedAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  // Calculate DSCR (simplified)
  const monthlyRevenue = annualRevenue / 12;
  const dscrMin = monthlyPayment > 0 ? monthlyRevenue / monthlyPayment : 999;

  return {
    recommended_amount: Math.round(recommendedAmount),
    approved_amount: Math.round(approvedAmount),
    interest_rate_bps: baseRateBps,
    term_months: termMonths,
    dscr_min: Math.round(dscrMin * 100) / 100,
    monthly_payment: Math.round(monthlyPayment * 100) / 100,
  };
}
