import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // SECURITY: this function uses the service-role key (bypasses RLS) and can
  // mutate/delete data. Restrict it to authenticated HQ_ADMIN callers only.
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, 'HQ_ADMIN')) {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  await supabase.from("ml_model_versions").delete().neq("id", 0);
  
  const models = [
    { model_name: "Anomaly Detection", version: "v2.1", model_type: "ANOMALY_DETECTION", description: "Z-score based anomaly detection", metrics: {"accuracy": 0.89, "precision": 0.92}, is_production: true },
    { model_name: "Stockout Risk", version: "v1.3", model_type: "STOCKOUT_PREDICTION", description: "Random Forest stockout prediction", metrics: {"accuracy": 0.91, "recall": 0.93}, is_production: true },
    { model_name: "Demand Forecasting", version: "v1.0", model_type: "DEMAND_FORECASTING", description: "Time series Prophet", metrics: {"mape": 0.12}, is_production: true },
    { model_name: "Churn Prediction", version: "v0.9", model_type: "CHURN_PREDICTION", description: "Customer churn analysis", metrics: {"accuracy": 0.85}, is_production: false },
  ];
  
  const { data, error } = await supabase.from("ml_model_versions").insert(models).select();
  
  return new Response(JSON.stringify({ success: true, seeded: data?.length || 0, error: error?.message || null }), {
    headers: { "Content-Type": "application/json" },
  });
});
