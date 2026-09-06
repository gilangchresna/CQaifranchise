# Patch notes — 14 new agents wired into existing modules

## 1. App.tsx — imports and new tabs

```diff
+import { RepaymentsPanel } from "@/src/components/RepaymentsPanel";
+import { RoyaltyReconciliationPanel } from "@/src/components/RoyaltyReconciliationPanel";
+import { AgentInsightsFeed } from "@/src/components/AgentInsightsFeed";
```

```diff
 export type Tab =
   | "Dashboard" | "Outlets" | "Workforce" | "Workflows" | "Agents" | "Risk" | "Knowledge"
   | "Peer" | "Approval" | "Integrations" | "Models" | "Settings" | "Access" | "Financing"
-  | "Cases" | "Royalty" | "RoyaltySettings" | "Underwriter" | "Sentinel" | "Financiers";
+  | "Cases" | "Royalty" | "RoyaltySettings" | "Underwriter" | "Sentinel" | "Financiers"
+  | "Repayments" | "RoyaltyReconciliation";
```

```diff
+      case "repayments":
+        return <RepaymentsPanel />;
+      case "royaltyreconciliation":
+        return <RoyaltyReconciliationPanel />;
```

## 2. Embedding the generic insights feed inside existing module pages

Rather than giving each of the 12 lightweight agents its own tab (which would
bloat the nav), embed `AgentInsightsFeed` directly inside the existing module
page it belongs to. This keeps insights next to the data they're about,
which is where a franchisor/franchisee would look for them anyway:

```tsx
// Inside Workforce.tsx, near the top of the render:
<AgentInsightsFeed activeRole={activeRole} module="Workforce" title="Shift & Coach Insights" />

// Inside KnowledgeBaseAdmin.tsx:
<AgentInsightsFeed activeRole={activeRole} module="Knowledge" title="Curator & Librarian Insights" />

// Inside Integrations.tsx:
<AgentInsightsFeed activeRole={activeRole} module="Integrations" title="Gatekeeper & Bridge Insights" />

// Inside AccessManagement.tsx:
<AgentInsightsFeed activeRole={activeRole} module="Access" title="Guardian & Steward Insights" />

// Inside PeerBenchmark.tsx:
<AgentInsightsFeed activeRole={activeRole} module="Peer" title="Benchmarker & Scout Insights" />

// Inside CasesList.tsx:
<AgentInsightsFeed activeRole={activeRole} module="Cases" agentName="voice" title="Complaint Pattern Insights (Voice)" />

// Inside RoyaltyDashboard.tsx (alongside the new RoyaltyReconciliationPanel):
<AgentInsightsFeed activeRole={activeRole} module="Royalty" agentName="royalty_auditor" title="Rate Validation Insights" />
```

None of the underlying components (Workforce.tsx, KnowledgeBaseAdmin.tsx,
Integrations.tsx, AccessManagement.tsx, PeerBenchmark.tsx, CasesList.tsx,
RoyaltyDashboard.tsx) were in your uploaded files, so the exact insertion
point in each is a judgment call for whoever applies this — anywhere near
the top of the existing content is reasonable.

## 3. Nav additions

Add "Repayments" (under/near Financing) and "Royalty Reconciliation" (under/
near Royalty) as nav entries. The other 12 agents don't need new nav entries
since they surface inline via `AgentInsightsFeed`.

## 4. Cron / trigger cadence summary

| Agent | Suggested cadence | Trigger type |
|---|---|---|
| Collector | Daily | Scheduled |
| Ledger | On royalty period close (or weekly) | Scheduled / event |
| Royalty Auditor | On each royalty run | Event-triggered |
| Voice | Daily | Scheduled |
| Shift | Daily (evening before next-day shifts) | Scheduled |
| Coach | Weekly | Scheduled |
| Curator | Weekly | Scheduled |
| Librarian | Monthly | Scheduled |
| Gatekeeper | Every 15 min | Scheduled (matches existing agent cadence) |
| Bridge | On every payload received | Event-triggered |
| Guardian | Weekly | Scheduled |
| Steward | Daily | Scheduled |
| Benchmarker | Weekly | Scheduled |
| Scout | Monthly | Scheduled |

Only Gatekeeper needs the fast 15-minute cadence — everything else is
intentionally slower since these signals (staffing trends, KB staleness,
peer benchmarks) don't change minute-to-minute, and running them less often
reduces unnecessary Edge Function invocations.
