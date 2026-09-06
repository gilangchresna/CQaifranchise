// supabase/functions/steward-agent/index.ts
//
// Steward: manages the access lifecycle — pending invitations that are
// about to expire, access grants that were meant to be temporary (e.g. a
// contractor or auditor) and are approaching their review date. Distinct
// from Guardian (security posture); Steward is process/lifecycle hygiene.
// Suggested cadence: daily.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

const INVITE_EXPIRY_WARNING_DAYS = 3;
const TEMP_ACCESS_REVIEW_WARNING_DAYS = 7;

interface AccessLifecycleSignal {
  record_id: string;
  record_type: "invitation" | "temporary_access_grant";
  subject_email: string;
  expires_at: string; // ISO date
}

function daysUntil(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  try {
    const { records } = (await req.json()) as { records: AccessLifecycleSignal[] };
    if (!Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ error: "records[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const r of records) {
      const daysLeft = daysUntil(r.expires_at);
      const warningWindow =
        r.record_type === "invitation" ? INVITE_EXPIRY_WARNING_DAYS : TEMP_ACCESS_REVIEW_WARNING_DAYS;

      if (daysLeft > warningWindow || daysLeft < 0) continue;

      await createInsight(supabase, {
        agentName: "steward",
        module: "Access",
        outletId: null,
        category: r.record_type === "invitation" ? "invitation_expiring" : "temp_access_review_due",
        severity: daysLeft <= 1 ? "high" : "low",
        title: `${r.subject_email}: ${r.record_type === "invitation" ? "invitation" : "temporary access"} expires in ${daysLeft} day(s)`,
        details:
          r.record_type === "invitation"
            ? "Resend or let it lapse — unused invitations shouldn't accumulate."
            : "Review whether this temporary grant should be extended or revoked.",
        payload: { record_id: r.record_id, record_type: r.record_type, days_left: daysLeft },
      });
      flagged.push({ record_id: r.record_id, days_left: daysLeft });
    }

    await logAgentRun(supabase, "steward", { records_scanned: records.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
