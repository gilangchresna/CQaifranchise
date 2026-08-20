// Apply cash flow tables migration
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await verifyAuth(req, true, false);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Create cash_flow_snapshots table
    const { error: snapshotError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.cash_flow_snapshots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
          snapshot_date DATE NOT NULL,
          source_type VARCHAR(20) NOT NULL DEFAULT 'EXCEL',
          source_file TEXT,
          total_balance DECIMAL(14,2),
          monthly_inflow DECIMAL(14,2) DEFAULT 0,
          monthly_outflow DECIMAL(14,2) DEFAULT 0,
          net_cash_flow DECIMAL(14,2) DEFAULT 0,
          transaction_count INTEGER DEFAULT 0,
          data_quality VARCHAR(20) DEFAULT 'MANUAL',
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    // Create cash_flow_transactions table
    const { error: txError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.cash_flow_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          snapshot_id UUID REFERENCES public.cash_flow_snapshots(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
          transaction_date DATE NOT NULL,
          description TEXT,
          amount DECIMAL(14,2) NOT NULL,
          category VARCHAR(50),
          category_detail VARCHAR(100),
          is_inflow BOOLEAN NOT NULL DEFAULT false,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    // Create indexes
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_cashflow_snapshots_user ON public.cash_flow_snapshots(user_id);
        CREATE INDEX IF NOT EXISTS idx_cashflow_snapshots_date ON public.cash_flow_snapshots(snapshot_date);
        CREATE INDEX IF NOT EXISTS idx_cashflow_transactions_snapshot ON public.cash_flow_transactions(snapshot_id);
        CREATE INDEX IF NOT EXISTS idx_cashflow_transactions_user ON public.cash_flow_transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_cashflow_transactions_date ON public.cash_flow_transactions(transaction_date);
      `
    });

    // Enable RLS
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.cash_flow_snapshots ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.cash_flow_transactions ENABLE ROW LEVEL SECURITY;
      `
    });

    // Create RLS policies
    await supabase.rpc('exec_sql', {
      sql: `
        DROP POLICY IF EXISTS "Users read own cashflow snapshots" ON public.cash_flow_snapshots;
        CREATE POLICY "Users read own cashflow snapshots"
          ON public.cash_flow_snapshots FOR SELECT
          TO authenticated
          USING (user_id = auth.uid());

        DROP POLICY IF EXISTS "Users insert own cashflow snapshots" ON public.cash_flow_snapshots;
        CREATE POLICY "Users insert own cashflow snapshots"
          ON public.cash_flow_snapshots FOR INSERT
          TO authenticated
          WITH CHECK (user_id = auth.uid());

        DROP POLICY IF EXISTS "Users read own cashflow transactions" ON public.cash_flow_transactions;
        CREATE POLICY "Users read own cashflow transactions"
          ON public.cash_flow_transactions FOR SELECT
          TO authenticated
          USING (user_id = auth.uid());

        DROP POLICY IF EXISTS "Users insert own cashflow transactions" ON public.cash_flow_transactions;
        CREATE POLICY "Users insert own cashflow transactions"
          ON public.cash_flow_transactions FOR INSERT
          TO authenticated
          WITH CHECK (user_id = auth.uid());

        DROP POLICY IF EXISTS "Admin read all cashflow snapshots" ON public.cash_flow_snapshots;
        CREATE POLICY "Admin read all cashflow snapshots"
          ON public.cash_flow_snapshots FOR SELECT
          TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.user_profiles
              WHERE id = auth.uid() AND role = 'HQ_ADMIN'
            )
          );

        DROP POLICY IF EXISTS "Admin read all cashflow transactions" ON public.cash_flow_transactions;
        CREATE POLICY "Admin read all cashflow transactions"
          ON public.cash_flow_transactions FOR SELECT
          TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.user_profiles
              WHERE id = auth.uid() AND role = 'HQ_ADMIN'
            )
          );
      `
    });

    // Verify tables exist
    const { data: verifyData } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['cash_flow_snapshots', 'cash_flow_transactions']);

    return new Response(JSON.stringify({
      success: true,
      message: "Cash flow tables created successfully",
      tables: verifyData
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error creating cash flow tables:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
