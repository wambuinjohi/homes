# Supabase Database Migration - Execution Steps

## Overview
Migrate from `kdpqimetajnhcqseajok` (old) to `tbmzwmgsvshfdxdoyrcr` (new) with 50+ edge functions and 520 migration files.

---

## Pre-Execution Checklist

- [x] All configuration files updated in codebase
- [x] Environment variables prepared
- [x] Hardcoded URLs/IDs replaced
- [ ] Backup of old project (KEEP INTACT)
- [ ] New Supabase project created and accessible
- [ ] PostgreSQL connection string verified

**Connection String**:
```
postgresql://postgres:Sirgeorge.1234@db.tbmzwmgsvshfdxdoyrcr.supabase.co:5432/postgres
```

---

## Phase 1: Database Schema Migration

### Step 1.1: Verify Migration Files
All 520 migration files are present in `supabase/migrations/`.

### Step 1.2: Link Supabase CLI to New Project
```bash
# If not already linked, authenticate with Supabase
supabase login

# Link to new project
supabase link --project-ref tbmzwmgsvshfdxdoyrcr
```

### Step 1.3: Push Migrations to New Database
```bash
# Push all 520 migration files to new project
supabase db push

# Expected output:
# - Migrations applied successfully
# - All tables, functions, triggers created
# - RLS policies enforced
```

### Step 1.4: Verify Schema Integrity
```bash
# Check that all tables exist
supabase db remote commit

# Test database connectivity
psql "postgresql://postgres:Sirgeorge.1234@db.tbmzwmgsvshfdxdoyrcr.supabase.co:5432/postgres" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

---

## Phase 2: Deploy Edge Functions

### Step 2.1: Deploy All Functions
```bash
# Deploy all 50+ edge functions
supabase functions deploy

# Expected output:
# - Each function deployed successfully
# - URLs available at:
#   https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/{function-name}
```

### Step 2.2: Verify Function Deployment
```bash
# Test a health check function
curl https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/sms-health-check

# Test PDF generation function
curl https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/pdf-health

# Expected: Functions respond with 200/success
```

### Step 2.3: Check Function Logs
```bash
# View logs for deployed functions
supabase functions list

# Check individual function logs in Supabase dashboard
# Navigation: Project → Functions → [Function Name] → Logs
```

---

## Phase 3: Local Development Testing

### Step 3.1: Start Dev Server
```bash
# Start the development server with new project
npm run dev

# Expected:
# - Server starts on http://localhost:5173 (or configured port)
# - Connects to new Supabase project
# - No authentication errors
```

### Step 3.2: Test Authentication
1. **Open app in browser**: http://localhost:5173
2. **Test login flow**:
   - Navigate to login/signup page
   - Create test account OR login with existing credentials
   - Verify session is established
   - Check browser storage for `sb-tbmzwmgsvshfdxdoyrcr-auth-token`

3. **Test sign out**:
   - Click sign out
   - Verify browser storage is cleared
   - Verify redirect to auth page

### Step 3.3: Test Database Connectivity
```javascript
// Open browser console and run:
const { data, error } = await supabase
  .from('users')
  .select('*')
  .limit(1);

console.log(data);  // Should return user data
console.log(error); // Should be null
```

### Step 3.4: Test Realtime Subscriptions
```javascript
// Test realtime data changes
const subscription = supabase
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'users' },
    (payload) => console.log('Realtime update:', payload)
  )
  .subscribe();

// Make a change in your app and verify update appears
```

---

## Phase 4: Payment Gateway Testing

### Step 4.1: M-Pesa Configuration
```javascript
// Test M-Pesa credentials save
const { data, error } = await supabase.functions.invoke('save-mpesa-credentials', {
  body: {
    shortcode: 'YOUR_SHORTCODE',
    passkey: 'YOUR_PASSKEY',
    // ... other credentials
  }
});
```

### Step 4.2: M-Pesa STK Push
```javascript
// Test M-Pesa payment request
const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
  body: {
    phone_number: '+254722241745',
    amount: 100,
    reference: 'TEST-001'
  }
});
```

### Step 4.3: Kopokopo Integration
```javascript
// Test Kopokopo configuration
const { data, error } = await supabase.functions.invoke('test-kopokopo-credentials', {
  body: {
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET'
  }
});
```

### Step 4.4: Jenga PAY Integration
```javascript
// Test Jenga STK push
const { data, error } = await supabase.functions.invoke('jenga-stk-push', {
  body: {
    phone_number: '+254722241745',
    amount: 100,
    reference: 'TEST-002'
  }
});
```

---

## Phase 5: Notification System Testing

### Step 5.1: Email Notifications
```javascript
// Test welcome email
const { data, error } = await supabase.functions.invoke('send-welcome-email', {
  body: {
    to_email: 'test@example.com',
    user_name: 'Test User'
  }
});
```

### Step 5.2: SMS Notifications
```javascript
// Test SMS sending
const { data, error } = await supabase.functions.invoke('send-sms', {
  body: {
    phone_number: '+254722241745',
    message: 'Test message'
  }
});
```

### Step 5.3: Overdue Reminders
```javascript
// Test overdue reminder function
const { data, error } = await supabase.functions.invoke('send-overdue-reminders', {
  body: {}
});
```

---

## Phase 6: External Webhook Configuration

### Step 6.1: M-Pesa Callback Update
1. Log in to M-Pesa merchant portal
2. Update callback URL: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/mpesa-callback`
3. Save and test

### Step 6.2: Kopokopo Webhook Update
1. Log in to Kopo Kopo dashboard
2. Update webhook URL: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kopokopo-callback`
3. Configure IP whitelisting if required
4. Test webhook delivery

### Step 6.3: Jenga PAY IPN Update
1. Update Jenga merchant settings
2. Set IPN callback URL: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/jenga-ipn-callback`
3. Configure authentication if required

### Step 6.4: KCB Buni IPN Update
1. Update KCB dashboard
2. Set IPN callback URL: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kcb-ipn-callback`

### Step 6.5: Cron Job Updates
Update all external cron jobs pointing to edge functions:
- `send-overdue-reminders`: Daily trigger
- `automated-monthly-billing`: Monthly trigger

---

## Phase 7: Comprehensive Testing

### Step 7.1: Critical User Flows
Test these end-to-end workflows:

**Admin Flow**:
- [ ] Admin login
- [ ] Create tenant
- [ ] Assign property
- [ ] View dashboard

**Landlord Flow**:
- [ ] Landlord login
- [ ] Configure payment methods
- [ ] Create invoice
- [ ] Monitor payments
- [ ] Send notifications

**Tenant Flow**:
- [ ] Tenant login
- [ ] View invoice
- [ ] Make M-Pesa payment
- [ ] Receive confirmation

### Step 7.2: Payment Processing
- [ ] M-Pesa payment inquiry
- [ ] M-Pesa transaction completion
- [ ] Kopokopo payment processing
- [ ] Jenga PAY transaction
- [ ] KCB payment receipt
- [ ] Callback webhook processing
- [ ] Invoice reconciliation

### Step 7.3: Notifications
- [ ] Welcome email sent
- [ ] Password reset email
- [ ] Payment confirmation SMS
- [ ] Overdue reminder SMS
- [ ] Billing notification email

### Step 7.4: Data Integrity
- [ ] User data accessible
- [ ] Payment records created
- [ ] Invoice generation
- [ ] Billing calculations correct
- [ ] Realtime updates working

---

## Phase 8: Monitoring & Performance

### Step 8.1: Edge Function Logs
```bash
# Monitor function execution
supabase functions logs

# Check for errors in production
# View in Supabase dashboard: Functions → [Function] → Logs
```

### Step 8.2: Database Performance
```bash
# Check query performance
# Supabase dashboard: Database → Logs → Queries
```

### Step 8.3: Error Tracking
- Monitor Sentry/error tracking service for new project
- Check for missing environment variables
- Verify API rate limits

### Step 8.4: Webhook Delivery
- Check payment provider dashboards for webhook delivery status
- Verify callback processing logs
- Monitor for failed deliveries

---

## Phase 9: Production Deployment

### Step 9.1: Final Verification
- [ ] All tests passed locally
- [ ] No breaking errors in logs
- [ ] Payment processing works end-to-end
- [ ] Notifications being sent correctly
- [ ] Performance acceptable

### Step 9.2: Deploy to Production
```bash
# Push code changes to production
git push origin main

# Deployment via CI/CD (GitHub, Vercel, etc.)
# Monitor deployment logs
```

### Step 9.3: Post-Deployment Monitoring
- [ ] Monitor error rates in production
- [ ] Check payment processing
- [ ] Verify webhook callbacks
- [ ] Monitor database load
- [ ] Check API response times

---

## Rollback Procedure

If issues occur in production:

### Quick Rollback (< 15 minutes)
```bash
# Revert .env to old credentials
git checkout HEAD -- .env
supabase/runtime.json
supabase/config.toml

# Restart dev server
npm run dev

# Push revert commit
git push origin main
```

### Complete Rollback (with data restoration)
1. Revert all configuration files
2. Update external webhooks back to old endpoints
3. Monitor old project for normal operation
4. Keep new project for future retry

**Note**: The old project `kdpqimetajnhcqseajok` remains fully functional during this process.

---

## Success Criteria

Migration is complete when:
- ✅ All 520 migrations applied successfully
- ✅ All 50+ edge functions deployed
- ✅ Local development server works with new project
- ✅ Authentication works without errors
- ✅ Payment flows complete successfully
- ✅ Notifications are sent correctly
- ✅ All external webhooks configured
- ✅ No errors in production logs for 24 hours
- ✅ Performance metrics are acceptable

---

## Support & Troubleshooting

### Common Issues

**Issue**: "Database connection failed"
- **Solution**: Verify PostgreSQL credentials and network access
- **Check**: `psql` connection string, firewall rules

**Issue**: "Function deployment failed"
- **Solution**: Check environment variables, verify Deno syntax
- **Check**: `supabase functions deploy --debug`

**Issue**: "Webhooks not being received"
- **Solution**: Verify callback URL is correct and accessible
- **Check**: Payment provider dashboard webhook logs

**Issue**: "Auth token storage issues"
- **Solution**: Clear browser storage and re-login
- **Check**: Browser local/session storage for new project key

### Getting Help
1. Check Supabase logs: Project → Logs
2. Check function logs: Functions → [Function] → Logs
3. Review error messages in browser console
4. Check `.env` file for missing variables

---

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Schema Migration | 5-10 min | 520 files to apply |
| Function Deployment | 5-10 min | 50+ functions to deploy |
| Local Testing | 20-30 min | Manual testing required |
| Payment Testing | 30-45 min | Each gateway needs testing |
| Webhook Configuration | 15-20 min | Requires external portal access |
| Production Deploy | 5-10 min | CI/CD automated |
| Monitoring (24h) | 1440 min | Continuous monitoring |

**Total**: ~2-3 hours execution + 24h monitoring

