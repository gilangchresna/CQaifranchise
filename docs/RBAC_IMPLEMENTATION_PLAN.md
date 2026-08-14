# AIFrCQ — RBAC Implementation Plan

**Date:** August 14, 2026  
**Version:** 1.0  
**Status:** Ready for Implementation  
**Team:** Stefanus (Fullstack), Melvin (AI/ML), QA/Ops

---

## 1. Current State Analysis

### 1.1 Existing Tables

| Table | Columns | Issues |
|-------|---------|--------|
| `user_profiles` | id, role, region_id, email, is_active | region_id = NULL for all |
| `auth.users` | id, email | Managed by Supabase Auth |
| `regions` | id, name, code, currency_code | 9 regions defined |
| `outlets` | id, region_id, franchisee_id | FK to region OK ✅ |

### 1.2 Current Users (42 total)

| Role | Count | With Email | With Region |
|------|-------|------------|-------------|
| HQ_ADMIN | 2 | 2 | 0 |
| REGIONAL_MANAGER | 6 | 0 | 0 |
| FRANCHISEE_OWNER | 14 | 8 | 0 |
| FRANCHISEE_STAFF | 20 | 0 | 0 |

### 1.3 Problems

1. All `region_id` = NULL → RBAC scoping broken
2. 32/42 users without email → Can't invite
3. No `user_outlets` junction → Franchisee outlet access undefined
4. "Add New User" not implemented
5. RLS policies not verified for new tables

---

## 2. Target Architecture

### 2.1 Entity Relationship

```
auth.users (Supabase)
    │
    ├── 1:1 ─── user_profiles (id FK)
    │               │
    │               ├── role (HQ_ADMIN | REGIONAL_MANAGER | FRANCHISEE_OWNER | FRANCHISEE_STAFF)
    │               ├── region_id (FK → regions) ← For REGIONAL_MANAGER
    │               ├── is_active
    │               └── created_at
    │
    └── 1:many ─── user_outlets (junction)
                        │
                        └── many:1 ─── outlets
```

### 2.2 Role Definitions

| Role | Scope | Assigned To |
|------|-------|-------------|
| **HQ_ADMIN** | Global (all regions, all outlets) | Platform admin |
| **REGIONAL_MANAGER** | 1 region + all outlets in region | Regional head |
| **FRANCHISEE_OWNER** | 1+ outlets (via user_outlets) | Outlet owner |
| **FRANCHISEE_STAFF** | 1+ outlets (via user_outlets) | Outlet staff |

### 2.3 Permission Matrix

| Feature | HQ_ADMIN | REGIONAL_MG | FRANCHISEE_OWNER | STAFF |
|---------|:---------:|:-----------:|:----------------:|:-----:|
| Dashboard (all regions) | ✅ | ❌ | ❌ | ❌ |
| Dashboard (own region) | ✅ | ✅ | ❌ | ❌ |
| Dashboard (own outlets) | ✅ | ✅ | ✅ | Read-only |
| View all outlets | ✅ | Region | Own | Own |
| View all alerts | ✅ | Region | Own outlet | Own outlet |
| Create case | ✅ | ✅ | Own outlet | ❌ |
| Update case | ✅ | ✅ | Own outlet | ❌ |
| Approve loan | ✅ | Region | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| System settings | ✅ | ❌ | ❌ | ❌ |
| View ML models | ✅ | ✅ | ✅ | ✅ |
| RAG Chat | ✅ | ✅ | ✅ | ✅ |
| Export data | ✅ | ✅ | ❌ | ❌ |
| Manage KB | ✅ | ❌ | ❌ | ❌ |

---

## 3. Database Schema Changes

### 3.1 Step 1: Add region_id to user_profiles

```sql
-- Migration: 20260814_add_region_to_users.sql

-- Add region_id column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS region_id INT REFERENCES regions(id);

-- Add index for RLS performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_region ON user_profiles(region_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
```

### 3.2 Step 2: Create user_outlets junction table

```sql
-- Migration: 20260814_create_user_outlets.sql

CREATE TABLE IF NOT EXISTS user_outlets (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  outlet_id INT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, outlet_id)
);

-- Index for RLS
CREATE INDEX IF NOT EXISTS idx_user_outlets_user ON user_outlets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_outlets_outlet ON user_outlets(outlet_id);
```

### 3.3 Step 3: Create user_invites table

```sql
-- Migration: 20260814_create_user_invites.sql

CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'FRANCHISEE_STAFF',
  region_id INT REFERENCES regions(id),
  invite_token VARCHAR(255) UNIQUE,
  invited_by UUID REFERENCES user_profiles(id),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_user_invites_status ON user_invites(status);
```

### 3.4 Step 4: Create roles enum (if not exists)

```sql
-- Migration: 20260814_create_enums.sql

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'HQ_ADMIN',
    'REGIONAL_MANAGER', 
    'FRANCHISEE_OWNER',
    'FRANCHISEE_STAFF'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

---

## 4. RLS Policies

### 4.1 user_profiles

```sql
-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- HQ_ADMIN can see all
CREATE POLICY "HQ can view all profiles"
  ON user_profiles FOR SELECT
  USING (auth.jwt() ->> 'role' = 'HQ_ADMIN');

-- Users can see their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- HQ_ADMIN can insert (via invite flow)
CREATE POLICY "HQ can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'HQ_ADMIN');

-- HQ_ADMIN can update
CREATE POLICY "HQ can update profiles"
  ON user_profiles FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'HQ_ADMIN');
```

### 4.2 outlets

```sql
-- Enable RLS
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;

-- HQ_ADMIN sees all
CREATE POLICY "HQ sees all outlets"
  ON outlets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- REGIONAL_MANAGER sees own region
CREATE POLICY "Regional sees region outlets"
  ON outlets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
        AND role = 'REGIONAL_MANAGER'
        AND region_id = outlets.region_id
    )
  );

-- FRANCHISEE sees own outlets
CREATE POLICY "Franchisee sees own outlets"
  ON outlets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_outlets
      WHERE user_id = auth.uid() AND outlet_id = outlets.id
    )
  );
```

### 4.3 alerts

```sql
-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- HQ_ADMIN sees all
CREATE POLICY "HQ sees all alerts"
  ON alerts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'HQ_ADMIN')
  );

-- REGIONAL_MANAGER sees region alerts
CREATE POLICY "Regional sees region alerts"
  ON alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN outlets o ON o.id = alerts.outlet_id
      WHERE up.id = auth.uid() 
        AND up.role = 'REGIONAL_MANAGER'
        AND up.region_id = o.region_id
    )
  );

-- FRANCHISEE sees own outlet alerts
CREATE POLICY "Franchisee sees own alerts"
  ON alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_outlets
      WHERE user_id = auth.uid() AND outlet_id = alerts.outlet_id
    )
  );
```

### 4.4 sales_transactions

```sql
-- Enable RLS
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;

-- Same pattern as outlets - scoping by outlet access
CREATE POLICY "Users see transactions for accessible outlets"
  ON sales_transactions FOR SELECT
  USING (
    -- HQ: all
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'HQ_ADMIN')
    OR
    -- Regional: region outlets
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN outlets o ON o.id = sales_transactions.outlet_id
      WHERE up.id = auth.uid() 
        AND up.role = 'REGIONAL_MANAGER'
        AND up.region_id = o.region_id
    )
    OR
    -- Franchisee/Staff: own outlets
    EXISTS (
      SELECT 1 FROM user_outlets
      WHERE user_id = auth.uid() AND outlet_id = sales_transactions.outlet_id
    )
  );
```

---

## 5. API Endpoints

### 5.1 Edge Functions to Create/Update

| Function | Method | Purpose | Auth |
|---------|--------|---------|------|
| `users-list` | GET | List users (scoped) | HQ_ADMIN |
| `users-invite` | POST | Send invite email | HQ_ADMIN |
| `users-assign-region` | POST | Assign region to user | HQ_ADMIN |
| `users-assign-outlets` | POST | Assign outlets to user | HQ_ADMIN |
| `users-deactivate` | POST | Deactivate user | HQ_ADMIN |
| `invites-list` | GET | List pending invites | HQ_ADMIN |
| `invites-resend` | POST | Resend invite | HQ_ADMIN |
| `invites-cancel` | POST | Cancel invite | HQ_ADMIN |
| `regions-list` | GET | List regions | All authenticated |
| `outlets-list` | GET | List outlets (scoped) | All authenticated |

### 5.2 users-invite Function

```typescript
// supabase/functions/users-invite/index.ts

interface InviteRequest {
  email: string;
  role: 'HQ_ADMIN' | 'REGIONAL_MANAGER' | 'FRANCHISEE_OWNER' | 'FRANCHISEE_STAFF';
  region_id?: number;  // Required for REGIONAL_MANAGER
  full_name?: string;  // Optional, from invite
}

async function handleInvite(req: Request, supabase: any, auth: any, body: InviteRequest) {
  // 1. Validate: Only HQ_ADMIN
  if (auth.role !== 'HQ_ADMIN') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
  }

  // 2. Validate: REGIONAL_MANAGER requires region_id
  if (body.role === 'REGIONAL_MANAGER' && !body.region_id) {
    return new Response(JSON.stringify({ error: 'region_id required for REGIONAL_MANAGER' }), { status: 400 });
  }

  // 3. Check if email already exists in user_profiles
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id, email')
    .eq('email', body.email)
    .single();

  if (existing) {
    return new Response(JSON.stringify({ error: 'User already exists' }), { status: 409 });
  }

  // 4. Check if pending invite exists
  const { data: pendingInvite } = await supabase
    .from('user_invites')
    .select('id')
    .eq('email', body.email)
    .eq('status', 'pending')
    .single();

  if (pendingInvite) {
    return new Response(JSON.stringify({ error: 'Pending invite exists' }), { status: 409 });
  }

  // 5. Create invite record
  const invite_token = crypto.randomUUID();
  const { error: inviteError } = await supabase
    .from('user_invites')
    .insert({
      email: body.email,
      role: body.role,
      region_id: body.region_id || null,
      invite_token,
      invited_by: auth.userId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: 'pending'
    });

  if (inviteError) throw inviteError;

  // 6. Send invite email via Resend
  const inviteUrl = `${BASE_URL}/invite/accept?token=${invite_token}`;
  await sendInviteEmail(body.email, inviteUrl);

  return { success: true, invite_token };
}
```

### 5.3 invite-accept Function

```typescript
// supabase/functions/invite-accept/index.ts

interface AcceptRequest {
  token: string;
  password: string;
  full_name: string;
}

async function handleAccept(req: Request, supabase: any, body: AcceptRequest) {
  // 1. Validate invite exists and not expired
  const { data: invite } = await supabase
    .from('user_invites')
    .select('*')
    .eq('invite_token', body.token)
    .eq('status', 'pending')
    .single();

  if (!invite) {
    return new Response(JSON.stringify({ error: 'Invalid or expired invite' }), { status: 400 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from('user_invites').update({ status: 'expired' }).eq('id', invite.id);
    return new Response(JSON.stringify({ error: 'Invite expired' }), { status: 400 });
  }

  // 2. Create Supabase Auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: invite.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.full_name }
  });

  if (authError) throw authError;

  // 3. Create user_profiles record
  await supabase.from('user_profiles').insert({
    id: authUser.id,
    email: invite.email,
    role: invite.role,
    region_id: invite.region_id,
    is_active: true,
    full_name: body.full_name
  });

  // 4. Mark invite as accepted
  await supabase.from('user_invites').update({ 
    status: 'accepted',
    accepted_at: new Date().toISOString()
  }).eq('id', invite.id);

  return { success: true };
}
```

---

## 6. Frontend Changes

### 6.1 AccessManagement.tsx Updates

| Component | Change |
|-----------|--------|
| Add User modal | Form: email, role dropdown, region dropdown (if Regional) |
| User table | Add: region column, outlet count column |
| Invite status | Show pending invites section |
| Actions | Dropdown: Edit role, Assign region, Assign outlets, Deactivate |

### 6.2 New Components

| Component | Purpose |
|-----------|---------|
| `InviteModal.tsx` | "Add New User" form |
| `UserEditModal.tsx` | Edit user role/region |
| `OutletAssignment.tsx` | Multi-select outlets for franchisee |
| `InviteList.tsx` | Pending invites management |

### 6.3 UI Mockup: Add User Flow

```
┌─────────────────────────────────────────┐
│  Add New User                           │
├─────────────────────────────────────────┤
│                                         │
│  Email *                                │
│  ┌─────────────────────────────────┐   │
│  │ user@example.com                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Role *                                │
│  ┌─────────────────────────────────┐   │
│  │ REGIONAL_MANAGER            ▼   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Region (for Regional Manager)          │
│  ┌─────────────────────────────────┐   │
│  │ Select region...             ▼   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────┐  ┌─────────────┐       │
│  │   Cancel    │  │ Send Invite │       │
│  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────┘
```

---

## 7. Data Migration

### 7.1 Assign Regions to Existing Users

```sql
-- Migration script: 20260814_assign_regions_to_users.sql

-- HQ_ADMIN users (no region needed)
UPDATE user_profiles SET region_id = NULL WHERE role = 'HQ_ADMIN';

-- REGIONAL_MANAGER - assign based on name patterns or default
-- (Need mapping from user to region - manually curated)
UPDATE user_profiles SET region_id = 114 WHERE full_name LIKE '%Singapore%' AND role = 'REGIONAL_MANAGER';
UPDATE user_profiles SET region_id = 115 WHERE full_name LIKE '%Jakarta%' AND role = 'REGIONAL_MANAGER';
UPDATE user_profiles SET region_id = 116 WHERE full_name LIKE '%Bandung%' AND role = 'REGIONAL_MANAGER';
UPDATE user_profiles SET region_id = 117 WHERE full_name LIKE '%Surabaya%' AND role = 'REGIONAL_MANAGER';
UPDATE user_profiles SET region_id = 118 WHERE full_name LIKE '%Bangkok%' AND role = 'REGIONAL_MANAGER';
UPDATE user_profiles SET region_id = 119 WHERE full_name LIKE '%Kuala Lumpur%' AND role = 'REGIONAL_MANAGER';

-- FRANCHISEE_OWNER - assign to outlet's region
UPDATE user_profiles up SET region_id = o.region_id
FROM outlets o
WHERE up.role = 'FRANCHISEE_OWNER' 
  AND up.region_id IS NULL
  AND o.franchisee_id = up.id;

-- FRANCHISEE_STAFF - same as owner
UPDATE user_profiles up SET region_id = o.region_id
FROM outlets o
WHERE up.role = 'FRANCHISEE_STAFF'
  AND up.region_id IS NULL
  AND EXISTS (SELECT 1 FROM user_outlets uo WHERE uo.user_id = up.id AND uo.outlet_id = o.id);
```

### 7.2 Seed user_outlets

```sql
-- Migration script: 20260814_seed_user_outlets.sql

-- For FRANCHISEE_OWNER: link to their franchisee_id matching outlets
INSERT INTO user_outlets (user_id, outlet_id)
SELECT up.id, o.id
FROM user_profiles up
JOIN outlets o ON o.franchisee_id = up.id
WHERE up.role = 'FRANCHISEE_OWNER'
ON CONFLICT (user_id, outlet_id) DO NOTHING;

-- For FRANCHISEE_STAFF: assign to outlet 1 (placeholder)
-- (Real assignment needs staff-outlet mapping table)
INSERT INTO user_outlets (user_id, outlet_id)
SELECT up.id, 1
FROM user_profiles up
WHERE up.role = 'FRANCHISEE_STAFF'
  AND up.id NOT IN (SELECT user_id FROM user_outlets)
ON CONFLICT (user_id, outlet_id) DO NOTHING;
```

---

## 8. Testing Plan

### 8.1 Unit Tests

| Test | Description |
|------|-------------|
| `users-invite` | Valid/invalid email, role validation |
| `invite-accept` | Token validation, expiry check |
| `RLS policies` | Each role sees correct data |
| `Region scoping` | REGIONAL_MANAGER only sees region data |

### 8.2 Integration Tests

| Test | Steps |
|------|-------|
| Full invite flow | HQ invites → email → accept → login |
| Role switching | Login as different roles → verify access |
| Region isolation | Login as SG regional → verify only SG data |
| Outlet isolation | Login as franchisee → verify only own outlets |

### 8.3 Test Users

| Email | Role | Region | Expected Access |
|-------|------|--------|-----------------|
| steve.gilang@gmail.com | HQ_ADMIN | - | All |
| alice.sg@franchise.com | FRANCHISEE_OWNER | SG (114) | SG outlets only |
| charlie.jkt@franchise.com | FRANCHISEE_OWNER | JKT (115) | JKT outlets only |

---

## 9. Implementation Timeline

### Phase 1: Database (Day 1)

| Task | Duration | Owner |
|------|----------|-------|
| Create migrations | 1h | Stefanus |
| Apply migrations to staging | 30min | Stefanus |
| Verify migrations | 30min | QA/Ops |

### Phase 2: Backend (Day 1-2)

| Task | Duration | Owner |
|------|----------|-------|
| Update `users-list` | 1h | Stefanus |
| Create `users-invite` | 2h | Stefanus |
| Create `invite-accept` | 2h | Stefanus |
| Create `users-assign-region` | 1h | Stefanus |
| Create `users-assign-outlets` | 1h | Stefanus |
| Create `invites-list/resend/cancel` | 2h | Stefanus |
| Deploy edge functions | 30min | Stefanus |

### Phase 3: Frontend (Day 2-3)

| Task | Duration | Owner |
|------|----------|-------|
| Update `AccessManagement.tsx` | 3h | Stefanus |
| Create `InviteModal.tsx` | 2h | Stefanus |
| Create `OutletAssignment.tsx` | 2h | Stefanus |
| Integrate API calls | 2h | Stefanus |
| Test UI flow | 1h | Stefanus |

### Phase 4: Data Migration (Day 3)

| Task | Duration | Owner |
|------|----------|-------|
| Write migration scripts | 1h | Stefanus |
| Run in staging | 30min | Stefanus |
| Verify data | 1h | QA/Ops |
| Apply to production | 30min | Stefanus |

### Phase 5: Testing (Day 3-4)

| Task | Duration | Owner |
|------|----------|-------|
| Unit tests | 2h | QA/Ops |
| Integration tests | 3h | QA/Ops |
| Bug fixes | 2h | Stefanus |
| Sign-off | 1h | CTO |

---

## 10. Rollback Plan

### If Issues Found

```sql
-- Rollback migrations (in reverse order)

-- Remove user_outlets
DROP TABLE IF EXISTS user_outlets;

-- Remove user_invites
DROP TABLE IF EXISTS user_invites;

-- Remove region_id (data preserved in backup)
-- ALTER TABLE user_profiles DROP COLUMN region_id;
-- (Keep this commented - only run if needed)
```

### Backup Before Migration

```sql
-- Backup user_profiles
SELECT * INTO backup_user_profiles FROM user_profiles;

-- Backup current RLS state
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
INTO backup_rls_policies 
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'outlets', 'alerts', 'sales_transactions');
```

---

## 11. Files to Modify/Create

### Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260814_add_region_to_users.sql` | Add region_id |
| `supabase/migrations/20260814_create_user_outlets.sql` | Junction table |
| `supabase/migrations/20260814_create_user_invites.sql` | Invite tracking |
| `supabase/functions/users-invite/index.ts` | Invite API |
| `supabase/functions/invite-accept/index.ts` | Accept invite |
| `supabase/functions/users-assign-region/index.ts` | Assign region |
| `supabase/functions/users-assign-outlets/index.ts` | Assign outlets |
| `src/components/InviteModal.tsx` | Invite UI |
| `src/components/OutletAssignment.tsx` | Outlet picker |

### Modify

| File | Change |
|------|--------|
| `supabase/functions/users-list/index.ts` | Add region filtering |
| `src/components/AccessManagement.tsx` | Add invite UI |
| `App.tsx` | Add invite routes (optional) |
| `types/index.ts` | Add invite types |

---

## 12. Success Criteria

| Criteria | Metric |
|----------|--------|
| All users have region_id | 42/42 assigned |
| Invite flow works | Email sent → User can login |
| RLS enforces scoping | Cross-region data not visible |
| No auth errors | 0 403/401 on scoped endpoints |
| Frontend loads | AccessManagement renders correctly |

---

## 13. Open Questions

1. **Email delivery**: Resend API configured? Test sending first.
2. **Frontend URL**: What is invite acceptance URL? (`/invite/accept`)
3. **Region for HQ_ADMIN**: Should HQ_ADMIN have optional region for dashboard filtering?
4. **Existing users without email**: Skip or mark as "pending email"?
5. **Franchisee owner → outlet mapping**: Is `outlets.franchisee_id` = `user_profiles.id` correct?

---

**Next Action:** Stefanus to start Phase 1 (Database migrations)
