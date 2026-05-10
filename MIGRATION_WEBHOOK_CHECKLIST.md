# Supabase Migration - External Webhook & Service Updates

## Migration Details
- **Old Project ID**: `kdpqimetajnhcqseajok`
- **New Project ID**: `tbmzwmgsvshfdxdoyrcr`
- **Old URL**: `https://kdpqimetajnhcqseajok.supabase.co`
- **New URL**: `https://tbmzwmgsvshfdxdoyrcr.supabase.co`

---

## 1. Payment Provider Callbacks

### M-Pesa Callbacks
**Current Endpoint**: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/mpesa-callback`
**New Endpoint**: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/mpesa-callback`

- [ ] Update M-Pesa Service callback URL in platform configuration
- [ ] Update each landlord's M-Pesa credentials (callback_url field in `landlord_mpesa_configs`)
- [ ] Test M-Pesa transaction flow
- [ ] Verify callback receipts are being processed

### Kopokopo Callbacks  
**Current Endpoint**: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/kopokopo-callback`
**New Endpoint**: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kopokopo-callback`

- [ ] Update Kopokopo webhook URL in Kopo Kopo merchant dashboard
- [ ] Verify webhook IP whitelisting if applicable
- [ ] Test Kopokopo payment transaction flow
- [ ] Check callback logs for successful processing

### Jenga PAY Callbacks
**Current Endpoint**: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/jenga-ipn-callback`
**New Endpoint**: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/jenga-ipn-callback`

- [ ] Update IPN callback URL in Jenga merchant settings
- [ ] Update all landlord Jenga configs with new callback URL
- [ ] Test Jenga STK push and IPN receipt processing
- [ ] Verify transaction reconciliation

### KCB Buni Callbacks
**Current Endpoint**: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/kcb-ipn-callback`
**New Endpoint**: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kcb-ipn-callback`

- [ ] Update KCB IPN callback URL in KCB dashboard
- [ ] Update all landlord KCB configs with new callback URL
- [ ] Test KCB payment transactions
- [ ] Monitor for failed callback deliveries

---

## 2. Scheduled Tasks & Cron Jobs

### Overdue Reminders (Daily)
**Function**: `send-overdue-reminders`
**Type**: Scheduled via external cron service

- [ ] Update cron job URL to new endpoint
- [ ] Verify cron schedule is maintained
- [ ] Monitor first execution on new project
- [ ] Check logs for successful SMS/email sends

### Automated Monthly Billing
**Function**: `automated-monthly-billing`
**Type**: Scheduled via external cron service

- [ ] Update billing cron job URL to new endpoint
- [ ] Test with test tenant to verify invoice generation
- [ ] Monitor payment processing on new project
- [ ] Verify billing notifications are sent

### Telemetry Heartbeat
**Function**: `telemetry-heartbeat`
- [ ] Update heartbeat collection endpoint if external monitoring is enabled

### SMS Health Check
**Function**: `sms-health-check`
- [ ] Update health check endpoint in monitoring system if applicable

---

## 3. Resend Email Integration

**Current Project**: Configuration in `supabase/config.toml` for SMTP
**Action Required**: Email sending uses environment variables

- [ ] Verify RESEND_API_KEY is set in new project environment
- [ ] Test email sending via `send-welcome-email` function
- [ ] Test password reset emails
- [ ] Test billing notification emails
- [ ] Check Resend dashboard for delivery confirmation

---

## 4. SMS Provider Integration

**SMS Providers**: Multiple (based on landlord selection)

- [ ] Verify SMS_PROVIDER environment variable in new project
- [ ] Test SMS sending via `send-sms` function
- [ ] Test with configured provider credentials
- [ ] Monitor SMS delivery logs
- [ ] Verify tenant notification messages are sent correctly

---

## 5. Edge Function Telemetry

**Functions**:
- `telemetry-events`
- `telemetry-errors`
- `telemetry-heartbeat`

- [ ] Update telemetry endpoint if using external service
- [ ] Verify event collection is working on new project
- [ ] Monitor error logs for function execution issues
- [ ] Check analytics dashboard for data ingestion

---

## 6. Monitoring & Alerting

If using external monitoring services (e.g., Sentry, LogRocket):

- [ ] Update project reference in monitoring integrations
- [ ] Update error reporting endpoints
- [ ] Verify session replay/monitoring is capturing events
- [ ] Test error tracking for edge functions

---

## 7. Third-Party API Integrations

### Jenga API
- [ ] Verify Jenga credentials are valid for environment
- [ ] Test API connectivity

### M-Pesa API
- [ ] Verify M-Pesa OAuth credentials in `landlord_mpesa_configs`
- [ ] Test token generation and STK push

### Kopokopo API
- [ ] Verify Kopokopo OAuth credentials
- [ ] Test API connectivity and payment verification

### KCB API
- [ ] Verify KCB credentials and environment
- [ ] Test API calls

### SMS Providers (Africastalking, Twilio, etc.)
- [ ] Update provider credentials in environment
- [ ] Test SMS sending

---

## 8. Application Testing Checklist

After all updates, verify:

### Authentication
- [ ] User login works
- [ ] Session persistence
- [ ] Sign out clears auth tokens
- [ ] Redirect to new project auth works

### Payment Flows
- [ ] M-Pesa STK push displays correctly
- [ ] Kopokopo payment processing completes
- [ ] Jenga PAY transactions are recorded
- [ ] KCB transactions are recorded
- [ ] Callback data is correctly stored

### Notifications
- [ ] Welcome emails are sent
- [ ] Overdue reminders are sent
- [ ] Payment confirmations are sent
- [ ] SMS notifications work

### Data Access
- [ ] Realtime subscriptions work
- [ ] Database queries return correct data
- [ ] RLS policies are enforced
- [ ] Billing data is accessible

### Admin Functions
- [ ] User creation works
- [ ] Tenant assignment works
- [ ] Billing configuration works
- [ ] Analytics/reporting works

---

## 9. Rollback Plan

If issues occur on the new project:

1. Revert configuration files to old credentials:
   - `.env` → old project credentials
   - `supabase/runtime.json` → old URLs and keys
   - `supabase/config.toml` → old project ID

2. Revert webhook URLs in external services to old endpoint:
   - M-Pesa callbacks
   - Kopokopo webhooks
   - Jenga IPN callbacks
   - KCB IPN callbacks

3. Restart dev server and test

**Note**: The old project remains intact and unchanged during this migration.

---

## 10. Verification Steps

### Step 1: Database Schema Verification
```bash
supabase db pull
# Verify all 520 migration files are present in new project
```

### Step 2: Edge Function Deployment
```bash
supabase functions deploy
# Verify all 50+ functions are deployed
```

### Step 3: Connectivity Test
```bash
# Test edge function invocation
curl https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/pdf-health
```

### Step 4: Local Development Test
```bash
npm run dev
# Test app in browser with new project
```

---

## Update Summary

**Files Updated**:
- ✅ `.env` - Supabase credentials
- ✅ `supabase/runtime.json` - Local dev config
- ✅ `supabase/config.toml` - Project ID and auth URL
- ✅ `vercel.json` - Supabase proxy endpoint
- ✅ `src/integrations/supabase/client.ts` - Client credentials
- ✅ `src/hooks/useAuth.tsx` - Browser storage keys
- ✅ `src/utils/securityHeaders.ts` - CSP URLs
- ✅ `src/utils/enhancedXssProtection.ts` - CSP URLs
- ✅ `src/utils/selfHostedTelemetry.ts` - Telemetry URL
- ✅ `supabase/functions/configure-smtp/index.ts` - Project ID
- ✅ `test-sms-trigger.js` - Test script credentials

**Remaining Tasks**:
1. Push migrations to new database
2. Deploy edge functions
3. Update external webhook URLs (see checklists above)
4. Test all payment flows
5. Verify notifications work
6. Monitor logs and performance
