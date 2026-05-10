# Migration Quick Reference

## Project IDs
- **Old:** `kdpqimetajnhcqseajok`
- **New:** `tbmzwmgsvshfdxdoyrcr`

## New Project URLs
- **API:** `https://tbmzwmgsvshfdxdoyrcr.supabase.co`
- **Functions Base:** `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/`
- **Dashboard:** https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr

## Environment Variables (Already Updated)
```
SUPABASE_URL=https://tbmzwmgsvshfdxdoyrcr.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://tbmzwmgsvshfdxdoyrcr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_d9PzsYP9E6qVHj1T2njHXw_HY0QJS45
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...qSMTG0bkieek
```

## CLI Commands

### Phase 1: Schema
```bash
supabase link --project-ref tbmzwmgsvshfdxdoyrcr
supabase db pull
```

### Phase 2: Deploy Functions
```bash
supabase functions deploy
```

### Phase 4: Generate Types
```bash
supabase gen types typescript --project-id tbmzwmgsvshfdxdoyrcr > src/integrations/supabase/types.ts
```

### Phase 5: Dev Server
```bash
npm run dev
```

## SQL Commands (Supabase Dashboard SQL Editor)

### Enable Extensions
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Schedule Overdue Reminders (9:00 AM Daily)
```sql
SELECT cron.schedule(
  'send-overdue-invoice-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/send-overdue-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_d9PzsYP9E6qVHj1T2njHXw_HY0QJS45"}'::jsonb,
    body:=concat('{"triggered_at": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
```

### View Scheduled Jobs
```sql
SELECT * FROM cron.job;
```

### View Cron Logs
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

## Webhook URLs

| Service | New Endpoint |
|---------|--------------|
| M-Pesa | `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/mpesa-callback` |
| Jenga | `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/jenga-ipn-callback` |
| KCB | `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kcb-ipn-callback` |
| Kopokopo | `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kopokopo-callback` |

## Anon Key (Public)
```
sb_publishable_d9PzsYP9E6qVHj1T2njHXw_HY0QJS45
```

## Service Role Key (Secret)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXp3bWdzdnNoZmR4ZG95cmNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI3NjMwOCwiZXhwIjoyMDkzODUyMzA4fQ.qvK0Czo_TeyLSBRPevcL6TNAu8f5E8uqSMTG0bkieek
```

## Testing

### Test M-Pesa Callback
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

### Manual Trigger Overdue Reminders
```bash
curl -X POST https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/send-overdue-reminders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sb_publishable_d9PzsYP9E6qVHj1T2njHXw_HY0QJS45" \
  -d '{"triggered_at": "manual-test"}'
```

## Edge Functions (50 Total)

### Auth Functions (6)
- create-admin-user
- create-user-with-role
- create-user-with-custom-trial
- create-sub-user
- create-tenant-account
- admin-user-operations

### Payment Functions (15)
- mpesa-stk-push
- mpesa-callback
- jenga-stk-push
- jenga-ipn-callback
- kcb-stk-push
- kcb-ipn-callback
- kopokopo-callback
- test-kopokopo-credentials
- create-billing-checkout
- confirm-billing-upgrade
- check-mpesa-availability
- save-mpesa-credentials

### Communication Functions (8)
- send-sms
- send-sms-with-logging
- send-welcome-email
- send-test-email
- send-password-reset
- send-notification-email
- send-maintenance-notification
- test-sms
- sms-health-check

### Billing Functions (4)
- activate-billing-plan
- automated-monthly-billing
- admin-assign-plan
- generate-service-invoice
- trial-manager

### Admin Functions (3)
- log-security-event
- get-user-audit
- get-user-sessions

### Telemetry Functions (3)
- telemetry-heartbeat
- telemetry-events
- telemetry-errors

### System Functions (4)
- configure-smtp
- get-sms-provider
- list-landlord-sub-users
- send-overdue-reminders

## Configuration Files Status

| File | Status |
|------|--------|
| `.env` | ✅ Updated to new project |
| `supabase/config.toml` | ✅ Updated (project_id) |
| `supabase/runtime.json` | ✅ Updated (url, keys) |
| `src/integrations/supabase/types.ts` | ⏳ Will update in Phase 4 |

## Task List

- [x] Phase 1: Verify database schema
- [ ] Phase 2: Redeploy all 50 edge functions
- [ ] Phase 3: Update external webhooks and integrations
- [ ] Phase 4: Regenerate database types
- [ ] Phase 5: Local testing and verification

## Documentation Files

- `.builder/MIGRATION_SUMMARY.md` - Full overview
- `.builder/MIGRATION_EXECUTION_GUIDE.md` - Detailed steps
- `.builder/MIGRATION_SQL_SCRIPTS.sql` - Ready-to-copy SQL
- `.builder/QUICK_REFERENCE.md` - This file

## Rollback Quick Steps

If needed, before Phase 3:
```bash
# Revert .env to old project
SUPABASE_URL="https://kdpqimetajnhcqseajok.supabase.co"
NEXT_PUBLIC_SUPABASE_URL="https://kdpqimetajnhcqseajok.supabase.co"

# Restart dev server
npm run dev

# App works with old project immediately
```

---

**Start with:** `.builder/MIGRATION_EXECUTION_GUIDE.md` for Phase 1
