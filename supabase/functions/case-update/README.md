# Case Update - Edge Function

**Phase:** 2.3  
**Purpose:** Updates case status, resolution, or escalates cases

## Endpoint

```
POST /functions/v1/case-update
```

## Actions

### 1. Resolve Case

```json
{
  "action": "resolve",
  "case_id": 123,
  "resolution": "FIXED",
  "notes": "Restored stock from regional warehouse"
}
```

**Valid resolutions:** `FIXED`, `WONT_FIX`, `DUPLICATE`, `WORKS_AS_DESIGNED`

**Response:**
```json
{
  "success": true,
  "case_id": 123,
  "status": "RESOLVED",
  "resolution": "FIXED",
  "notes": "Restored stock from regional warehouse",
  "message": "Case resolved successfully"
}
```

### 2. Escalate Case

```json
{
  "action": "escalate",
  "case_id": 123,
  "reason": "No response for 2 hours"
}
```

**Response:**
```json
{
  "success": true,
  "case_id": 123,
  "status": "IN_PROGRESS",
  "notes": "Escalated: No response for 2 hours. Escalated from John Doe to Jane Smith",
  "message": "Case escalated to Jane Smith (HQ_ADMIN)"
}
```

### 3. General Update

```json
{
  "action": "update",
  "case_id": 123,
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "notes": "Working on this",
  "assigned_to_id": "user-uuid"
}
```

**Valid statuses:** `NEW`, `ACKNOWLEDGED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`  
**Valid priorities:** `LOW`, `MEDIUM`, `HIGH`, `URGENT`

## Escalation Chain

```
FRANCHISEE_OWNER → AREA_LEAD → REGIONAL_MANAGER → HQ_ADMIN
OUTLET_STAFF → FRANCHISEE_OWNER → AREA_LEAD → REGIONAL_MANAGER → HQ_ADMIN
```

## Logic Flow

### Resolve
```
1. Validate case_id and resolution
2. Check case exists and is not already resolved
3. Update case status to RESOLVED
4. Set resolved_at timestamp
5. Update associated alert status to RESOLVED
6. Return success
```

### Escalate
```
1. Validate case_id and reason
2. Find current assignee and their role
3. Find next level in escalation chain
4. Update case with new assignee
5. Set status to IN_PROGRESS
6. Notify new assignee
7. Send SLA warning
8. Return success
```

### Update
```
1. Validate case_id
2. Validate status/priority if provided
3. Build update object
4. Update case
5. Notify new assignee if reassigned
6. Return success
```

## Dependencies

- `cases` table - For case updates
- `alerts` table - For alert status updates
- `user_profiles` table - For escalation targets
- `notification-trigger` (Phase 1.3) - For notifications

## Acceptance Criteria

- [x] Resolves case with resolution type
- [x] Escalates to next level in chain
- [x] Updates status, priority, notes
- [x] Reassigns to different user
- [x] Updates associated alert when resolved
- [x] Notifies new assignee when reassigned

## Usage Examples

### Resolve a case
```bash
curl -X POST https://your-project.supabase.co/functions/v1/case-update \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "resolve",
    "case_id": 123,
    "resolution": "FIXED",
    "notes": "Issue resolved by replenishing stock"
  }'
```

### Escalate a case
```bash
curl -X POST https://your-project.supabase.co/functions/v1/case-update \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "escalate",
    "case_id": 123,
    "reason": "Assignee unavailable for 24 hours"
  }'
```

### Update case priority
```bash
curl -X POST https://your-project.supabase.co/functions/v1/case-update \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update",
    "case_id": 123,
    "priority": "URGENT"
  }'
```

### Reassign case
```bash
curl -X POST https://your-project.supabase.co/functions/v1/case-update \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update",
    "case_id": 123,
    "assigned_to_id": "user-uuid-123"
  }'
```
