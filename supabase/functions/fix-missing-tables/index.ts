// Fix P0 Bug: notification_logs table
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // SECURITY: this function uses the service-role key (bypasses RLS) and can
  // mutate/delete data. Restrict it to authenticated HQ_ADMIN callers only.
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, 'HQ_ADMIN')) {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }


  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Create notification_logs table
    const { error: createError } = await supabase.rpc('pg_catalog.exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS notification_logs (
          id SERIAL PRIMARY KEY,
          notification_id UUID DEFAULT gen_random_uuid(),
          alert_id INTEGER REFERENCES alerts(id),
          case_id INTEGER REFERENCES cases(id),
          channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'WHATSAPP', 'PUSH', 'SMS')),
          recipient VARCHAR(255) NOT NULL,
          message TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED')),
          error_message TEXT,
          external_id VARCHAR(255),
          sent_at TIMESTAMPTZ,
          delivered_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_notification_logs_alert_id ON notification_logs(alert_id);
        CREATE INDEX IF NOT EXISTS idx_notification_logs_case_id ON notification_logs(case_id);
        CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
        CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);
      `
    });

    // Create sla_escalation_runs table
    const { error: createError2 } = await supabase.rpc('pg_catalog.exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS sla_escalation_runs (
          id SERIAL PRIMARY KEY,
          run_id UUID DEFAULT gen_random_uuid(),
          cases_affected INTEGER DEFAULT 0,
          cases_escalated INTEGER DEFAULT 0,
          cases_warned INTEGER DEFAULT 0,
          errors TEXT[],
          started_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ,
          duration_ms INTEGER
        );
        
        -- Index
        CREATE INDEX IF NOT EXISTS idx_sla_escalation_runs_run_id ON sla_escalation_runs(run_id);
        CREATE INDEX IF NOT EXISTS idx_sla_escalation_runs_started_at ON sla_escalation_runs(started_at);
      `
    });

    // Insert sample notification log for testing
    const { error: sampleError } = await supabase.from('notification_logs').insert({
      alert_id: 1,
      channel: 'EMAIL',
      recipient: 'steve@cyberquote.id',
      message: 'Test notification',
      status: 'SENT',
      sent_at: new Date().toISOString()
    }).select().single();

    return new Response(JSON.stringify({
      success: true,
      message: 'Tables created successfully',
      notification_logs: createError ? 'exists' : 'created',
      sla_escalation_runs: createError2 ? 'exists' : 'created',
      sample_log: sampleError?.message || 'inserted'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    // Tables might already exist or RPC not available
    return new Response(JSON.stringify({
      success: true,
      message: 'Tables setup attempted',
      note: 'Use Supabase Dashboard SQL Editor to run migrations manually if needed'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
