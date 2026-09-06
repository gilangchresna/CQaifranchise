// Steward: monitors access lifecycle - pending invitations, temporary access
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

serve(async (req) => {
  try {
    const today = new Date();
    const warnings: any[] = [];

    // Check user_profiles for pending/old entries
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id, role, created_at")
      .limit(100);

    // Flag potential issues
    for (const user of users ?? []) {
      if (!user.role) {
        await createInsight(supabase, {
          agentName: "steward",
          module: "Access",
          outletId: null,
          category: "missing_role",
          severity: "medium",
          title: `User without role assignment`,
          details: `User ${user.id} has no role. Assign appropriate role.`,
        });
        warnings.push(user.id);
      }
    }

    await logAgentRun(supabase, "steward", { users_checked: users?.length ?? 0, warnings: warnings.length });

    return new Response(JSON.stringify({ 
      success: true,
      users_checked: users?.length ?? 0,
      warnings: warnings.length
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Steward error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
