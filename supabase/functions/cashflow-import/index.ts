// Cash Flow Import Edge Function
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

  const auth = await verifyAuth(req);
  if (!auth.authorized || !auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { action, csv_data, user_id } = body;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Use provided user_id or authenticated user
  const targetUserId = user_id || auth.userId;

  if (action === "import_csv") {
    try {
      if (!csv_data || !Array.isArray(csv_data) || csv_data.length < 2) {
        throw new Error("Invalid CSV data: need header + at least 1 row");
      }

      const header = csv_data[0].map(h => h.toLowerCase().trim());
      
      // Find column indices
      const dateIdx = header.findIndex(h => h.includes('date'));
      const descIdx = header.findIndex(h => h.includes('desc') || h.includes('narration'));
      const amountIdx = header.findIndex(h => h.includes('amount'));
      const catIdx = header.findIndex(h => h.includes('category'));
      const detailIdx = header.findIndex(h => h.includes('detail'));

      if (dateIdx === -1 || amountIdx === -1) {
        throw new Error("CSV must have Date and Amount columns");
      }

      // Parse transactions
      const transactions = [];
      let monthlyInflow = 0;
      let monthlyOutflow = 0;

      for (let i = 1; i < csv_data.length; i++) {
        const row = csv_data[i];
        if (row.length < 4) continue;

        const dateStr = row[dateIdx];
        const description = descIdx >= 0 ? row[descIdx] : '';
        const amountStr = row[amountIdx].replace(/[^-\d.]/g, '');
        const amount = parseFloat(amountStr) || 0;
        const category = catIdx >= 0 ? row[catIdx].toUpperCase() : 'OTHER';
        const categoryDetail = detailIdx >= 0 ? row[detailIdx].toUpperCase() : 'OTHER';
        
        const isInflow = amount > 0;
        const absAmount = Math.abs(amount);

        if (absAmount === 0) continue;

        // Parse date (DD/MM/YYYY or YYYY-MM-DD)
        let transactionDate: string;
        const dateParts = dateStr.split('/');
        if (dateParts.length === 3) {
          // DD/MM/YYYY
          transactionDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
        } else {
          transactionDate = dateStr;
        }

        transactions.push({
          transaction_date: transactionDate,
          description: description || 'No description',
          amount: absAmount,
          category: category || 'OTHER',
          category_detail: categoryDetail || 'OTHER',
          is_inflow: isInflow,
        });

        // Calculate totals
        if (isInflow) {
          monthlyInflow += absAmount;
        } else {
          monthlyOutflow += absAmount;
        }
      }

      // Create snapshot
      const snapshotDate = transactions.length > 0 
        ? transactions[0].transaction_date.substring(0, 7) + '-01'
        : new Date().toISOString().substring(0, 10);

      const { data: snapshot, error: snapshotError } = await supabase
        .from('cash_flow_snapshots')
        .insert({
          user_id: targetUserId,
          snapshot_date: snapshotDate,
          source_type: 'EXCEL',
          source_file: 'Manual CSV upload',
          monthly_inflow: monthlyInflow,
          monthly_outflow: monthlyOutflow,
          net_cash_flow: monthlyInflow - monthlyOutflow,
          transaction_count: transactions.length,
          data_quality: 'MANUAL',
        })
        .select()
        .single();

      if (snapshotError) {
        console.error('Snapshot error:', snapshotError);
        throw snapshotError;
      }

      // Insert transactions
      const transactionRecords = transactions.map(t => ({
        snapshot_id: snapshot.id,
        user_id: targetUserId,
        transaction_date: t.transaction_date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        category_detail: t.category_detail,
        is_inflow: t.is_inflow,
      }));

      const { error: txError } = await supabase
        .from('cash_flow_transactions')
        .insert(transactionRecords);

      if (txError) {
        console.error('Transaction insert error:', txError);
        throw txError;
      }

      return new Response(JSON.stringify({
        success: true,
        snapshot_id: snapshot.id,
        snapshot_date: snapshotDate,
        transactions_count: transactions.length,
        monthly_inflow: monthlyInflow,
        monthly_outflow: monthlyOutflow,
        net_cash_flow: monthlyInflow - monthlyOutflow,
        sample_transactions: transactionRecords.slice(0, 5),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error: any) {
      console.error('Import error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
