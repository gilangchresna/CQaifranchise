// pos-bulk-insert: bypasses PostgREST RLS — edge fn uses svc role client internally
// POST body: { "transactions": [...] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_TOKEN")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  try {
    const { transactions } = await req.json();
    if (!Array.isArray(transactions)) {
      return new Response(JSON.stringify({ error: "transactions must be an array" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { data, error } = await supabase
      .from("sales_transactions")
      .upsert(transactions, { onConflict: "transaction_id" })
      .select("id");

    if (error) throw error;

    return new Response(
      JSON.stringify({ inserted: data?.length ?? transactions.length, ids: data?.map((r) => r.id) }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
