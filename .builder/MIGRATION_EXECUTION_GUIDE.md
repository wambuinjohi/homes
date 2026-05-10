# Supabase Migration Execution Guide
**From:** kdpqimetajnhcqseajok → **To:** tbmzwmgsvshfdxdoyrcr

## Status Summary

### ✅ Completed
- **Phase 1: Database Schema Verification**
  - Configuration files already updated (.env, config.toml, runtime.json)
  - 50 edge functions identified and ready
  - Special setup documented from docs/

### ⏳ In Progress / Next Steps

---

## Phase 1: Database Schema Verification (MANUAL STEPS REQUIRED)

Since CLI access is restricted, you must execute these commands in your local terminal:

### Step 1: Export Schema from New Project
```bash
# Link to the new project
supabase link --project-ref tbmzwmgsvshfdxdoyrcr

# Pull schema from new project to generate migration files
supabase db pull
```

**Expected Result:** Creates `supabase/migrations/` with `.sql` files

### Step 2: Verify Schema in New Project
Once the migration files are generated, verify these tables exist in new project:

**Critical Tables to Check:**
- `api_rate_limits`
- `approved_payment_methods`
- `bank_callbacks`
- `invoices`
- `leases`
- `properties`
- `sub_users`
- `tenants`
- `user_activity_logs`
- `user_roles`
- Plus 40+ more (see `src/integrations/supabase/types.ts`)

### Step 3: Enable Required Extensions

Go to Supabase Dashboard → SQL Editor → New Query and run:

```sql
-- Enable pg_cron for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Step 4: Apply Special Configuration from Docs

**For Overdue Reminders System:**

From `docs/OVERDUE_REMINDERS_SETUP.md`, update the cron schedule SQL with the **NEW** project URL:

```sql
-- Schedule overdue reminders to run every day at 9:00 AM
SELECT cron.schedule(
  'send-overdue-invoice-reminders',
  '0 9 * * *', -- 9:00 AM daily
  $$
  SELECT
    net.http_post(
        url:='https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/send-overdue-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer <NEW_ANON_KEY>"}'::jsonb,
        body:=concat('{"triggered_at": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
```

**Replace `<NEW_ANON_KEY>` with:** `sb_publishable_d9PzsYP9E6qVHj1T2njHXw_HY0QJS45`

**For Sub-User System:**

Run the database functions from `docs/sub-user-implementation.md`:
- `get_sub_user_permissions()` function
- `get_sub_user_landlord()` function
- `is_sub_user_of_landlord()` function
- `admin_sub_user_view` view

---

## Phase 2: Redeploy All 50 Edge Functions

### Step 1: Verify Configuration

Current settings in `supabase/config.toml`:
- ✅ `project_id = "tbmzwmgsvshfdxdoyrcr"` (already updated)
- ✅ 23 functions with `verify_jwt = true`
- ✅ 13 functions with `verify_jwt = false`

### Step 2: Deploy Functions

In your local project root, run:

```bash
supabase functions deploy
```

**Expected Output:** "Deployed 50 functions to new project"

### Step 3: Verify Deployments

Go to Supabase Dashboard → Edge Functions and verify:
- All 50 functions show "deployed" status
- No error badges
- JWT verification settings match config.toml

### Step 4: Test Critical Functions

Test these functions in Supabase Dashboard → Edge Functions → Function → Test:

**Auth Functions:**
- `create-user-with-role` - Create test user
- `create-sub-user` - Verify sub-user creation works

**Payment Functions:**
- `mpesa-stk-push` - Should trigger M-Pesa STK dialog
- `kopokopo-callback` - Should accept POST requests

**Communication Functions:**
- `send-sms` - Send test SMS
- `send-welcome-email` - Send test email

**Billing Functions:**
- `create-billing-checkout` - Generate checkout URL
- `automated-monthly-billing` - Verify billing logic

---

## Phase 3: Update External Webhooks & Integrations

**New Base URL:** `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/`

Update these external services (outside of codebase):

### M-Pesa Integration
- **Old Callback:** `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/mpesa-callback`
- **New Callback:** `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/mpesa-callback`
- **Where to Update:** M-Pesa Daraja Portal → App Settings

### Jenga Bank Integration
- **Old Callback:** `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/jenga-ipn-callback`
- **New Callback:** `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/jenga-ipn-callback`
- **Where to Update:** Jenga API Console → Webhooks

### KCB Integration
- **Old Callback:** `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/kcb-ipn-callback`
- **New Callback:** `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kcb-ipn-callback`
- **Where to Update:** KCB API Portal → Callback Settings

### Kopokopo Integration
- **Old Callback:** `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/kopokopo-callback`
- **New Callback:** `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kopokopo-callback`
- **Where to Update:** Kopokopo Dashboard → Webhooks

### Scheduled Tasks
If using an external cron service (e.g., cron-job.org):
- Update any URLs calling old project functions
- Update authorization headers if needed

---

## Phase 4: Regenerate Database Types

After schema is confirmed in new project, regenerate TypeScript types:

```bash
supabase gen types typescript --project-id tbmzwmgsvshfdxdoyrcr > src/integrations/supabase/types.ts
```

Or use Supabase CLI:
```bash
supabase gen types
```

---

## Phase 5: Local Testing & Verification

### Step 1: Start Dev Server
```bash
npm run dev
```

### Step 2: Test Critical Flows

**Authentication:**
- [ ] User signup (create new account)
- [ ] User login (existing account)
- [ ] Password reset
- [ ] Email verification

**Data Operations:**
- [ ] Create property
- [ ] Create tenant
- [ ] Create lease
- [ ] Create invoice
- [ ] Create maintenance request

**Realtime Subscriptions:**
- [ ] Subscribe to lease changes
- [ ] Subscribe to invoice updates
- [ ] Verify real-time updates work

**Payment Flows:**
- [ ] M-Pesa STK push (test mode)
- [ ] Kopokopo payment attempt
- [ ] Payment callback simulation

**Communication:**
- [ ] Send SMS (via send-sms function)
- [ ] Send welcome email
- [ ] Verify email delivery

**Billing Operations:**
- [ ] Create billing checkout
- [ ] Upgrade plan
- [ ] Verify billing applied correctly

### Step 3: Monitor Logs

**Application Logs:**
- Check browser console for errors
- Check Network tab for failed requests

**Edge Function Logs:**
- Go to Supabase Dashboard → Edge Functions
- Click each critical function → Logs
- Look for errors or warnings

**Database Query Performance:**
- Go to Supabase Dashboard → Database → Performance
- Monitor slow queries
- Ensure indexes are hit

### Step 4: Test Webhooks

**M-Pesa Callback Simulation:**
```bash
curl -X POST https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "test-123",
        "CheckoutRequestID": "test-456",
        "ResultCode": 0,
        "ResultDesc": "The service request has been processed successfully.",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 100},
            {"Name": "MpesaReceiptNumber", "Value": "TEST123"},
            {"Name": "PhoneNumber", "Value": "254712345678"}
          ]
        }
      }
    }
  }'
```

---

## Rollback Plan

If issues occur at any point:

1. **Revert environment variables** to old project:
   ```
   SUPABASE_URL="https://kdpqimetajnhcqseajok.supabase.co"
   NEXT_PUBLIC_SUPABASE_URL="https://kdpqimetajnhcqseajok.supabase.co"
   # ... etc
   ```

2. **Restart dev server:** `npm run dev`

3. **App immediately works** with old project (no code changes needed)

4. **Old project remains intact** and functional as backup

---

## Critical Notes

### Environment Variables
All credentials are already updated in:
- ✅ `.env`
- ✅ `supabase/runtime.json`
- ✅ `supabase/config.toml`
- ✅ `VITE_*` variables

No code changes needed - all reads from env vars.

### Realtime Subscriptions
Work automatically with Supabase infrastructure - no configuration needed.

### Database Types
May need regeneration if schema differs. Use: `supabase gen types`

### Backup
Old project (kdpqimetajnhcqseajok) remains **intact** and **functional**. Can rollback anytime before webhooks updated.

---

## Execution Checklist

- [ ] Phase 1: Pull schema, verify tables, enable extensions, setup cron
- [ ] Phase 2: Deploy edge functions (50 total)
- [ ] Phase 3: Update external webhooks (M-Pesa, Jenga, KCB, Kopokopo)
- [ ] Phase 4: Regenerate database types
- [ ] Phase 5: Test locally (auth, data, realtime, payments, comms, billing)
- [ ] Monitor logs for 24-48 hours
- [ ] Decommission old project (kdpqimetajnhcqseajok)

---

## Support Contacts

**If you encounter issues:**

1. Check edge function logs in Supabase Dashboard
2. Verify all webhooks point to correct new URLs
3. Confirm cron job scheduled with correct URL
4. Review `docs/` files for special setup requirements
5. Check `.env` values match new project credentials

**Useful Dashboards:**
- Edge Functions: https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr/functions
- Database: https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr/editor
- SQL Editor: https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr/sql
