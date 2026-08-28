/// <reference lib="deno" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =====================================================
// ROYALTY PAYMENT TRACKER
// Tracks royalty payments and detects overdue
// =====================================================

interface PaymentStatus {
  franchisee_id: string;
  franchisee_name: string;
  current_period: string;
  amount_due: number;
  amount_paid: number;
  days_overdue: number;
  status: "CURRENT" | "DUE" | "OVERDUE";
  last_payment_date: string | null;
  alert_sent: boolean;
  overdue_history: OverdueRecord[];
}

interface OverdueRecord {
  period: string;
  amount: number;
  days_overdue: number;
  alert_sent: boolean;
}

// =====================================================
// CHECK OVERDUE PAYMENTS
// =====================================================

async function checkOverduePayments(): Promise<PaymentStatus[]> {
  const results: PaymentStatus[] = [];
  const today = new Date();

  // Get all unpaid/overdue calculations
  const { data: overdueCalcs } = await supabase
    .from("royalty_calculations")
    .select(`
      id,
      franchisee_id,
      period_month,
      royalty_amount,
      status,
      royalty_agreements (
        payment_terms_days
      )
    `)
    .in("status", ["CALCULATED", "INVOICED"])
    .order("period_month", { ascending: true });

  if (!overdueCalcs) return results;

  for (const calc of overdueCalcs) {
    // Calculate due date based on payment terms
    const termsDays = calc.royalty_agreements?.payment_terms_days || 30;
    const periodEnd = new Date(calc.period_month);
    periodEnd.setDate(periodEnd.getDate() + termsDays);
    
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Check if payment was made
    const { data: payment } = await supabase
      .from("royalty_payments")
      .select("payment_date, amount")
      .eq("royalty_calculation_id", calc.id)
      .eq("status", "PAID")
      .single();

    // Get franchisee info
    const { data: franchisee } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", calc.franchisee_id)
      .single();

    // Check if alert already sent for this period
    const { data: existingAlert } = await supabase
      .from("royalty_alerts")
      .select("id")
      .eq("franchisee_id", calc.franchisee_id)
      .eq("royalty_calculation_id", calc.id)
      .eq("alert_type", "PAYMENT_OVERDUE")
      .single();

    const status: PaymentStatus = {
      franchisee_id: calc.franchisee_id,
      franchisee_name: franchisee?.full_name || franchisee?.email || "Unknown",
      current_period: calc.period_month,
      amount_due: calc.royalty_amount,
      amount_paid: payment?.amount || 0,
      days_overdue: daysOverdue,
      status: daysOverdue > 0 ? "OVERDUE" : daysOverdue > -7 ? "DUE" : "CURRENT",
      last_payment_date: payment?.payment_date || null,
      alert_sent: !!existingAlert,
      overdue_history: [],
    };

    results.push(status);

    // Create alert if overdue and no alert sent
    if (daysOverdue > 0 && !existingAlert) {
      await createOverdueAlert(calc, franchisee, daysOverdue);
    }
  }

  return results;
}

async function createOverdueAlert(
  calc: any,
  franchisee: any,
  daysOverdue: number
) {
  const severity = daysOverdue > 30 ? "CRITICAL" : daysOverdue > 14 ? "HIGH" : "WARNING";
  
  await supabase.from("royalty_alerts").insert({
    franchisee_id: calc.franchisee_id,
    royalty_calculation_id: calc.id,
    alert_type: "PAYMENT_OVERDUE",
    severity,
    title: `Royalty Payment Overdue - ${daysOverdue} days`,
    description: `${franchisee?.full_name || "Franchisee"} has overdue royalty payment of S$${calc.royalty_amount.toFixed(2)} for ${calc.period_month}. Payment is ${daysOverdue} days overdue.`,
    context: {
      amount: calc.royalty_amount,
      period: calc.period_month,
      days_overdue: daysOverdue,
    },
    status: "OPEN",
    created_by: "royalty-payment-tracker",
  });
}

// =====================================================
// RECORD PAYMENT
// =====================================================

async function recordPayment(
  franchiseeId: string,
  calculationId: string,
  amount: number,
  paymentMethod: string,
  paymentDate: string,
  reference?: string
) {
  // Get the calculation
  const { data: calc } = await supabase
    .from("royalty_calculations")
    .select("*")
    .eq("id", calculationId)
    .single();

  if (!calc) {
    return { success: false, error: "Calculation not found" };
  }

  // Create payment record
  const { data: payment, error: paymentError } = await supabase
    .from("royalty_payments")
    .insert({
      royalty_calculation_id: calculationId,
      royalty_agreement_id: calc.royalty_agreement_id,
      franchisee_id: franchiseeId,
      amount: calc.royalty_amount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      reference_number: reference,
      period_month: calc.period_month,
      status: amount >= calc.royalty_amount ? "PAID" : "PARTIAL",
      amount_paid: amount,
      payment_history: JSON.stringify([{
        date: paymentDate,
        amount,
        method: paymentMethod,
        reference,
      }]),
    })
    .select()
    .single();

  if (paymentError) {
    return { success: false, error: paymentError.message };
  }

  // Update calculation status
  await supabase
    .from("royalty_calculations")
    .update({ status: amount >= calc.royalty_amount ? "PAID" : "INVOICED" })
    .eq("id", calculationId);

  // Update invoice status if exists
  if (calc.invoice_id) {
    await supabase
      .from("royalty_invoices")
      .update({
        status: amount >= calc.royalty_amount ? "PAID" : "PARTIAL",
        amount_paid: amount,
        paid_date: paymentDate,
        payment_reference: reference,
      })
      .eq("id", calc.invoice_id);
  }

  return { success: true, payment_id: payment.id };
}

// =====================================================
// GET PAYMENT HISTORY
// =====================================================

async function getPaymentHistory(franchiseeId: string, limit: number = 12) {
  const { data: payments, error } = await supabase
    .from("royalty_payments")
    .select(`
      *,
      royalty_calculations (
        period_month,
        royalty_amount,
        effective_rate
      )
    `)
    .eq("franchisee_id", franchiseeId)
    .order("payment_date", { ascending: false })
    .limit(limit);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, payments };
}

// =====================================================
// GET PORTFOLIO SUMMARY
// =====================================================

async function getPortfolioSummary() {
  // Get current month calculations
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  
  const { data: calculations } = await supabase
    .from("royalty_calculations")
    .select(`
      status,
      royalty_amount,
      effective_rate,
      franchisee_id
    `)
    .gte("period_month", currentMonth);

  const summary = {
    total_franchisees: 0,
    total_royalty_expected: 0,
    total_paid: 0,
    total_overdue: 0,
    collection_rate: 0,
    by_status: {} as Record<string, { count: number; amount: number }>,
    by_rate_band: {} as Record<string, { count: number; amount: number }>,
  };

  if (!calculations) return summary;

  const franchisees = new Set<string>();
  
  for (const calc of calculations) {
    franchisees.add(calc.franchisee_id);
    
    summary.total_royalty_expected += calc.royalty_amount;
    
    // By status
    const status = calc.status;
    if (!summary.by_status[status]) {
      summary.by_status[status] = { count: 0, amount: 0 };
    }
    summary.by_status[status].count++;
    summary.by_status[status].amount += calc.royalty_amount;

    // By rate band
    const rateBand = getRateBand(calc.effective_rate);
    if (!summary.by_rate_band[rateBand]) {
      summary.by_rate_band[rateBand] = { count: 0, amount: 0 };
    }
    summary.by_rate_band[rateBand].count++;
    summary.by_rate_band[rateBand].amount += calc.royalty_amount;

    // Calculate paid/overdue
    if (calc.status === "PAID") {
      summary.total_paid += calc.royalty_amount;
    } else if (calc.status === "OVERDUE" || calc.status === "CALCULATED") {
      summary.total_overdue += calc.royalty_amount;
    }
  }

  summary.total_franchisees = franchisees.size;
  summary.collection_rate = summary.total_royalty_expected > 0
    ? Math.round((summary.total_paid / summary.total_royalty_expected) * 100)
    : 0;

  return summary;
}

function getRateBand(rate: number): string {
  if (rate <= 0.042) return "Excellent (≤4.2%)";
  if (rate <= 0.051) return "Good (4.3-5.1%)";
  if (rate <= 0.060) return "Average (5.2-6.0%)";
  if (rate <= 0.078) return "Below Average (6.1-7.8%)";
  if (rate <= 0.100) return "Struggling (7.9-10%)";
  return "Watchlist (>10%)";
}

// =====================================================
// HTTP HANDLER
// =====================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // GET /royalty-payment-tracker - Check overdue payments
    if (req.method === "GET" && path === "royalty-payment-tracker") {
      const overdue = await checkOverduePayments();
      return new Response(JSON.stringify({
        checked_at: new Date().toISOString(),
        overdue_count: overdue.filter(o => o.status === "OVERDUE").length,
        due_count: overdue.filter(o => o.status === "DUE").length,
        overdue_payments: overdue,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /summary - Portfolio summary
    if (req.method === "GET" && path === "summary") {
      const summary = await getPortfolioSummary();
      return new Response(JSON.stringify(summary), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /history - Payment history for a franchisee
    if (req.method === "GET" && url.searchParams.get("franchisee_id")) {
      const franchiseeId = url.searchParams.get("franchisee_id")!;
      const limit = parseInt(url.searchParams.get("limit") || "12");
      const result = await getPaymentHistory(franchiseeId, limit);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /record-payment - Record a payment
    if (req.method === "POST") {
      const body = await req.json();
      const { franchisee_id, calculation_id, amount, payment_method, payment_date, reference } = body;

      if (!franchisee_id || !calculation_id || !amount || !payment_method || !payment_date) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Missing required fields" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await recordPayment(
        franchisee_id,
        calculation_id,
        amount,
        payment_method,
        payment_date,
        reference
      );

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in royalty-payment-tracker:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
