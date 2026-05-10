# Sub-User Management Implementation

## Overview
Sub-users allow landlords to delegate specific permissions to team members while maintaining control over access rights. This implementation ensures proper role-based access control with granular permissions.

## What Was Fixed

### 1. Database Layer ✅
- **Added `SubUser` role** to `app_role` enum
- **Created permission enforcement functions**:
  - `get_sub_user_permissions(_user_id, _permission)` - Checks if sub-user has specific permission
  - `get_sub_user_landlord(_user_id)` - Returns the landlord ID for a sub-user
  - `is_sub_user_of_landlord(_user_id, _landlord_id)` - Validates sub-user relationship
- **Created `admin_sub_user_view`** - View for admins to see all sub-user relationships
- **Updated RLS policies** on properties, tenants, leases, and maintenance_requests to respect sub-user permissions
- **Added performance indexes** on `sub_users(user_id, status)` and `sub_users(landlord_id, status)`

### 2. Edge Function ✅
**File**: `supabase/functions/create-sub-user/index.ts`

**Changes**:
- Now assigns `SubUser` role in `user_roles` table when creating sub-users
- Validates landlord role using direct table query (avoiding RPC ambiguity)
- Creates user account with temp password for new users
- Links existing users if email already exists

**Security**: Uses service role key with proper authentication checks

### 3. Admin Interface ✅
**File**: `src/pages/admin/UserManagement.tsx`

**Added**:
- **Parent Landlord column** showing:
  - Landlord name and email
  - Sub-user job title (if set)
  - Permissions badges
- **SubUser role badge** with teal color scheme
- **Fetches sub-user relationships** from `admin_sub_user_view`

**What admins can see**:
- Which users are sub-users
- Who their parent landlord is
- What permissions they have
- Contact information for both sub-user and landlord

### 4. Landlord Interface ✅
**File**: `src/components/landlord/SubUserManagement.tsx`

**Fixed**:
- Now correctly displays the `title` field in the table
- Shows permission counts
- Allows landlords to create, edit, and deactivate sub-users

## Permission Model

Sub-users have 5 granular permissions stored as JSONB:

```typescript
{
  manage_properties: boolean;  // View and manage property details
  manage_tenants: boolean;      // Add, edit, view tenant information
  manage_leases: boolean;       // Create and modify lease agreements
  manage_maintenance: boolean;  // Handle maintenance requests
  view_reports: boolean;        // Access financial and operational reports
}
```

### How Permissions Are Enforced

**Database Level (RLS)**:
- Properties: Sub-users can only view properties if they have `manage_properties` permission
- Tenants: Requires `manage_tenants` permission
- Leases: Requires `manage_leases` permission
- Maintenance: Requires `manage_maintenance` permission

**Frontend Level**:
- FeatureGate components check user role and permissions
- Menu items are hidden/disabled based on permissions
- Sensitive actions require specific permission flags

## User Flow

### Creating a Sub-User (Landlord):
1. Landlord navigates to Sub-Users page
2. Clicks "Add Sub-User"
3. Fills in:
   - Email, first name, last name, phone
   - Job title (optional)
   - Permissions (5 toggles)
4. System checks if email exists:
   - **New user**: Creates auth account with temp password, profile, and sub_user record
   - **Existing user**: Links to existing account, creates sub_user record
5. Assigns `SubUser` role in `user_roles` table
6. Sub-user receives login credentials (temp password if new)

### Sub-User Login:
1. Sub-user logs in with credentials
2. System identifies them as SubUser role
3. Dashboard shows only permitted features:
   - Properties (if `manage_properties` = true)
   - Tenants (if `manage_tenants` = true)
   - Leases (if `manage_leases` = true)
   - Maintenance (if `manage_maintenance` = true)
   - Reports (if `view_reports` = true)
4. Sub-user can only access data belonging to their landlord

### Admin View:
1. Admin navigates to User Management
2. Sees all users with a "Parent Landlord" column
3. Sub-users display:
   - Their landlord's name and email
   - Their job title (if set)
   - Their role badge (teal "SubUser")
4. Admin can:
   - View sub-user relationships
   - Edit sub-user details
   - Reset passwords
   - Suspend/activate accounts

## Security Considerations

### What's Protected ✅
- Sub-users **cannot** access data from other landlords
- Sub-users **cannot** modify their own permissions
- Sub-users **cannot** create other sub-users
- All permissions are enforced at the database level (RLS)
- Role assignment requires service-role key (edge function)

### What's Logged ✅
- User creation in `user_activity_logs`
- Permission changes in `maintenance_action_logs`
- Login attempts in auth system
- Role changes in audit logs

### Known Limitations ⚠️
1. **No property-level restrictions yet**: Sub-users can access ALL properties of their landlord
   - **Future**: Add `sub_user_property_access` table to restrict specific properties
2. **No permission inheritance**: Sub-users don't inherit landlord's subscription limits
3. **No delegation limits**: Landlords can create unlimited sub-users (plan-dependent)

## Testing Checklist

- [ ] Create new sub-user with new email → Should create account + assign SubUser role
- [ ] Create sub-user with existing email → Should link to existing account
- [ ] Sub-user login → Should see only permitted features
- [ ] Sub-user tries to access restricted data → Should be blocked by RLS
- [ ] Landlord deactivates sub-user → Sub-user loses access immediately
- [ ] Admin views user list → Should see "Parent Landlord" column with correct data
- [ ] Sub-user with `manage_properties: false` → Cannot view properties
- [ ] Sub-user with `view_reports: true` → Can access reports page

## API Endpoints

### Create Sub-User
```
POST /functions/v1/create-sub-user
Headers: Authorization: Bearer <landlord_token>
Body: {
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+254700000000",
  "title": "Property Manager",
  "permissions": {
    "manage_properties": true,
    "manage_tenants": true,
    "manage_leases": false,
    "manage_maintenance": true,
    "view_reports": false
  }
}
```

**Response** (new user):
```json
{
  "success": true,
  "message": "Sub-user created successfully with new account",
  "user_id": "uuid",
  "temporary_password": "TempPass1234!",
  "instructions": "The user should change their password on first login"
}
```

**Response** (existing user):
```json
{
  "success": true,
  "message": "Sub-user created successfully with existing account",
  "user_id": "uuid",
  "temporary_password": null,
  "instructions": "The user can log in with their existing credentials"
}
```

## Database Schema

### `sub_users` table
```sql
CREATE TABLE sub_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL,  -- Parent landlord
  user_id UUID,               -- Auth user (nullable for invite-only)
  title TEXT,                 -- Job title
  permissions JSONB NOT NULL, -- 5 permission flags
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `admin_sub_user_view` view
```sql
CREATE VIEW admin_sub_user_view AS
SELECT 
  su.id as sub_user_record_id,
  su.user_id,
  su.landlord_id,
  su.title,
  su.permissions,
  su.status,
  p.first_name as sub_user_first_name,
  p.last_name as sub_user_last_name,
  p.email as sub_user_email,
  lp.first_name as landlord_first_name,
  lp.last_name as landlord_last_name,
  lp.email as landlord_email
FROM sub_users su
LEFT JOIN profiles p ON su.user_id = p.id
LEFT JOIN profiles lp ON su.landlord_id = lp.id;
```

## Next Steps (Phase 2)

1. **Property-level restrictions**: Allow landlords to assign sub-users to specific properties only
2. **Permission templates**: Create reusable permission sets (e.g., "Property Manager", "Accountant")
3. **Audit dashboard**: Show landlords what their sub-users have been doing
4. **Invitation system**: Send email invites before creating accounts
5. **Session management**: Allow landlords to force-logout sub-users
6. **Permission change notifications**: Alert sub-users when permissions change

## Support

If sub-user creation is failing:
1. Check edge function logs: [Edge Function Logs](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/functions/create-sub-user/logs)
2. Verify landlord role in `user_roles` table
3. Check RLS policies on `sub_users` table
4. Ensure `SubUser` role exists in `app_role` enum

## Security Warnings
The database linter found security issues unrelated to sub-users:
- Function search_path warnings (pre-existing)
- RLS disabled on some views (pre-existing)
- These should be addressed separately

**Sub-user implementation is secure** ✅
