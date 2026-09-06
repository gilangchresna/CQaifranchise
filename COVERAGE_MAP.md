# Agent Coverage Map — Every Module, ≥2 Agents

| Module | Agent 1 | Agent 2 (+3rd/4th where noted) | Status |
|---|---|---|---|
| Dashboard / Alerts | Athena | Monitor, Analyst | Existing (3) |
| Cases | Triage | Coordinator, Executor, **Voice** (complaint pattern clustering) | Existing (3) + 1 NEW |
| Financing | Underwriter (pre-loan risk/sizing) | **Collector** (post-disbursement repayment monitoring) | 1 existing + 1 NEW |
| Royalty | **Ledger** (GL/sales ledger reconciliation) | **Royalty Auditor** (formula/score-multiplier validation) | 2 NEW |
| Workforce | **Shift** (staffing shortfall prediction) | **Coach** (performance/coaching recommendations) | 2 NEW |
| Knowledge Base | **Curator** (drafts new SOPs from case patterns) | **Librarian** (flags stale/outdated content) | 2 NEW |
| Integrations | **Gatekeeper** (connector uptime/silent failure) | **Bridge** (payload/schema drift validation) | 2 NEW |
| Access Management | **Guardian** (dormant accounts, excess permissions) | **Steward** (invitation/expiry lifecycle) | 2 NEW |
| Peer Benchmark | **Benchmarker** (proactive underperformance nudges) | **Scout** (expansion site / cannibalisation analysis) | 2 NEW |
| Compliance (within Risk) | Sentinel | Underwriter (shares risk data) | Existing (2) |

**14 new agents. Every module now has 2+.**

## Design decision: shared vs. dedicated tables

- **Collector** and **Ledger** get dedicated tables (`repayment_events`,
  `royalty_reconciliation`) because they track structured numeric data
  (amounts, due dates, variances) that a generic flag table can't represent
  well.
- **11 agents** (Royalty Auditor, Voice, Shift, Coach, Curator, Librarian,
  Gatekeeper, Bridge, Guardian, Steward, Benchmarker, Scout — 12 total) write into one shared `agent_insights`
  table. This avoids 11 near-identical single-purpose tables and gives you
  one place to build a unified "what have the agents found" feed, filterable
  by module or agent. This is a deliberate simplification, not a shortcut —
  splitting these into bespoke tables later is possible if any one of them
  outgrows the generic shape.
