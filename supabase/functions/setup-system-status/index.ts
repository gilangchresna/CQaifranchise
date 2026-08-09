/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This edge function runs ONCE to set up system_status table and trigger.
// After running, DELETE this edge function.

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("POST only", { status: 405 });
  }

  // Use service role to run DDL
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const results: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Create system_status table
    const { error: t1 } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS system_status (
          id          BIGINT PRIMARY KEY DEFAULT 1,
          CONSTRAINT single_row CHECK (id = 1),
          last_txn_at TIMESTAMPTZ,
          updated_at  TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT last_txn_at_not_null CHECK (last_txn_at IS NOT NULL)
        );
      `,
    });
    if (t1 && t1.code !== "42P07") errors.push("create table: " + t1.message);
    else results.push("system_status table created/verified");

    // 2. Insert initial row if not exists
    const { error: t2 } = await supabase.from("system_status").upsert(
      { id: 1, last_txn_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "id", ignoreDuplicates: true }
    );
    if (t2) errors.push("insert initial row: " + t2.message);
    else results.push("initial row upserted");

    // 3. Create trigger function
    const { error: t3 } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE OR REPLACE FUNCTION update_last_txn_at()
        RETURNS TRIGGER AS $$
        BEGIN
          UPDATE system_status SET last_txn_at = NOW(), updated_at = NOW() WHERE id = 1;
          IF NOT FOUND THEN
            INSERT INTO system_status (id, last_txn_at, updated_at) VALUES (1, NOW(), NOW());
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `,
    });
    if (t3 && t3.code !== "42710") errors.push("create function: " + t3.message);
    else results.push("update_last_txn_at function created/verified");

    // 4. Create trigger
    const { error: t4 } = await supabase.rpc("exec_sql", {
      sql: `
        DROP TRIGGER IF EXISTS trg_update_last_txn_at ON sales_transactions;
        CREATE TRIGGER trg_update_last_txn_at
          AFTER INSERT ON sales_transactions
          FOR EACH ROW EXECUTE FUNCTION update_last_txn_at();
      `,
    });
    if (t4) errors.push("create trigger: " + t4.message);
    else results.push("trigger created on sales_transactions");

    // 5. Enable RLS
    const { error: t5 } = await supabase.rpc("exec_sql", {
      sql: `ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;`,
    });
    if (t5) errors.push("enable RLS: " + t5.message);
    else results.push("RLS enabled");

    // 6. Create read policy
    const { error: t6 } = await supabase.rpc("exec_sql", {
      sql: `
        DROP POLICY IF EXISTS "system_status_read_all" ON system_status;
        CREATE POLICY "system_status_read_all" ON system_status
          FOR SELECT TO authenticated, anon USING (true);
      `,
    });
    if (t6) errors.push("create read policy: " + t6.message);
    else results.push("read policy created");

    // 7. Verify current last_txn_at
    const { data: status } = await supabase
      .from("system_status")
      .select("last_txn_at")
      .eq("id", 1)
      .single();

    return new Response(JSON.stringify({
      success: errors.length === 0,
      results,
      errors,
      current_last_txn_at: status?.last_txn_at ?? "null",
      message: "After verifying, DELETE this edge function via: supabase functions delete setup-system-status"
    }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err), results, errors }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
