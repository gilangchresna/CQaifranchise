# Supabase Edge Functions for CyberQuote

This directory contains Supabase Edge Functions for handling notifications, cases, and alerts.

## Functions

### 1. `notification-send` - Send Notification
**Endpoint:** `POST /functions/v1/notification-send`

Sends notifications via Twilio WhatsApp, SendGrid Email, or Push.

**Request Body:**
```json
{
  "alert_id": 123,
  "channel": "WHATSAPP|EMAIL|PUSH",
  "priority_override": "P0_CRITICAL|P1_HIGH|P2_MEDIUM|P3_LOW"
}
```

**Response:**
```json
{
  "notification_id": 1,
  "status": "SENT",
  "sent_at": "2024-01-15T10:30:00Z",
  "recipient": { "id": 5, "name": "John Doe" },
  "channel": "WHATSAPP"
}
```

**Environment Variables Required:**
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_WHATSAPP_FROM` - Twilio WhatsApp sender number
- `SENDGRID_API_KEY` - SendGrid API key
- `SENDGRID_FROM_EMAIL` - SendGrid sender email (optional)

---

### 2. `case-create` - Create Case
**Endpoint:** `POST /functions/v1/case-create`

Creates a case from an alert and updates the alert status to IN_PROGRESS.

**Request Body:**
```json
{
  "alert_id": 123,
  "title": "Investigate sales drop",
  "description": "Optional detailed description",
  "assigned_to_id": 5,
  "priority": "P1_HIGH"
}
```

**Response:**
```json
{
  "case_id": 1,
  "alert_id": 123,
  "status": "NEW",
  "priority": "P1_HIGH",
  "sla_deadline": "2024-01-16T10:30:00Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**SLA Deadlines (based on priority):**
- P0_CRITICAL: 4 hours
- P1_HIGH: 24 hours
- P2_MEDIUM: 72 hours
- P3_LOW: 168 hours (1 week)

---

### 3. `alert-update` - Update Alert Status
**Endpoint:** `PATCH /functions/v1/alert-update`

Updates an alert's status with transition validation.

**Request Body:**
```json
{
  "alert_id": 123,
  "new_status": "RESOLVED",
  "resolution_notes": "Issue resolved by..."
}
```

**Response:**
```json
{
  "alert_id": 123,
  "previous_status": "IN_PROGRESS",
  "new_status": "RESOLVED",
  "resolved_at": "2024-01-15T14:30:00Z",
  "updated_at": "2024-01-15T14:30:00Z",
  "related_case": { "case_id": 1, "status": "RESOLVED" }
}
```

**Allowed Status Transitions:**
- `NEW` → ACKNOWLEDGED, IN_PROGRESS, CLOSED
- `ACKNOWLEDGED` → IN_PROGRESS, RESOLVED, CLOSED
- `IN_PROGRESS` → RESOLVED, CLOSED
- `RESOLVED` → CLOSED, IN_PROGRESS (reopen)

---

### 4. `alerts-list` - Get Alerts
**Endpoint:** `GET /functions/v1/alerts-list`

Retrieves paginated alerts with RBAC filtering.

**Query Parameters:**
- `status` - Filter by status (comma-separated for multiple)
- `severity` - Filter by severity (P0_CRITICAL, P1_HIGH, etc.)
- `type` - Filter by type (SALES_ANOMALY, STOCKOUT_RISK, etc.)
- `region_id` - Filter by region
- `outlet_id` - Filter by outlet
- `assigned_to` - Filter by case assignee
- `date_from` - Filter from date (ISO 8601)
- `date_to` - Filter to date (ISO 8601)
- `search` - Search in title/description
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Example:**
```
GET /functions/v1/alerts-list?status=NEW,P1_HIGH&severity=P0_CRITICAL&page=1&limit=10
```

**Response:**
```json
{
  "data": [
    {
      "id": 123,
      "type": "SALES_ANOMALY",
      "severity": "P1_HIGH",
      "status": "NEW",
      "title": "Sales drop detected",
      "description": "...",
      "triggered_at": "2024-01-15T10:00:00Z",
      "outlet": { "id": 1, "name": "Outlet A", "region": { "name": "Jakarta" } },
      "case": { "id": 1, "status": "NEW", "assignee": { "name": "John" } }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total_count": 50,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  },
  "filters": { ... },
  "user_context": { "role": "HQ_ADMIN" }
}
```

---

## Deployment

Deploy all functions:
```bash
supabase functions deploy notification-send
supabase functions deploy case-create
supabase functions deploy alert-update
supabase functions deploy alerts-list
```

Deploy with secrets:
```bash
supabase secrets set TWILIO_ACCOUNT_SID=your_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_token
supabase secrets set TWILIO_WHATSAPP_FROM=+1234567890
supabase secrets set SENDGRID_API_KEY=your_api_key
```

---

## Database Setup

Run the migration to create required tables:
```bash
supabase db push --file supabase/migrations/002_notifications_and_cases.sql
```

This creates:
- `notifications` table
- `create_case_with_alert_update` function
- Triggers for auto-updating timestamps and notification counts

---

## Testing

Test locally:
```bash
supabase functions serve notification-send
```

Send test request:
```bash
curl -X POST http://localhost:54321/functions/v1/notification-send \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"alert_id": 1, "channel": "EMAIL"}'
```
