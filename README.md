# Agentic Ecosystem Expansion — 14 New Agents, Every Module at 2+

Builds out every agent recommended in the system review, and ensures every
module in the app has at least two agents watching it. See `COVERAGE_MAP.md`
for the full module-to-agent mapping and the reasoning behind shared vs.
dedicated tables.

## What's included

```
COVERAGE_MAP.md                                  — module → agent coverage, design rationale
sql/003_agentic_ecosystem_expansion.sql          — agent_insights (shared), repayment_events,
                                                     royalty_reconciliation tables + RLS
supabase/functions/_shared/agentInsights.ts      — shared helper (insert + audit log)
supabase/functions/collector-agent/              — Financing: post-disbursement repayment monitoring
supabase/functions/ledger-agent/                 — Royalty: GL/sales ledger reconciliation
supabase/functions/royalty-auditor-agent/        — Royalty: formula/rate-band validation
supabase/functions/voice-agent/                  — Cases: complaint pattern clustering
supabase/functions/shift-agent/                  — Workforce: staffing shortfall prediction
supabase/functions/coach-agent/                  — Workforce: performance/coaching recommendations
supabase/functions/curator-agent/                — Knowledge: drafts new KB articles from case patterns
supabase/functions/librarian-agent/              — Knowledge: flags stale/ineffective KB articles
supabase/functions/gatekeeper-agent/             — Integrations: connector uptime/staleness
supabase/functions/bridge-agent/                 — Integrations: payload schema drift validation
supabase/functions/guardian-agent/               — Access: dormant accounts, excess permissions
supabase/functions/steward-agent/                — Access: invitation/temp-access lifecycle
supabase/functions/benchmarker-agent/            — Peer: proactive underperformance nudges
supabase/functions/scout-agent/                  — Peer: expansion sites, cannibalisation risk
src/components/AgentInsightsFeed.tsx             — generic feed, reused across 8 modules
src/components/RepaymentsPanel.tsx               — dedicated Collector dashboard
src/components/RoyaltyReconciliationPanel.tsx    — dedicated Ledger dashboard
PATCH_NOTES.md                                   — exact diffs for App.tsx + where to embed the feed
```

## Setup steps

1. **Apply the SQL migration** — depends on `outlets`, `risk_scores`,
   `loan_sizing_recommendations` from the earlier Phase 2 package.

2. **Deploy all 14 Edge Functions:**
   ```bash
   for fn in collector-agent ledger-agent royalty-auditor-agent voice-agent \
             shift-agent coach-agent curator-agent librarian-agent \
             gatekeeper-agent bridge-agent guardian-agent steward-agent \
             benchmarker-agent scout-agent; do
     supabase functions deploy "$fn"
   done
   ```
   The `_shared/agentInsights.ts` helper deploys automatically as part of
   each function's bundle (Supabase bundles relative imports).

3. **Wire up cadences** per the table in `PATCH_NOTES.md` — most are cron
   jobs (`supabase functions schedule` or an external scheduler hitting each
   function's URL); Royalty Auditor and Bridge are better as event triggers
   fired by whatever process already runs royalty calculations / receives
   webhooks, since they validate a specific event rather than scanning
   periodically.

4. **Apply the App.tsx and module-page patches** in `PATCH_NOTES.md`.

5. **Confirm RLS** for `agent_insights` — test as each role, and specifically
   confirm a Franchisee cannot see network-level insights (outlet_id null)
   like Gatekeeper/Guardian/Steward/Curator/Librarian/Scout expansion flags,
   which are HQ/Regional-only by design.

## Honest gaps in this package

- **No actual scheduling/cron config included** — Supabase's own scheduling
  mechanism (or an external cron caller) needs to be set up per function;
  this package provides the functions themselves, not the trigger
  infrastructure.
- **Several agents assume upstream data shapes that don't exist yet**
  (e.g. Guardian's `has_hq_admin_role_but_regional_activity_only` — this is
  a precomputed signal your Access Management logic would need to produce;
  Scout's catchment-overlap estimate needs a geospatial calculation not
  built here). These functions are ready to receive that data once it's
  computed upstream — the detection/flagging logic is complete, but the
  upstream data pipeline for a few signals is not.
- **Royalty Auditor's SCORE_BANDS is hardcoded**, mirroring what's likely
  already in `RoyaltySettings` — same pattern as the earlier note about
  `FINANCIER_PROFILES`. Worth sourcing from a shared rate-bands table so
  Royalty Auditor and RoyaltySettings can't drift out of sync with each
  other.
