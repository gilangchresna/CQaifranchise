# Case Assigner - Edge Function

**Phase:** 2.1  
**Purpose:** Automatically assigns cases to appropriate users based on severity and role rules

## Endpoint

```
POST /functions/v1/case-assigner
```

## Request Body

```json
{
  "alert_id": 123,
  "force": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `alert_id` | number | ✅ | Alert to create case from |
| `force` | boolean | ❌ | Override existing assignment (default: false) |

## Response

**Success (201 - new case):**
```json
{
  "success": true,
  "case_id": 456,
  "assigned_to": "user-uuid",
  "assigned_to_name": "John Doe",
  "assignment_rule": "REGIONAL_PRIMARY",
  "sla_deadline": "2026-07-14T18:00:00Z",
  "case_priority": "HIGH"
}
```

**Case Exists (409):**
```json
{
  "success": false,
  "reason": "case_exists",
  "existing_case_id": 456,
  "assigned_to": "user-uuid",
  "assigned_to_name": "John Doe"
}
```

## Assignment Rules

| Priority | Severity | Rule | Assignee |
|----------|----------|------|----------|
| 1 | P0_CRITICAL | HQ_PRIMARY | HQ_ADMIN |
| 2 | P1_HIGH | REGIONAL_PRIMARY | Regional Manager |
| 3 | P2_MEDIUM | AREA_LEAD | Area Lead (or Regional Manager fallback) |
| 4 | P3_LOW | FRANCHISEE_PRIMARY | Franchisee Owner (or Regional Manager fallback) |

### Fallback Chain
If primary assignee is not found:
- P0_CRITICAL → HQ_ADMIN (no other fallback)
- P1_HIGH → Regional Manager → HQ_ADMIN
- P2_MEDIUM → Area Lead → Regional Manager
- P3_LOW → Franchisee → Regional Manager

## SLA Deadlines

| Severity | SLA Hours | Case Priority |
|----------|-----------|---------------|
| P0_CRITICAL | 1 hour | URGENT |
| P1_HIGH | 4 hours | HIGH |
| P2_MEDIUM | 24 hours | MEDIUM |
| P3_LOW | 72 hours | LOW |

## Logic Flow

```
1. Receive alert_id
2. Fetch alert with outlet and region info
3. Check if case already exists
   - If exists and force=false → return existing case
   - If exists and force=true → update assignment
4. Check alert status (skip if resolved/closed)
5. Apply assignment rules based on severity:
   - P0 → HQ_ADMIN
   - P1 → Regional Manager
   - P2 → Area Lead / Regional Manager
   - P3 → Franchisee / Regional Manager
6. Calculate SLA deadline
7. Create/update case with assignment
8. Update alert status to ACKNOWLEDGED
9. Trigger notification to assignee
10. Return case details
```

## Dependencies

- `alerts` table - For alert details
- `outlets` table - For outlet info
- `regions` table - For region info
- `user_profiles` table - For assignee lookup
- `cases` table - For creating/updating cases
- `notification-trigger` (Phase 1.3) - For notifications

## Acceptance Criteria

- [x] P0 assigned to HQ_ADMIN
- [x] P1 assigned to Regional Manager
- [x] P2 assigned to Area Lead (or Regional Manager fallback)
- [x] P3 assigned to Franchisee (or Regional Manager fallback)
- [x] SLA calculated correctly based on severity
- [x] Notification sent to assignee
- [x] Returns existing case if already exists (without force)
- [x] Updates assignment if force=true

## Usage Examples

### Create case from alert (auto-assign)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/case-assigner \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"alert_id": 123}'
```

### Force reassign (override existing)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/case-assigner \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"alert_id": 123, "force": true}'
```

## Integration with Alert Generator

The `alert-generator` (Phase 1.1) can call `case-assigner` to automatically create cases:

```bash
# After alert-generator creates an alert, call case-assigner
curl -X POST https://your-project.supabase.co/functions/v1/case-assigner \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"alert_id\": $ALERT_ID}"
```

## User Roles Required

Make sure these roles exist in `user_profiles` table:

| Role | Purpose |
|------|---------|
| HQ_ADMIN | Receives P0_CRITICAL alerts |
| REGIONAL_MANAGER | Receives P1_HIGH alerts |
| AREA_LEAD | Receives P2_MEDIUM alerts |
| FRANCHISEE_OWNER | Receives P3_LOW alerts |
