// Guardian Agent: Security posture monitoring
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();
const SUSPICIOUS_LOGIN_COUNT = 5;

serve(async (req) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const insights: any[] = [];

    // 1. Check for failed login attempts in recent logs
    const { data: failedLogins } = await supabase
      .from("agent_logs")
      .select("message, metadata, created_at, agent_id")
      .ilike("message", "%failed%")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Group by agent_id
    const failedByAgent: Record<string, number> = {};
    for (const log of failedLogins ?? []) {
      failedByAgent[log.agent_id] = (failedByAgent[log.agent_id] || 0) + 1;
    }

    for (const [agentId, count] of Object.entries(failedByAgent)) {
      if (count >= SUSPICIOUS_LOGIN_COUNT) {
        await createInsight(supabase, {
          agentName: "guardian",
          module: "Access",
          outletId: null,
          category: "suspicious_activity",
          severity: count >= 10 ? "high" : "medium",
          title: `Suspicious activity: ${count} failed attempts`,
          details: `Agent ${agentId} has ${count} failed login attempts in the last 24h. Investigate for unauthorized access.`,
        });
        insights.push({ type: "suspicious_activity", agent: agentId, count });
      }
    }

    // 2. Check for users without assigned role
    const { data: roleLessUsers } = await supabase
      .from("user_profiles")
      .select("id")
      .is("role", null);

    if (roleLessUsers && roleLessUsers.length > 0) {
      await createInsight(supabase, {
        agentName: "guardian",
        module: "Access",
        outletId: null,
        category: "orphaned_account",
        severity: "medium",
        title: `${roleLessUsers.length} users without role`,
        details: `${roleLessUsers.length} user accounts have no assigned role. Assign appropriate permissions or disable account.`,
      });
      insights.push({ type: "orphaned_account", count: roleLessUsers.length });
    }

    // 3. Check for unusually high API activity (potential scraping/abuse)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentActivityCount } = await supabase
      .from("agent_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", hourAgo);

    if (recentActivityCount && recentActivityCount > 500) {
      await createInsight(supabase, {
        agentName: "guardian",
        module: "Access",
        outletId: null,
        category: "high_api_activity",
        severity: "low",
        title: `High API activity: ${recentActivityCount} requests/hour`,
        details: `${recentActivityCount} API calls in the last hour. Monitor for abuse or legitimate high traffic.`,
      });
      insights.push({ type: "high_api_activity", count: recentActivityCount });
    }

    // 4. Check for new user_profiles created today
    const { data: newUsers } = await supabase
      .from("user_profiles")
      .select("id, created_at")
      .gte("created_at", today);

    if (newUsers && newUsers.length > 0) {
      await logAgentRun(supabase, "guardian", { 
        new_users_today: newUsers.length,
        insights_created: insights.length 
      });
    }

    await logAgentRun(supabase, "guardian", { 
      failed_logins: Object.values(failedByAgent).reduce((a, b) => a + b, 0),
      insights_created: insights.length 
    });

    return new Response(JSON.stringify({ 
      success: true,
      insights_created: insights.length,
      details: insights
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Guardian error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
