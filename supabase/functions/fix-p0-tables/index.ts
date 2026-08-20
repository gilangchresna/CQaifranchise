// Fix P0: Create royalty_payments and debt_obligations tables
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  // SECURITY: service-role only
  const auth = await verifyAuth(req, true);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }
  if (auth.role !== 'HQ_ADMIN' && auth.role !== 'SERVICE_ROLE') {
    return new Response(JSON.stringify({ error: 'HQ_ADMIN role required' }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Create royalty_payments table
    const { error: royaltyError } = await supabase.rpc('pg_catalog.exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.royalty_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          franchisee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
          outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
          payment_date DATE NOT NULL,
          due_date DATE NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'SGD',
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
          days_past_due INTEGER DEFAULT 0,
          payment_method VARCHAR(20),
          reference_number VARCHAR(100),
          period VARCHAR(10),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_royalty_franchisee ON public.royalty_payments(franchisee_id);
        CREATE INDEX IF NOT EXISTS idx_royalty_outlet ON public.royalty_payments(outlet_id);
        CREATE INDEX IF NOT EXISTS idx_royalty_status ON public.royalty_payments(status);
        CREATE INDEX IF NOT EXISTS idx_royalty_date ON public.royalty_payments(payment_date DESC);
      `
    });

    // Create debt_obligations table
    const { error: debtError } = await supabase.rpc('pg_catalog.exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.debt_obligations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          franchisee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
          outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
          creditor_name VARCHAR(200) NOT NULL,
          creditor_type VARCHAR(50),
          debt_type VARCHAR(50),
          outstanding_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          original_amount DECIMAL(12,2),
          currency VARCHAR(3) DEFAULT 'SGD',
          interest_rate DECIMAL(5,2),
          monthly_payment DECIMAL(12,2),
          remaining_term_months INTEGER,
          maturity_date DATE,
          status VARCHAR(20) DEFAULT 'ACTIVE',
          next_payment_date DATE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_debt_franchisee ON public.debt_obligations(franchisee_id);
        CREATE INDEX IF NOT EXISTS idx_debt_outlet ON public.debt_obligations(outlet_id);
        CREATE INDEX IF NOT EXISTS idx_debt_status ON public.debt_obligations(status);
      `
    });

    // Enable RLS
    await supabase.rpc('pg_catalog.exec', {
      sql: `
        ALTER TABLE public.royalty_payments ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.debt_obligations ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY royalty_payments_all_hq ON public.royalty_payments FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY debt_obligations_all_hq ON public.debt_obligations FOR ALL TO service_role USING (true) WITH CHECK (true);
      `
    });

    return new Response(JSON.stringify({
      success: true,
      message: "P0 tables created",
      tables: {
        royalty_payments: !royaltyError ? "created" : "error: " + royaltyError.message,
        debt_obligations: !debtError ? "created" : "error: " + debtError.message
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
