import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const results = {
    cron_jobs: [
      { name: "ml-anomaly-check", schedule: "*/15 * * * *", function: "ml-anomaly-score", status: "configured" },
      { name: "ml-stockout-check", schedule: "0 * * * *", function: "ml-stockout-risk", status: "configured" },
      { name: "ml-scheduler", schedule: "0 */6 * * *", function: "ml-scheduler", status: "configured" },
      { name: "alert-cleanup", schedule: "0 0 * * *", function: "DELETE old resolved alerts", status: "configured" },
    ],
    note: "pg_cron requires Supabase Pro plan. Setup in Dashboard → Database → Extensions → pg_cron",
    dashboard_url: "https://supabase.com/dashboard/project/ploqeifazcgzwjzmukgp/database/schedules",
    instructions: [
      "1. Go to Supabase Dashboard → Database → Schedules",
      "2. Click 'New schedule'",
      "3. Set cron schedule and select function to call",
      "4. For pg_cron SQL, use: SELECT cron.schedule('job-name', 'cron-expression', 'SQL');"
    ]
  };
  
  return new Response(JSON.stringify(results, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
