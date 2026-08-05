# Hermes MCP Tools — CyberQuote Integration
**Purpose:** Define MCP tool contracts for Hermes Agent to interact with CyberQuote backend

---

## 🔌 MCP Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    HERMES AGENT (Layer 5)                       │
│                                                                 │
│  Tools: triage_alert, explain_anomaly, create_case,            │
│         send_notification, audit_action                         │
└────────────────────────────┬────────────────────────────────────┘
                             │ MCP (Model Context Protocol)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               CYBERQUOTE BACKEND (FastAPI)                      │
│                                                                 │
│  /mcp/tools/<tool_name>  — Tool handlers                       │
│  /mcp/status             — Health check                        │
│  /mcp/capabilities       — Available tools                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ TOOL DEFINITIONS

### 1. `get_outlet_status`

**Purpose:** Retrieve current status and KPIs for an outlet

**Input:**
```json
{
  "outlet_id": "string (required)",
  "include_kpis": "boolean (default: true)",
  "include_recent_alerts": "boolean (default: true)",
  "time_range_hours": "number (default: 24)"
}
```

**Output:**
```json
{
  "outlet_id": "string",
  "name": "string",
  "region": "string",
  "status": "ACTIVE | INACTIVE | SUSPENDED",
  "kpis": {
    "sales_today": "number",
    "sales_vs_target": "number (percentage)",
    "transaction_count": "number",
    "avg_transaction": "number",
    "stockout_risk_score": "number (0-1)",
    "anomaly_score": "number (0-1)"
  },
  "recent_alerts": [
    {
      "id": "string",
      "type": "SALES_ANOMALY | STOCKOUT_RISK",
      "severity": "P0_CRITICAL | P1_HIGH | P2_MEDIUM | P3_LOW",
      "status": "NEW | ACKNOWLEDGED | IN_PROGRESS | RESOLVED",
      "triggered_at": "ISO8601 timestamp",
      "summary": "string"
    }
  ],
  "last_updated": "ISO8601 timestamp"
}
```

**Error Cases:**
- `404`: Outlet not found
- `403`: User not authorized to view this outlet

---

### 2. `list_active_alerts`

**Purpose:** Get all active alerts for triage

**Input:**
```json
{
  "role": "HQ_ADMIN | REGIONAL_MANAGER | FRANCHISEE_OWNER (required)",
  "user_id": "string (required)",
  "region_id": "string (optional, for REGIONAL_MANAGER)",
  "franchisee_id": "string (optional, for FRANCHISEE_OWNER)",
  "severity_filter": "P0_CRITICAL | P1_HIGH | P2_MEDIUM | P3_LOW (optional)",
  "status_filter": "NEW | ACKNOWLEDGED | IN_PROGRESS (optional)",
  "limit": "number (default: 50, max: 100)",
  "offset": "number (default: 0)"
}
```

**Output:**
```json
{
  "total_count": "number",
  "alerts": [
    {
      "id": "string",
      "outlet_id": "string",
      "outlet_name": "string",
      "region": "string",
      "type": "SALES_ANOMALY | STOCKOUT_RISK",
      "severity": "P0_CRITICAL | P1_HIGH | P2_MEDIUM | P3_LOW",
      "status": "NEW | ACKNOWLEDGED | IN_PROGRESS",
      "score": "number (0-1)",
      "top_features": ["string"],
      "triggered_at": "ISO8601 timestamp",
      "assigned_to": "string (user name) | null"
    }
  ],
  "summary": {
    "critical_count": "number",
    "high_count": "number",
    "medium_count": "number",
    "low_count": "number"
  }
}
```

---

### 3. `create_case`

**Purpose:** Create a case/work order from an alert

**Input:**
```json
{
  "alert_id": "string (required)",
  "title": "string (required, max 255 chars)",
  "description": "string (optional)",
  "assigned_to_id": "string (optional, user ID)",
  "priority": "P0_CRITICAL | P1_HIGH | P2_MEDIUM | P3_LOW (default: inherit from alert)",
  "sla_deadline_hours": "number (optional, default based on priority)"
}
```

**Output:**
```json
{
  "case_id": "string",
  "alert_id": "string",
  "title": "string",
  "description": "string",
  "priority": "P0_CRITICAL | P1_HIGH | P2_MEDIUM | P3_LOW",
  "status": "NEW",
  "assigned_to": {
    "id": "string",
    "name": "string"
  } | null,
  "sla_deadline": "ISO8601 timestamp",
  "created_at": "ISO8601 timestamp"
}
```

**Side Effects:**
- Alert status updated to `IN_PROGRESS`
- Audit log entry created
- If assigned_to_id provided, notification triggered

**Error Cases:**
- `400`: Invalid alert_id or title too long
- `404`: Alert not found
- `409`: Case already exists for this alert

---

### 4. `send_whatsapp_notification`

**Purpose:** Send WhatsApp alert to franchise owner/regional manager

**Input:**
```json
{
  "alert_id": "string (required)",
  "recipient_role": "FRANCHISEE_OWNER | REGIONAL_MANAGER (required)",
  "template": "CRITICAL_ALERT | HIGH_ALERT | MEDIUM_ALERT | INFO (default: based on severity)",
  "priority_override": "boolean (default: false, bypasses notification preferences)"
}
```

**Output:**
```json
{
  "notification_id": "string",
  "alert_id": "string",
  "recipient": {
    "id": "string",
    "name": "string",
    "phone": "+62xxxxxxxxxx (masked)"
  },
  "channel": "WHATSAPP",
  "status": "SENT | FAILED | SKIPPED",
  "sent_at": "ISO8601 timestamp",
  "error": "string | null"
}
```

**Message Templates:**

**CRITICAL_ALERT:**
```
🚨 CyberQuote Critical Alert

Outlet: {outlet_name}
Issue: {alert_type}
Severity: {severity}

{summary}

Action Required: {recommended_action}

Sent: {timestamp}
```

**HIGH_ALERT:**
```
⚠️ CyberQuote Alert

Outlet: {outlet_name}
Issue: {alert_type}

{summary}

View Details: {dashboard_url}
```

**Error Cases:**
- `404`: Alert or recipient not found
- `429`: Rate limit exceeded (max 10 notifications/minute)
- `503`: Twilio service unavailable

---

### 5. `audit_action`

**Purpose:** Log all Hermes actions for compliance and audit trail

**Input:**
```json
{
  "action_type": "TRIAGE | CREATE_CASE | SEND_NOTIFICATION | ESCALATE | DISMISS | EXPLAIN (required)",
  "target_type": "ALERT | CASE | OUTLET (required)",
  "target_id": "string (required)",
  "hermes_reasoning": "string (required, why this action was taken)",
  "recommendation": "string (optional, what was recommended)",
  "outcome": "ACCEPTED | REJECTED | PENDING (optional)",
  "metadata": "object (optional, additional context)"
}
```

**Output:**
```json
{
  "audit_id": "string",
  "action_type": "string",
  "target_type": "string",
  "target_id": "string",
  "hermes_session_id": "string",
  "timestamp": "ISO8601 timestamp",
  "status": "LOGGED"
}
```

---

### 6. `explain_anomaly`

**Purpose:** Generate human-readable explanation for an anomaly (Athena integration)

**Input:**
```json
{
  "alert_id": "string (required)",
  "outlet_id": "string (required)",
  "question": "string (optional, specific question about the anomaly)"
}
```

**Output:**
```json
{
  "explanation_id": "string",
  "alert_id": "string",
  "explanation": "string (150 words max)",
  "root_causes": [
    {
      "cause": "string",
      "confidence": "number (0-1)",
      "evidence": "string"
    }
  ],
  "recommended_actions": [
    {
      "action": "string",
      "priority": "HIGH | MEDIUM | LOW",
      "estimated_impact": "string"
    }
  ],
  "cited_metrics": [
    {
      "metric": "string",
      "value": "string",
      "context": "string"
    }
  ],
  "confidence_score": "number (0-1)",
  "model_used": "gpt-4o-mini",
  "generated_at": "ISO8601 timestamp"
}
```

**Error Cases:**
- `404`: Alert not found
- `503`: OpenAI service unavailable (returns degraded mode response)

---

### 7. `update_alert_status`

**Purpose:** Update alert status (acknowledge, resolve, close)

**Input:**
```json
{
  "alert_id": "string (required)",
  "new_status": "ACKNOWLEDGED | IN_PROGRESS | RESOLVED | CLOSED (required)",
  "resolution_notes": "string (required for RESOLVED/CLOSED)",
  "close_reason": "string (optional, for CLOSED)"
}
```

**Output:**
```json
{
  "alert_id": "string",
  "previous_status": "string",
  "new_status": "string",
  "updated_at": "ISO8601 timestamp",
  "updated_by": "hermes-agent"
}
```

**Side Effects:**
- Audit log entry created
- If RESOLVED, associated case updated
- Realtime notification triggered

---

## 🔒 TOOL ACCESS CONTROL

| Tool | HQ_ADMIN | REGIONAL_MANAGER | FRANCHISEE_OWNER | Hermes |
|------|----------|------------------|-------------------|--------|
| `get_outlet_status` | ✅ All | ✅ Region only | ✅ Own only | ✅ All |
| `list_active_alerts` | ✅ All | ✅ Region only | ✅ Own only | ✅ All |
| `create_case` | ✅ | ✅ Region | ✅ Own | ✅ |
| `send_whatsapp_notification` | ✅ | ✅ Region | ❌ | ✅ |
| `audit_action` | ✅ Read | ✅ Read | ❌ | ✅ Write |
| `explain_anomaly` | ✅ All | ✅ Region | ✅ Own | ✅ |
| `update_alert_status` | ✅ All | ✅ Region | ✅ Own | ✅ |

---

## 📡 MCP ENDPOINT SPEC

### Base URL
```
https://api.cyberquote.id/mcp
# Local: http://localhost:8000/mcp
```

### Health Check
```
GET /mcp/status

Response 200:
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "ISO8601",
  "capabilities": ["get_outlet_status", "list_active_alerts", ...]
}
```

### Tool Invocation
```
POST /mcp/tools/<tool_name>
Authorization: Bearer <hermes_api_key>
Content-Type: application/json

{
  // tool-specific input
}

Response 200:
{
  "success": true,
  "data": { /* tool output */ },
  "execution_time_ms": 123
}

Response 4xx/5xx:
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Session Context
```
POST /mcp/session
{
  "session_id": "uuid",
  "user_id": "hermes-system",
  "role": "HERMES_AGENT",
  "capabilities": ["triage", "explain", "notify"]
}

Response 200:
{
  "session_token": "jwt-token",
  "expires_at": "ISO8601"
}
```

---

## 🔄 HERMES ORCHESTRATION FLOW

```
1. HERMES receives alert notification
   ↓
2. HERMES calls list_active_alerts (filtered by severity)
   ↓
3. HERMES calls get_outlet_status for top alerts
   ↓
4. HERMES generates triage reasoning
   ↓
5. If action needed:
   a. HERMES calls create_case
   b. HERMES calls send_whatsapp_notification
   c. HERMES calls audit_action
   ↓
6. If explanation requested:
   a. HERMES calls explain_anomaly
   b. HERMES calls audit_action
   ↓
7. End session
```

---

## ⚠️ CONSTRAINTS & LIMITS

| Constraint | Value | Reason |
|------------|-------|--------|
| Max requests/minute | 100 | Rate limiting |
| Max alerts per triage | 50 | Prevent overload |
| Max notification burst | 10/minute | WhatsApp limit |
| Session timeout | 30 minutes | Security |
| Tool timeout | 30 seconds | Prevent hangs |
| Max explanation length | 500 tokens | Token budget |

---

## 🚨 ERROR CODES

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `OUTLET_NOT_FOUND` | 404 | Outlet ID doesn't exist |
| `ALERT_NOT_FOUND` | 404 | Alert ID doesn't exist |
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Role not allowed for this action |
| `CASE_EXISTS` | 409 | Case already created for alert |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVICE_UNAVAILABLE` | 503 | Backend service down |
| `TIMEOUT` | 504 | Tool execution timeout |

---

**Last Updated:** July 13, 2026
**Version:** 1.0.0
