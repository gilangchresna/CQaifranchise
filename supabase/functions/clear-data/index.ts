import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action } = await req.json();

    if (action === 'clear_transactions') {
      // Delete all transactions
      const { count, error } = await supabase
        .from('sales_transactions')
        .delete()
        .neq('id', 0);
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Deleted ${count || 0} transactions` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_stats') {
      // Get current stats
      const { count } = await supabase
        .from('sales_transactions')
        .select('*', { count: 'exact', head: true });
      
      const { data: latest } = await supabase
        .from('sales_transactions')
        .select('amount, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      return new Response(JSON.stringify({ 
        total_transactions: count,
        latest_transactions: latest 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
