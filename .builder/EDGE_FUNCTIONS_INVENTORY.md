# Edge Functions Complete Inventory
**Total Functions:** 49  
**Deployment Target:** tbmzwmgsvshfdxdoyrcr

---

## Functions by Category

### Authentication & User Management (6)
- `create-admin-user` - [verify_jwt: true]
- `create-user-with-role` - [verify_jwt: true]
- `create-user-with-custom-trial` - [verify_jwt: false]
- `create-sub-user` - [verify_jwt: true]
- `create-tenant-account` - [verify_jwt: false]
- `admin-user-operations` - [verify_jwt: false]

### Payment Processing (14)
- `mpesa-stk-push` - [verify_jwt: true] - Initiate M-Pesa STK dialog
- `mpesa-callback` - [verify_jwt: false] - Webhook for M-Pesa confirmations
- `check-mpesa-availability` - [verify_jwt: false] - Check M-Pesa service availability
- `save-mpesa-credentials` - [verify_jwt: true] - Update M-Pesa config
- `jenga-stk-push` - [verify_jwt: true] - Initiate Jenga payment
- `jenga-ipn-callback` - [verify_jwt: false] - Webhook for Jenga confirmations
- `kcb-stk-push` - [verify_jwt: true] - Initiate KCB payment
- `kcb-ipn-callback` - [verify_jwt: false] - Webhook for KCB confirmations
- `kopokopo-callback` - [verify_jwt: false] - Webhook for Kopokopo confirmations
- `test-kopokopo-credentials` - [verify_jwt: true] - Test Kopokopo API
- `kopokopo-verify` - [verify_jwt: true] - Verify Kopokopo payment
- `create-billing-checkout` - [verify_jwt: true] - Generate subscription checkout
- `confirm-billing-upgrade` - [verify_jwt: true] - Confirm plan upgrade
- `activate-billing-plan` - [verify_jwt: true] - Activate new billing plan

### Communication (11)
- `send-sms` - [verify_jwt: true] - Send SMS via SMS provider
- `send-sms-with-logging` - [verify_jwt: false] - Send SMS with full logging
- `send-welcome-email` - [verify_jwt: true] - Welcome email to new users
- `send-test-email` - [verify_jwt: true] - Test email delivery
- `send-password-reset` - [verify_jwt: false] - Password reset email
- `send-notification-email` - [verify_jwt: true] - Generic notification emails
- `send-maintenance-notification` - [verify_jwt: true] - Maintenance alert emails
- `send-tenant-welcome-notifications` - [verify_jwt: true] - Tenant onboarding
- `send-notification` - [verify_jwt: false] - Generic notification dispatch
- `sms-health-check` - [verify_jwt: true] - SMS provider health check
- `get-sms-provider` - [verify_jwt: true] - Get active SMS provider info

### Billing & Subscriptions (5)
- `admin-assign-plan` - [verify_jwt: true] - Admin plan assignment
- `automated-monthly-billing` - [verify_jwt: true] - Monthly billing cron job
- `generate-service-invoice` - [verify_jwt: true] - Generate invoice PDF
- `trial-manager` - [verify_jwt: true] - Trial period management
- `trial-reminder` - [verify_jwt: true] - Trial expiry reminder

### System & Maintenance (5)
- `send-overdue-reminders` - [verify_jwt: false] - Daily cron: send overdue SMS
- `configure-smtp` - [verify_jwt: true] - Configure email settings
- `update-invoice-status` - [verify_jwt: false] - Update invoice status webhook
- `update-user-email` - [verify_jwt: true] - Update user email address
- `log-security-event` - [verify_jwt: true] - Log security events

### Analytics & Monitoring (6)
- `telemetry-heartbeat` - [verify_jwt: false] - Application heartbeat
- `telemetry-events` - [verify_jwt: false] - Event tracking
- `telemetry-errors` - [verify_jwt: false] - Error reporting
- `get-user-audit` - [verify_jwt: true] - User activity audit log
- `get-user-sessions` - [verify_jwt: true] - User session history
- `list-landlord-sub-users` - [verify_jwt: true] - List sub-users for landlord

### Reporting (2)
- `generate-pdf-report` - [verify_jwt: true] - Generate PDF reports
- `pdf-health` - [verify_jwt: false] - PDF generation service health

---

## JWT Verification Status

### With JWT Verification (verify_jwt: true) - 24 functions
These require valid authentication token:
1. activate-billing-plan
2. admin-assign-plan
3. check-mpesa-availability
4. confirm-billing-upgrade
5. create-admin-user
6. create-billing-checkout
7. create-sub-user
8. create-user-with-role
9. generate-pdf-report
10. generate-service-invoice
11. get-sms-provider
12. get-user-audit
13. get-user-sessions
14. jenga-stk-push
15. kcb-stk-push
16. kopokopo-verify
17. list-landlord-sub-users
18. log-security-event
19. mpesa-stk-push
20. save-mpesa-credentials
21. send-maintenance-notification
22. send-notification-email
23. send-sms
24. send-tenant-welcome-notifications
25. send-test-email
26. send-welcome-email
27. sms-health-check
28. test-kopokopo-credentials
29. trial-manager
30. trial-reminder
31. update-user-email

### Without JWT Verification (verify_jwt: false) - 18 functions
These accept unauthenticated requests (webhooks, callbacks, telemetry):
1. admin-user-operations
2. automated-monthly-billing
3. check-mpesa-availability
4. create-tenant-account
5. create-user-with-custom-trial
6. jenga-ipn-callback
7. kcb-ipn-callback
8. kopokopo-callback
9. log-security-event
10. mpesa-callback
11. pdf-health
12. send-notification
13. send-overdue-reminders
14. send-password-reset
15. send-sms-with-logging
16. telemetry-errors
17. telemetry-events
18. telemetry-heartbeat
19. update-invoice-status

---

## Deployment Checklist

### Pre-Deployment
- [ ] Verify `.env` points to new project
- [ ] Verify `supabase/config.toml` has correct project_id
- [ ] Verify all webhook URLs in config (if any)
- [ ] Ensure new project database schema exists
- [ ] Check PostgreSQL extensions are enabled (pg_cron, pg_net)

### Deployment
- [ ] Run: `supabase functions deploy`
- [ ] Wait for 49 functions to be deployed
- [ ] Verify no errors in deployment output

### Post-Deployment
- [ ] Go to Supabase Dashboard → Edge Functions
- [ ] Verify all 49 functions show "deployed" status
- [ ] Check for error badges or warnings
- [ ] Review function logs for initialization errors
- [ ] Test critical functions in dashboard:
  - [ ] `create-user-with-role` → create test user
  - [ ] `send-sms` → send test message
  - [ ] `mpesa-stk-push` → initiate test payment
  - [ ] `send-welcome-email` → send test email

### Integration Testing
- [ ] Verify M-Pesa callback endpoint works
- [ ] Verify Jenga callback endpoint works
- [ ] Verify KCB callback endpoint works
- [ ] Verify Kopokopo callback endpoint works
- [ ] Test scheduled cron jobs (overdue reminders, monthly billing)

---

## Critical Functions - Priority Order

**Test in this order for confidence:**

1. **`create-user-with-role`** (Auth)
   - Essential for user creation
   - Depends on: auth system, database

2. **`send-welcome-email`** (Communication)
   - Tests email delivery
   - Depends on: SMTP config, Resend API

3. **`send-sms`** (Communication)
   - Tests SMS delivery
   - Depends on: SMS provider credentials

4. **`mpesa-stk-push`** (Payment)
   - Core payment flow
   - Depends on: M-Pesa credentials, callback URL

5. **`create-billing-checkout`** (Billing)
   - Creates subscription checkout
   - Depends on: database, payment providers

6. **`send-overdue-reminders`** (System)
   - Cron-triggered
   - Depends on: database, SMS provider, scheduler

7. **`telemetry-events`** (Analytics)
   - Background tracking
   - Depends on: database write access

---

## Environment Variables Used by Functions

### M-Pesa Functions
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_ENVIRONMENT`
- `MPESA_ENCRYPTION_KEY`

### SMS Functions
- `TWILIO_ACCOUNT_SID` (if using Twilio)
- `TWILIO_AUTH_TOKEN` (if using Twilio)
- `SMS_API_KEY` (if using other provider)

### Email Functions
- `RESEND_API_KEY`
- Email configuration in `supabase/config.toml`

### Payment Functions (Kopokopo, Jenga, KCB)
- `KOPOKOPO_API_KEY`
- `KOPOKOPO_BUSINESS_SHORTCODE`
- `JENGA_API_KEY`
- `JENGA_MERCHANT_CODE`
- `KCB_API_KEY`
- `KCB_MERCHANT_CODE`

All environment variables should already be in `.env` and will be available to functions at runtime.

---

## Function Dependencies

### Database Functions Requiring Specific Tables
- `create-sub-user` → requires `sub_users`, `user_roles` tables
- `generate-service-invoice` → requires `invoices`, `services` tables
- `send-overdue-reminders` → requires `invoices`, `invoice_overdue_reminders`, `tenants` tables
- `get-user-audit` → requires `user_activity_logs` table
- `get-user-sessions` → requires `auth.sessions` table

### External Service Functions
- `mpesa-stk-push` → requires M-Pesa API credentials
- `jenga-stk-push` → requires Jenga API credentials
- `kcb-stk-push` → requires KCB API credentials
- `kopokopo-verify` → requires Kopokopo API credentials
- `send-sms` → requires SMS provider credentials
- `send-welcome-email` → requires SMTP/Resend API

### Cron-Scheduled Functions
- `send-overdue-reminders` → scheduled via `cron.schedule()`
- `automated-monthly-billing` → scheduled via `cron.schedule()`
- `trial-reminder` → may have scheduled execution

### Functions That Call Other Functions
- `create-billing-checkout` → may call `create-service-invoice`
- `activated-billing-plan` → may call billing-related functions
- `send-tenant-welcome-notifications` → calls `send-sms`, `send-welcome-email`

---

## Testing URLs

### New Project Functions Base URL
```
https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/
```

### Example Test Calls

**With Authorization (JWT Required):**
```bash
curl -X POST https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/send-sms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"phone_number": "+254712345678", "message": "Test"}'
```

**Without Authorization (Webhooks):**
```bash
curl -X POST https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{"Body": {...}}'
```

---

## Function Status After Migration

**All 49 functions will:**
- ✅ Point to new project database
- ✅ Use new project credentials from `.env`
- ✅ Accept webhook callbacks at new URLs
- ✅ Store logs in new project
- ✅ Read from environment variables automatically

**No changes needed in function code - configuration only.**

---

## Monitoring & Logs

After deployment, monitor:

1. **Deployment Logs:** Supabase Dashboard → Edge Functions
2. **Function Execution Logs:** Click each function → Logs tab
3. **Error Tracking:** Look for failed executions
4. **Performance:** Check execution times
5. **HTTP Requests:** View incoming webhook requests

---

**Ready to Deploy?**

Phase 2 of migration: Run `supabase functions deploy`
