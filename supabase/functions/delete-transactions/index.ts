import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { date_from, dry_run } = await req.json()
    
    if (!date_from) {
      return new Response(
        JSON.stringify({ error: 'date_from is required (e.g., 2026-09-03)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Deleting transactions from ${date_from}, dry_run=${dry_run}`)

    // Count first
    const { count: countBefore } = await supabaseClient
      .from('sales_transactions')
      .select('*', { count: 'exact', head: true })
      .gte('date', date_from)

    if (dry_run) {
      return new Response(
        JSON.stringify({ 
          message: 'DRY RUN - no changes made',
          would_delete: countBefore,
          from_date: date_from 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete
    const { data, error } = await supabaseClient
      .from('sales_transactions')
      .delete()
      .gte('date', date_from)
      .select()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: data?.length || 0,
        from_date: date_from,
        message: `Deleted ${data?.length || 0} transactions from ${date_from}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
