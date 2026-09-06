/// <reference lib="deno.ns" />

/**
 * Repayment Risk Scorer Edge Function
 *
 * Calculates risk scores for financing applications based on repayment history.
 * Triggered by repayment events from lender-bridge webhook.
 *
 * POST /functions/v1/repayment-risk-scorer
 *
 * Body: { application_id: string }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Risk level thresholds
const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const RISK_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 80,
  CRITICAL: 100
};

// Weight factors for risk calculation
const WEIGHTS = {
  delinquency: 0.5,
  paymentTiming: 0.3,
  affordability: 0.2
};

interface RiskScoreResult {
  payment_timing_score: number;
  delinquency_score: number;
  affordability_score: number;
  overall_risk_score: number;
  risk_level: string;
  risk_factors: string[];
  triggering_events: string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const applicationId = body.application_id;

    if (!applicationId) {
      return new Response(JSON.stringify({
        success: false,
        error: "application_id is required"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get application details
    const { data: application, error: appError } = await supabase
      .from('financing_applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError || !application) {
      return new Response(JSON.stringify({
        success: false,
        error: "Application not found"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get recent repayment events (last 90 days)
    // 2. Get recent repayment events (last 90 days)
    // FIX 1.1: Use created_at instead of received_at (column name correction)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const { data: recentEvents } = await supabase
      .from('repayment_events')
      .select('*')
      .eq('application_id', applicationId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    // 3. Get payment history from repayment_schedule
    const { data: paymentHistory } = await supabase
      .from('repayment_schedule')
      .select('*')
      .eq('application_id', applicationId)
      .order('emi_number', { ascending: false });

    // 4. Get previous risk score (if exists)
    const { data: previousScore } = await supabase
      .from('application_risk_scores')
      .select('*')
      .eq('application_id', applicationId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Calculate risk scores
    const riskResult = calculateRiskScores(
      recentEvents || [],
      paymentHistory || [],
      previousScore
    );

    // 6. Store new risk score
    const { data: savedScore, error: saveError } = await supabase
      .from('application_risk_scores')
      .insert({
        application_id: applicationId,
        payment_timing_score: riskResult.payment_timing_score,
        delinquency_score: riskResult.delinquency_score,
        affordability_score: riskResult.affordability_score,
        overall_risk_score: riskResult.overall_risk_score,
        risk_level: riskResult.risk_level,
        risk_factors: riskResult.risk_factors,
        triggering_events: riskResult.triggering_events,
        computation_method: 'RULE_BASED',
        notes: `Triggered by ${(recentEvents || []).length} recent events`,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save risk score:', saveError);
      throw saveError;
    }

    // 7. Check for escalation and trigger alert if needed
    if (previousScore && shouldTriggerEscalationAlert(previousScore.risk_level, riskResult.risk_level)) {
      try {
        await supabase.functions.invoke('repayment-alert-generator', {
          body: {
            application_id: applicationId,
            franchisee_id: application.franchisee_id,
            outlet_id: application.outlet_id,
            event_type: 'RISK_ESCALATION',
            severity: riskResult.risk_level,
            message: `Risk level escalated from ${previousScore.risk_level} to ${riskResult.risk_level}`,
            previous_level: previousScore.risk_level,
          }
        });
      } catch (e) {
        console.error('Failed to trigger escalation alert:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      application_id: applicationId,
      risk_score: savedScore,
      previous_risk_level: previousScore?.risk_level || null,
      current_risk_level: riskResult.risk_level,
      escalation_triggered: previousScore ? shouldTriggerEscalationAlert(previousScore.risk_level, riskResult.risk_level) : false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Repayment Risk Scorer Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Internal server error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Calculate risk scores based on repayment history.
 */
function calculateRiskScores(
  recentEvents: any[],
  paymentHistory: any[],
  previousScore: any | null
): RiskScoreResult {

  // 1. Payment Timing Score (0-100, higher is better)
  const totalPayments = paymentHistory.filter(p => ['PAID', 'PARTIAL'].includes(p.status));
  const onTimePayments = totalPayments.filter(p => (p.days_overdue || 0) <= 0);
  
  // FIX 1.4: No payment history = null (unknown), NOT 100 (perfect)
  // A new franchisee with no history should NOT score as perfect
  let paymentTimingScore: number;
  if (totalPayments.length === 0) {
    paymentTimingScore = null as any; // Unknown - no history
  } else {
    paymentTimingScore = (onTimePayments.length / totalPayments.length) * 100;
  }

  // 2. Delinquency Score (0-100, higher is worse)
  const overdueEvents = recentEvents.filter(e =>
    ['EMI_OVERDUE', 'DELINQUENCY_STARTED', 'DEFAULT_NOTICE'].includes(e.event_type)
  );
  const maxDaysOverdue = Math.max(0, ...overdueEvents.map(e => e.days_overdue || 0));

  let delinquencyScore = 0;
  if (maxDaysOverdue > 60) delinquencyScore = 100;
  else if (maxDaysOverdue > 30) delinquencyScore = 75;
  else if (maxDaysOverdue > 15) delinquencyScore = 50;
  else if (maxDaysOverdue > 7) delinquencyScore = 35;
  else if (maxDaysOverdue > 0) delinquencyScore = 20;

  // 3. Affordability Score (0-100, higher is better)
  // Based on frequency of missed/late payments
  const recentMissed = recentEvents.filter(e =>
    ['EMI_OVERDUE', 'DELINQUENCY_STARTED'].includes(e.event_type)
  ).length;

  const affordabilityScore = Math.max(0, Math.min(100, 100 - (recentMissed * 25)));

  // 4. Overall Risk Score (weighted average)
  // FIX 1.4: Handle null paymentTimingScore (no history)
  const paymentComponent = paymentTimingScore !== null 
    ? (100 - paymentTimingScore) * WEIGHTS.paymentTiming 
    : 0; // Unknown = neutral (no history to judge)
  
  const overallRiskScore = Math.round(
    (delinquencyScore * WEIGHTS.delinquency) +
    paymentComponent +
    ((100 - affordabilityScore) * WEIGHTS.affordability)
  );

  // 5. Risk Level
  let riskLevel = 'LOW';
  if (overallRiskScore >= RISK_THRESHOLDS.CRITICAL) riskLevel = 'CRITICAL';
  else if (overallRiskScore >= RISK_THRESHOLDS.HIGH) riskLevel = 'HIGH';
  else if (overallRiskScore >= RISK_THRESHOLDS.MEDIUM) riskLevel = 'MEDIUM';

  // 6. Risk Factors (for explainability)
  const riskFactors: string[] = [];

  if (delinquencyScore > 50) {
    riskFactors.push(`High delinquency (${delinquencyScore}% - ${maxDaysOverdue} days overdue)`);
  }
  
  // FIX 1.4: Handle null paymentTimingScore
  if (paymentTimingScore !== null && paymentTimingScore < 80) {
    riskFactors.push(`Late payment pattern (${Math.round(paymentTimingScore)}% on-time)`);
  } else if (paymentTimingScore === null) {
    riskFactors.push('No payment history (new borrower - cannot assess timing)');
  }
  
  if (affordabilityScore < 60) {
    riskFactors.push(`Payment difficulty detected (${Math.round(affordabilityScore)}% affordability score)`);
  }

  if (riskFactors.length === 0) {
    riskFactors.push('All payments on track');
  }

  // 7. Triggering events
  const triggeringEvents = recentEvents.slice(0, 5).map(e => e.event_type);

  return {
    payment_timing_score: paymentTimingScore !== null
      ? Math.round(paymentTimingScore * 100) / 100
      : null,
    delinquency_score: Math.round(delinquencyScore * 100) / 100,
    affordability_score: Math.round(affordabilityScore * 100) / 100,
    overall_risk_score: Math.round(overallRiskScore * 100) / 100,
    risk_level: riskLevel,
    risk_factors: riskFactors,
    triggering_events: triggeringEvents,
  };
}

/**
 * Check if an alert should be triggered for risk escalation.
 */
function shouldTriggerEscalationAlert(previousLevel: string | null, newLevel: string): boolean {
  if (!previousLevel) return false;

  const levelOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const prevIndex = levelOrder.indexOf(previousLevel);
  const newIndex = levelOrder.indexOf(newLevel);

  // Trigger if escalated to a higher level
  return newIndex > prevIndex;
}
