// supabase/functions/guardian-agent/index.ts
//
// Guardian: flags dormant accounts, excess permissions, and unusual access
// patterns — the security-hardening companion to Steward (which handles the
// invitation/lifecycle side of Access Management). Suggested cadence: weekly.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

const DORMANT_DAYS_THRESHOLD = 90;

interface UserAccessSignal {
  user_id: string;
  user_email: string;
  role: string;
  last_login_at: string | null;
  region_id: number | null;
  has_hq_admin_role_but_regional_activity_only: boolean; // precomputed upstream: role vs. actual usage pattern mismatch
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  try {
    const { users } = (await req.json()) as { users: UserAccessSignal[] };
    if (!Array.isArray(users) || users.length === 0) {
      return new Response(JSON.stringify({ error: "users[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const u of users) {
      const dormantDays = u.last_login_at ? daysSince(u.last_login_at) : null;
      const isDormant = dormantDays !== null && dormantDays > DORMANT_DAYS_THRESHOLD;
      const isNeverLoggedIn = u.last_login_at === null;

      if (isDormant || isNeverLoggedIn) {
        await createInsight(supabase, {
          agentName: "guardian",
          module: "Access",
          outletId: null,
          category: isNeverLoggedIn ? "account_never_used" : "account_dormant",
          severity: u.role === "HQ_ADMIN" ? "high" : "medium",
          title: `${u.user_email} (${u.role}): ${isNeverLoggedIn ? "never logged in" : `dormant ${dormantDays} days`}`,
          details: "Consider deactivating if no longer needed — dormant privileged accounts are a standing security risk.",
          payload: { user_id: u.user_id, role: u.role, dormant_days: dormantDays },
        });
        flagged.push({ user_id: u.user_id, type: "dormant" });
      }

      if (u.has_hq_admin_role_but_regional_activity_only) {
        await createInsight(supabase, {
          agentName: "guardian",
          module: "Access",
          outletId: null,
          category: "excess_permissions",
          severity: "medium",
          title: `${u.user_email}: HQ_ADMIN role but activity pattern matches regional-only usage`,
          details: "Consider whether this account's role should be downgraded to REGIONAL_MANAGER — least-privilege review recommended.",
          payload: { user_id: u.user_id, role: u.role },
        });
        flagged.push({ user_id: u.user_id, type: "excess_permissions" });
      }
    }

    await logAgentRun(supabase, "guardian", { users_scanned: users.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
