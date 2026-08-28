/// <reference lib="deno" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase clients
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =====================================================
// ROYALTY CALCULATOR EDGE FUNCTION
// Calculates performance-based royalty for franchisees
// =====================================================

interface RoyaltyInput {
  franchisee_id?: string;
  period_month?: string; // YYYY-MM format
  force_recalculate?: boolean;
}

interface RoyaltyResult {
  success: boolean;
  franchisee_id: string;
  period_month: string;
  gross_revenue: number;
  base_rate: number;
  effective_rate: number;
  royalty_amount: number;
  flat_royalty_amount: number;
  savings_vs_flat: number;
  adjustments: {
    score_multiplier: number;
    tier_adjustment: number;
    growth_modifier: number;
    compliance_adjustment: number;
  };
  inputs: {
    risk_score: number | null;
    risk_band: string | null;
    yoy_growth: number | null;
    compliance_score: number | null;
  };
  breakdown_summary: string;
  status: string;
  message?: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get score multiplier from risk score
 */
function getScoreMultiplier(score: number): number {
  if (score >= 90) return 0.70;
  if (score >= 80) return 0.85;
  if (score >= 70) return 1.00;
  if (score >= 60) return 1.15;
  if (score >= 50) return 1.30;
  if (score >= 40) return 1.50;
  return 2.00; // Watchlist
}

/**
 * Get tier adjustment from monthly revenue
 */
function getTierAdjustment(revenue: number): number {
  if (revenue >= 60000) return -0.005; // -0.5%
  if (revenue >= 40000) return -0.005; // -0.5%
  if (revenue >= 20000) return 0.000;
  return 0.005; // +0.5% for small outlets
}

/**
 * Get growth modifier from YoY growth
 */
function getGrowthModifier(growth: number): number {
  if (growth > 0.30) return -0.020; // >30% growth: -2%
  if (growth > 0.20) return -0.010; // >20% growth: -1%
  if (growth > 0.10) return -0.005; // >10% growth: -0.5%
  if (growth >= 0) return 0.000;    // 0-10%: standard
  if (growth > -0.10) return 0.005; // slight decline: +0.5%
  return 0.010; // significant decline: +1%
}

/**
 * Get compliance adjustment from compliance score (0-1)
 */
function getComplianceAdjustment(compliance: number): number {
  if (compliance >= 0.95) return -0.010; // -1%
  if (compliance >= 0.85) return -0.005; // -0.5%
  if (compliance >= 0.70) return 0.000;
  if (compliance >= 0.50) return 0.005; // +0.5%
  return 0.010; // <50%: +1%
}

/**
 * Get tier label for display
 */
function getTierLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Average";
  if (score >= 60) return "Below Average";
  if (score >= 40) return "Struggling";
  return "Watchlist";
}

/**
 * Get revenue tier label
 */
function getRevenueTierLabel(revenue: number): string {
  if (revenue >= 60000) return "Super-grower (S$60K+)";
  if (revenue >= 40000) return "Large outlet (S$40K-60K)";
  if (revenue >= 20000) return "Medium outlet (S$20K-40K)";
  if (revenue >= 10000) return "Small outlet (S$10K-20K)";
  return "Minimum outlet (<S$10K)";
}

/**
 * Calculate effective royalty rate
 */
function calculateEffectiveRate(
  baseRate: number,
  riskScore: number | null,
  revenue: number,
  yoyGrowth: number | null,
  complianceScore: number | null,
  enabledComponents: {
    score: boolean;
    tier: boolean;
    growth: boolean;
    compliance: boolean;
  }
): {
  effectiveRate: number;
  scoreMultiplier: number;
  scoreAdjustment: number;
  tierAdjustment: number;
  growthModifier: number;
  complianceAdjustment: number;
} {
  // Default values if inputs are null
  const score = riskScore ?? 70;
  const growth = yoyGrowth ?? 0;
  const compliance = complianceScore ?? 0.80;

  // Get multipliers
  const scoreMultiplier = getScoreMultiplier(score);
  const tierAdj = getTierAdjustment(revenue);
  const growthMod = getGrowthModifier(growth);
  const complianceAdj = getComplianceAdjustment(compliance);

  // Calculate base adjustment from score (rate × multiplier - base rate)
  const scoreAdjustment = (baseRate * scoreMultiplier) - baseRate;

  // Combine adjustments
  let effectiveRate = baseRate;

  if (enabledComponents.score) {
    effectiveRate += scoreAdjustment;
  }
  if (enabledComponents.tier) {
    effectiveRate += tierAdj;
  }
  if (enabledComponents.growth) {
    effectiveRate += growthMod;
  }
  if (enabledComponents.compliance) {
    effectiveRate += complianceAdj;
  }

  // Cap at reasonable limits (1% - 15%)
  effectiveRate = Math.max(0.01, Math.min(0.15, effectiveRate));

  return {
    effectiveRate: Math.round(effectiveRate * 10000) / 10000, // Round to 4 decimals
    scoreMultiplier,
    scoreAdjustment: Math.round(scoreAdjustment * 10000) / 10000,
    tierAdjustment: tierAdj,
    growthModifier: growthMod,
    complianceAdjustment: complianceAdj,
  };
}

/**
 * Get monthly gross revenue for a franchisee
 */
async function getMonthlyRevenue(
  franchiseeId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("outlet_id", franchiseeId) // Using user_id as outlet_id for now
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  if (error || !data) {
    console.log("No transaction data, using estimated revenue");
    // Fallback: estimate from outlet data or return 0
    return 0;
  }

  return data.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
}

/**
 * Get risk score for franchisee
 */
async function getRiskScore(franchiseeId: string): Promise<{
  score: number | null;
  band: string | null;
}> {
  // Try to get from application_risk_scores
  const { data } = await supabase
    .from("application_risk_scores")
    .select("risk_score, risk_band")
    .eq("user_id", franchiseeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (data) {
    return { score: data.risk_score, band: data.risk_band };
  }

  // Fallback: calculate from repayment history
  const { data: repayments } = await supabase
    .from("repayment_events")
    .select("days_overdue")
    .eq("user_id", franchiseeId)
    .order("due_date", { ascending: false })
    .limit(12);

  if (repayments && repayments.length > 0) {
    const avgDaysOverdue =
      repayments.reduce((sum: number, r: any) => sum + Math.max(0, r.days_overdue || 0), 0) /
      repayments.length;
    
    // Convert to score (lower overdue = higher score)
    const score = Math.max(30, Math.min(100, 100 - avgDaysOverdue * 2));
    const band = getTierLabel(score);
    
    return { score, band };
  }

  return { score: null, band: null };
}

/**
 * Get YoY growth for franchisee
 */
async function getYoYGrowth(franchiseeId: string, periodMonth: Date): Promise<number | null> {
  // Compare this month vs same month last year
  const lastYearStart = new Date(periodMonth);
  lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
  const lastYearEnd = new Date(lastYearStart);
  lastYearEnd.setMonth(lastYearEnd.getMonth() + 1);

  // This year's revenue (simplified - would need real transaction data)
  // For MVP, we can estimate from outlet performance
  const { data: outlets } = await supabase
    .from("outlets")
    .select("monthly_target, monthly_actual")
    .eq("user_id", franchiseeId)
    .limit(1);

  if (outlets && outlets.length > 0) {
    const target = outlets[0].monthly_target || 50000;
    const actual = outlets[0].monthly_actual || target;
    
    // Estimate growth from target achievement
    const achievementRate = actual / target;
    
    // Convert to YoY estimate (simplified)
    // If consistently hitting 100%+ target, assume positive growth
    return Math.max(-0.2, Math.min(0.4, (achievementRate - 0.9)));
  }

  return null;
}

/**
 * Get compliance score for franchisee
 */
async function getComplianceScore(franchiseeId: string): Promise<number | null> {
  // Check for compliance/audit records
  const { data: audits } = await supabase
    .from("audit_results")
    .select("score")
    .eq("franchisee_id", franchiseeId)
    .order("audit_date", { ascending: false })
    .limit(1)
    .single();

  if (audits && audits.score !== null) {
    return audits.score / 100; // Convert to 0-1 scale
  }

  // Fallback: check if franchisee has completed required tasks
  const { count } = await supabase
    .from("cases")
    .select("*", { count: "exact", head: true })
    .eq("user_id", franchiseeId)
    .eq("status", "RESOLVED");

  // Estimate compliance based on case resolution
  if (count !== null) {
    return Math.min(0.95, 0.60 + (count || 0) * 0.02);
  }

  return null;
}

/**
 * Generate plain language breakdown
 */
function generateBreakdownSummary(
  franchiseeName: string,
  grossRevenue: number,
  baseRate: number,
  effectiveRate: number,
  riskScore: number | null,
  revenueTierLabel: string,
  yoyGrowth: number | null,
  complianceScore: number | null
): string {
  const parts: string[] = [];
  
  parts.push(`${franchiseeName} earned S$${grossRevenue.toLocaleString()} in gross revenue.`);
  
  parts.push(`Based on a base royalty rate of ${(baseRate * 100).toFixed(1)}%, ` +
    `your effective rate is ${(effectiveRate * 100).toFixed(1)}%.`);
  
  if (riskScore !== null) {
    parts.push(`Your risk score of ${riskScore} qualifies you for a ` +
      `${effectiveRate < baseRate ? "discount" : "premium"} adjustment.`);
  }
  
  if (yoyGrowth !== null) {
    const growthLabel = yoyGrowth > 0.20 ? "strong growth" : 
                        yoyGrowth > 0 ? "positive growth" : 
                        yoyGrowth < -0.10 ? "declining sales" : "stable sales";
    parts.push(`Your ${growthLabel} (${(yoyGrowth * 100).toFixed(0)}% YoY) also affects your rate.`);
  }
  
  if (complianceScore !== null) {
    parts.push(`Your compliance score of ${(complianceScore * 100).toFixed(0)}% is factored into the calculation.`);
  }
  
  return parts.join(" ");
}

// =====================================================
// MAIN HANDLER
// =====================================================

async function calculateRoyalty(input: RoyaltyInput): Promise<RoyaltyResult> {
  const {
    franchisee_id,
    period_month,
    force_recalculate = false
  } = input;

  // Default to current month if not specified
  const periodDate = period_month 
    ? new Date(period_month + "-01") 
    : new Date();
  
  const periodStart = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
  const periodEnd = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0);
  const periodMonthStr = periodDate.toISOString().slice(0, 7);

  // Get franchisee info
  const { data: franchisee, error: franchiseeError } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("id", franchisee_id)
    .single();

  if (franchiseeError || !franchisee) {
    return {
      success: false,
      franchisee_id: franchisee_id || "",
      period_month: periodMonthStr,
      gross_revenue: 0,
      base_rate: 0.06,
      effective_rate: 0,
      royalty_amount: 0,
      flat_royalty_amount: 0,
      savings_vs_flat: 0,
      adjustments: {
        score_multiplier: 1,
        tier_adjustment: 0,
        growth_modifier: 0,
        compliance_adjustment: 0,
      },
      inputs: {
        risk_score: null,
        risk_band: null,
        yoy_growth: null,
        compliance_score: null,
      },
      breakdown_summary: "Franchisee not found",
      status: "ERROR",
    };
  }

  // Check if calculation already exists
  if (!force_recalculate) {
    const { data: existing } = await supabase
      .from("royalty_calculations")
      .select("id")
      .eq("franchisee_id", franchisee_id)
      .eq("period_month", periodStart.toISOString().split("T")[0])
      .single();

    if (existing) {
      return {
        success: false,
        franchisee_id,
        period_month: periodMonthStr,
        gross_revenue: 0,
        base_rate: 0.06,
        effective_rate: 0,
        royalty_amount: 0,
        flat_royalty_amount: 0,
        savings_vs_flat: 0,
        adjustments: {
          score_multiplier: 1,
          tier_adjustment: 0,
          growth_modifier: 0,
          compliance_adjustment: 0,
        },
        inputs: {
          risk_score: null,
          risk_band: null,
          yoy_growth: null,
          compliance_score: null,
        },
        breakdown_summary: "Calculation already exists for this period",
        status: "EXISTS",
      };
    }
  }

  // Get royalty agreement settings
  const { data: agreement } = await supabase
    .from("royalty_agreements")
    .select("*")
    .eq("franchisee_id", franchisee_id)
    .eq("is_active", true)
    .lte("effective_from", periodStart.toISOString().split("T")[0])
    .or(`effective_to.is.null,effective_to.gte.${periodStart.toISOString().split("T")[0]}`)
    .single();

  // Use defaults if no agreement exists
  const baseRate = agreement?.base_rate || 0.06;
  const formulaType = agreement?.formula_type || "COMBINED";
  const enabledComponents = {
    score: agreement?.score_multiplier_enabled ?? true,
    tier: agreement?.tier_adjustment_enabled ?? true,
    growth: agreement?.growth_modifier_enabled ?? true,
    compliance: agreement?.compliance_adjustment_enabled ?? true,
  };

  // Get inputs
  const [revenue, riskData, yoyGrowth, complianceScore] = await Promise.all([
    getMonthlyRevenue(franchisee_id, periodStart, periodEnd),
    getRiskScore(franchisee_id),
    getYoYGrowth(franchisee_id, periodDate),
    getComplianceScore(franchisee_id),
  ]);

  // Use estimated revenue if no transaction data
  const grossRevenue = revenue > 0 ? revenue : (franchisee as any).estimated_revenue || 30000;

  // Calculate effective rate
  const {
    effectiveRate,
    scoreMultiplier,
    scoreAdjustment,
    tierAdjustment,
    growthModifier,
    complianceAdjustment,
  } = calculateEffectiveRate(
    baseRate,
    riskData.score,
    grossRevenue,
    yoyGrowth,
    complianceScore,
    enabledComponents
  );

  // Calculate amounts
  const royaltyAmount = Math.round(grossRevenue * effectiveRate * 100) / 100;
  const flatRoyaltyAmount = Math.round(grossRevenue * 0.06 * 100) / 100;
  const savingsVsFlat = flatRoyaltyAmount - royaltyAmount;
  const marketingFundAmount = Math.round(grossRevenue * 0.02 * 100) / 100;
  const totalFees = royaltyAmount + marketingFundAmount;

  // Generate breakdown summary
  const revenueTierLabel = getRevenueTierLabel(grossRevenue);
  const breakdownSummary = generateBreakdownSummary(
    franchisee.full_name || franchisee.email,
    grossRevenue,
    baseRate,
    effectiveRate,
    riskData.score,
    revenueTierLabel,
    yoyGrowth,
    complianceScore
  );

  // Save calculation
  const { data: savedCalculation, error: saveError } = await supabase
    .from("royalty_calculations")
    .insert({
      franchisee_id,
      period_month: periodStart.toISOString().split("T")[0],
      period_start: periodStart.toISOString().split("T")[0],
      period_end: periodEnd.toISOString().split("T")[0],
      gross_revenue: grossRevenue,
      revenue_currency: "SGD",
      risk_score: riskData.score,
      risk_band: riskData.band,
      yoy_growth: yoyGrowth,
      compliance_score: complianceScore,
      score_multiplier: scoreMultiplier,
      score_adjustment: scoreAdjustment,
      tier_adjustment: tierAdjustment,
      growth_modifier: growthModifier,
      compliance_adjustment: complianceAdjustment,
      base_rate_used: baseRate,
      effective_rate: effectiveRate,
      royalty_amount: royaltyAmount,
      marketing_fund_amount: marketingFundAmount,
      total_fees: totalFees,
      flat_royalty_amount: flatRoyaltyAmount,
      savings_vs_flat: savingsVsFlat,
      breakdown_summary: breakdownSummary,
      status: "CALCULATED",
      calculated_by: "royalty-calculator",
    })
    .select()
    .single();

  if (saveError) {
    console.error("Error saving calculation:", saveError);
  }

  return {
    success: true,
    franchisee_id,
    period_month: periodMonthStr,
    gross_revenue: grossRevenue,
    base_rate: baseRate,
    effective_rate: effectiveRate,
    royalty_amount: royaltyAmount,
    flat_royalty_amount: flatRoyaltyAmount,
    savings_vs_flat: savingsVsFlat,
    adjustments: {
      score_multiplier: scoreMultiplier,
      tier_adjustment: tierAdjustment,
      growth_modifier: growthModifier,
      compliance_adjustment: complianceAdjustment,
    },
    inputs: {
      risk_score: riskData.score,
      risk_band: riskData.band,
      yoy_growth: yoyGrowth,
      compliance_score: complianceScore,
    },
    breakdown_summary: breakdownSummary,
    status: "CALCULATED",
    message: formulaType === "COMBINED" 
      ? "Calculated using COMBINED formula" 
      : `Calculated using ${formulaType} formula`,
  };
}

// =====================================================
// HTTP HANDLER
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const method = req.method;

    // GET: Calculate royalty for a franchisee
    if (method === "GET") {
      const franchiseeId = url.searchParams.get("franchisee_id");
      const periodMonth = url.searchParams.get("period_month");

      if (!franchiseeId) {
        return new Response(
          JSON.stringify({ error: "franchisee_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await calculateRoyalty({
        franchisee_id: franchiseeId,
        period_month: periodMonth || undefined,
      });

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Bulk calculate for all franchisees
    if (method === "POST") {
      const body = await req.json();
      const { franchisee_ids, period_month, force_recalculate } = body;

      if (franchisee_ids && Array.isArray(franchisee_ids)) {
        // Bulk calculation
        const results = await Promise.all(
          franchisee_ids.map((id: string) =>
            calculateRoyalty({
              franchisee_id: id,
              period_month: period_month || undefined,
              force_recalculate: force_recalculate || false,
            })
          )
        );

        const successful = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        return new Response(
          JSON.stringify({
            total: results.length,
            successful,
            failed,
            results,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Single calculation
      const result = await calculateRoyalty(body);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in royalty-calculator:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
