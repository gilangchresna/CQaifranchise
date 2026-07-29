# Notification Trigger - Edge Function

**Phase:** 1.3  
**Purpose:** Automatically sends notifications when alerts are created or cases are updated

## Endpoint

```
POST /functions/v1/notification-trigger
```

## Request Body

```json
{
  "event_type": "ALERT_CREATED" | "CASE_ASSIGNED" | "CASE_UPDATED" | "SLA_WARNING",
  "entity_id": 123,
  "channels": ["EMAIL", "WHATSAPP"],
  "severity_override": "P1_HIGH"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_type` | string | ✅ | Event type to trigger notification |
| `entity_id` | number | ✅ | ID of alert or case |
| `channels` | string[] | ❌ | Specific channels to use (default: user's preference) |
| `severity_override` | string | ❌ | Override severity level |

## Response

```json
{
  "success": true,
  "notifications_sent": 3,
  "channels": ["EMAIL", "WHATSAPP"],
  "recipients": ["user1@email.com", "user2@email.com"],
  "errors": []
}
```

## Logic Flow

```
1. Receive event_type + entity_id
2. Fetch entity details:
   - ALERT_CREATED: Get alert + outlet info
   - CASE_ASSIGNED/UPDATED: Get case + assignee
   - SLA_WARNING: Get case + deadline info
3. Determine recipients based on event:
   - ALERT_CREATED: Franchisee + Regional Manager
   - CASE_*: Assigned user
   - P0/P1: Also HQ_ADMIN
4. Generate message (email HTML, text, WhatsApp)
5. Send via SendGrid (email) or Twilio (WhatsApp)
6. Log to notification_logs table
7. Return summary
```

## Notification Routing

| Event Type | Recipients |
|------------|------------|
| ALERT_CREATED | Franchisee, Regional Manager |
| CASE_ASSIGNED | Assigned user |
| CASE_UPDATED | Assigned user |
| SLA_WARNING | Assigned user |
| P0_CRITICAL | + All HQ_ADMIN |

## Message Templates

### Email (HTML)
- Professional branded template with CyberQuote styling
- Includes all relevant details in table format
- Severity-colored headers for alerts

### WhatsApp
- Compact single-message format
- Emoji indicators for quick scanning
- Truncated descriptions

## Channels

| Channel | Provider | Required Env |
|---------|----------|--------------|
| EMAIL | SendGrid | SENDGRID_API_KEY, SENDGRID_FROM_EMAIL |
| WHATSAPP | Twilio | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM |

## Dependencies

- `alerts` table - For alert details
- `cases` table - For case details
- `user_profiles` table - For recipient info
- `notification_logs` table - For audit logging
- `settings` table - For user preferences

## Acceptance Criteria

- [x] Sends email on alert creation
- [x] Notifies correct assignee for cases
- [x] Escalates P0/P1 to HQ_ADMIN
- [x] Logs to notification_logs
- [x] Supports EMAIL and WHATSAPP channels

## Usage Examples

### Trigger on Alert Created
```bash
curl -X POST https://your-project.supabase.co/functions/v1/notification-trigger \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "ALERT_CREATED",
    "entity_id": 123
  }'
```

### Trigger SLA Warning
```bash
curl -X POST https://your-project.supabase.co/functions/v1/notification-trigger \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "SLA_WARNING",
    "entity_id": 456
  }'
```

### Email Only
```bash
curl -X POST https://your-project.supabase.co/functions/v1/notification-trigger \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "CASE_ASSIGNED",
    "entity_id": 789,
    "channels": ["EMAIL"]
  }'
```

## Environment Variables

Required for email notifications:
```
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@cyberquote.com
```

Required for WhatsApp notifications:
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=+1234567890
```
