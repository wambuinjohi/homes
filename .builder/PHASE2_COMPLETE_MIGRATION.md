# Complete Supabase Migration - Execution Steps

**Status**: Phase 1 ✅ Complete | Phase 2-5 Ready for Execution
**From**: kdpqimetajnhcqseajok → **To**: tbmzwmgsvshfdxdoyrcr
**Date**: 2025-01-XX

---

## Current Status Summary

### ✅ Phase 1: Complete - Runtime Configuration Updated

All code references have been updated to the new project:
- ✅ index.html - CSP headers & preconnect directives
- ✅ nginx.conf - Proxy configuration
- ✅ public/_redirects - Supabase redirect rules
- ✅ server.js - Fallback URL logic
- ✅ src/components/landlord/JengaPayConfig.tsx - Jenga callback URL
- ✅ src/components/landlord/KCBBuniConfig.tsx - KCB callback URL
- ✅ src/hooks/useAuth.tsx - Auth token cleanup (old + new project)
- ✅ supabase/config.toml - Project ID set to new project
- ✅ src/integrations/supabase/client.ts - New project URL & publishable key

---

## Phase 2: Schema & Edge Functions Deployment

### Prerequisites
```bash
# Install Supabase CLI globally
npm install -g supabase

# Or upgrade if already installed
supabase --version  # Should be v1.x.x or higher
```

### Step 1: Pull Schema from Old Project

```bash
# Navigate to project root
cd /path/to/project

# Link to old project and pull schema
supabase link --project-ref kdpqimetajnhcqseajok

# Pull all migrations and schemas
supabase db pull
```

**Expected**: 20+ migration files will be pulled into `supabase/migrations/`

### Step 2: Link to New Project

```bash
# Switch to new project (use --force-db-link if previously linked)
supabase link --project-ref tbmzwmgsvshfdxdoyrcr --force-db-link
```

**Prompt**: Authenticate with Supabase account if needed

### Step 3: Push Schema to New Project

```bash
# Deploy all migrations to new project
supabase db push
```

**Expected Output**:
```
Connecting to new project...
Pushing 20 migrations...
✓ Migration applied successfully
```

### Step 4: Enable PostgreSQL Extensions (via CLI or Dashboard)

**Option A: Via CLI**
```bash
# Create extensions required for cron jobs and webhooks
supabase db execute --project-ref tbmzwmgsvshfdxdoyrcr \
  "CREATE EXTENSION IF NOT EXISTS pg_cron;"

supabase db execute --project-ref tbmzwmgsvshfdxdoyrcr \
  "CREATE EXTENSION IF NOT EXISTS pg_net;"
```

**Option B: Via Supabase Dashboard (Manual)**
1. Go to: https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr
2. Click: SQL Editor → New Query
3. Paste and run:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS plpgsql;
CREATE EXTENSION IF NOT EXISTS pgtap;
```

### Step 5: Deploy Edge Functions

```bash
# Deploy all 40+ edge functions to new project
supabase functions deploy

# Or deploy specific functions:
supabase functions deploy jenga-ipn-callback
supabase functions deploy jenga-stk-push
supabase functions deploy kcb-ipn-callback
supabase functions deploy kcb-stk-push
supabase functions deploy mpesa-callback
supabase functions deploy mpesa-stk-push
supabase functions deploy kopokopo-callback
supabase functions deploy send-overdue-reminders
supabase functions deploy automated-monthly-billing
# ... etc for all functions
```

**Expected**: 
```
Deploying functions...
✓ jenga-ipn-callback deployed
✓ jenga-stk-push deployed
... (40+ functions)
```

### Step 6: Verify Deployment

```bash
# List deployed functions
supabase functions list --project-ref tbmzwmgsvshfdxdoyrcr

# Test a function
supabase functions invoke jenga-ipn-callback --project-ref tbmzwmgsvshfdxdoyrcr
```

---

## Phase 3: Update External Webhooks

### After Edge Functions are Deployed

Update callback URLs in external payment processor dashboards:

#### 1. **Jenga Pay Dashboard**
- **URL**: https://v3.jengahq.io/dashboard/settings/create-ipn
- **Settings**: Settings → IPN Configuration
- **Old Callback**: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/jenga-ipn-callback`
- **New Callback**: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/jenga-ipn-callback`
- **Action**: Update and enable IPN

#### 2. **KCB Buni Developer Portal**
- **Settings**: Application Settings
- **Old Callback**: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/kcb-ipn-callback`
- **New Callback**: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kcb-ipn-callback`
- **Action**: Save and test

#### 3. **M-Pesa (Safaricom) - if configured**
- **Old Callback**: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/mpesa-callback`
- **New Callback**: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/mpesa-callback`
- **Portal**: Your M-Pesa Business Portal

#### 4. **Kopokopo - if configured**
- **Old Callback**: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/kopokopo-callback`
- **New Callback**: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kopokopo-callback`
- **Portal**: Kopokopo API Settings

### Notes on Webhooks
- Code in `JengaPayConfig.tsx` and `KCBBuniConfig.tsx` now **dynamically generates URLs** from the Supabase project
- Once environment variables are set correctly, callbacks will automatically use the new project
- No code changes needed for production deployment

---

## Phase 4: Comprehensive Testing

### Local Testing (Before Production)

#### 1. Test Authentication
```bash
# Start dev server
npm run dev

# In browser: http://localhost:5173
# Test:
# - Login with test account
# - Check browser DevTools → Application → Storage
#   ✓ Verify auth token has: sb-tbmzwmgsvshfdxdoyrcr-auth-token
#   ✗ Should NOT have: sb-kdpqimetajnhcqseajok-auth-token
# - Logout
#   ✓ Verify all auth tokens cleared from storage
```

#### 2. Test API Connectivity
```bash
# In browser console:
import { supabase } from '@/integrations/supabase/client';

// Test health check
const { data, error } = await supabase.from('profiles').select('id').limit(1);
console.log('✓ Connected to new project:', data);
```

#### 3. Test Payment Integrations (if configured)
```bash
# Test Jenga config page
# 1. Navigate to: /settings/payment-methods
# 2. Verify "Equity Bank - Jenga PAY Configuration" appears
# 3. Verify IPN URL shows new project: tbmzwmgsvshfdxdoyrcr

# Test KCB config page
# 1. Verify "KCB Bank - Buni M-Pesa Configuration" appears
# 2. Verify callback URL shows new project: tbmzwmgsvshfdxdoyrcr
```

#### 4. Test RPC Functions
```bash
# In browser console:
const { data, error } = await supabase.rpc('has_role_safe', { 
  _user_id: 'test-id', 
  _role: 'Admin' 
});
console.log('✓ RPC function works:', data);
```

### Production Testing (After Deployment)

#### 1. Verify Production Connectivity
```bash
# Check health endpoint on production domain
curl https://your-production-domain.com/api/health

# Should return:
# { "ok": true, "status": 200, "data": [...] }
```

#### 2. Monitor Logs
```bash
# Watch Supabase logs for new project
supabase functions deploy --project-ref tbmzwmgsvshfdxdoyrcr --follow

# Check error logs
supabase logs --project-ref tbmzwmgsvshfdxdoyrcr
```

#### 3. Test Key Workflows
- [ ] User registration (creates auth user + profile in new project)
- [ ] User login (retrieves from new project)
- [ ] Logout (clears new project tokens)
- [ ] Payment method configuration (Jenga, KCB)
- [ ] Payment test (STK push)
- [ ] Email notifications (via new project)
- [ ] SMS notifications (via new project)
- [ ] Invoice creation
- [ ] Lease management

---

## Phase 5: Production Deployment

### 1. Prepare Code for Production

```bash
# All code changes already in place:
git status
# Should show only code changes (no migrations yet)

# Build for production
npm run build

# Test build locally
npm run preview
```

### 2. Deploy Code

```bash
# Push code changes to your repo
git add .
git commit -m "chore: complete Supabase migration to tbmzwmgsvshfdxdoyrcr"
git push origin main

# Deploy to your hosting (Netlify, Vercel, etc.)
# This happens automatically via your CI/CD pipeline
```

### 3. Verify Production Deployment

```bash
# Test production environment
curl https://your-production-domain.com

# Check logs for new project connections
supabase logs --project-ref tbmzwmgsvshfdxdoyrcr --follow

# Monitor for 24-48 hours for any errors
```

### 4. Monitor & Verify (24-48 Hours)

```bash
# Check Auth logs
# Dashboard → https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr/auth/logs

# Check Database activity
# Dashboard → Explore → Tables → (check for active queries)

# Check Edge Functions
# Dashboard → Edge Functions → Review logs for errors

# Check Webhooks
# Dashboard → Edge Functions → (specific function) → Logs
```

### 5. Rollback Plan (if needed)

```bash
# If critical issues occur, revert to old project:

# 1. Revert environment variables to old project
NEXT_PUBLIC_SUPABASE_URL="https://kdpqimetajnhcqseajok.supabase.co"
SUPABASE_URL="https://kdpqimetajnhcqseajok.supabase.co"

# 2. Revert code (reset to previous commit)
git revert HEAD

# 3. Redeploy
git push origin main

# 4. Verify old project is receiving traffic
```

---

## Critical URLs Reference

| Component | Old Project | New Project |
|-----------|------------|------------|
| **API URL** | https://kdpqimetajnhcqseajok.supabase.co | https://tbmzwmgsvshfdxdoyrcr.supabase.co |
| **Jenga IPN** | /functions/v1/jenga-ipn-callback | /functions/v1/jenga-ipn-callback |
| **KCB IPN** | /functions/v1/kcb-ipn-callback | /functions/v1/kcb-ipn-callback |
| **M-Pesa Callback** | /functions/v1/mpesa-callback | /functions/v1/mpesa-callback |
| **Kopokopo Callback** | /functions/v1/kopokopo-callback | /functions/v1/kopokopo-callback |
| **Dashboard** | https://supabase.com/dashboard/project/kdpqimetajnhcqseajok | https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr |

---

## Troubleshooting

### Schema Migration Issues

```bash
# If schema push fails, check migration status
supabase migration list --project-ref tbmzwmgsvshfdxdoyrcr

# If specific migration fails, view the SQL
cat supabase/migrations/[migration-id].sql

# Reset and retry (careful - will drop data)
supabase db reset --project-ref tbmzwmgsvshfdxdoyrcr
supabase db push
```

### Edge Function Deployment Issues

```bash
# Check function logs
supabase functions logs jenga-ipn-callback --project-ref tbmzwmgsvshfdxdoyrcr

# Redeploy specific function with debug
supabase functions deploy jenga-ipn-callback --project-ref tbmzwmgsvshfdxdoyrcr --debug
```

### Authentication Issues

```bash
# Clear browser cache
# DevTools → Application → Storage → Clear All

# Check auth config in new project
# Dashboard → Authentication → Providers

# Verify JWT tokens with new project
# Use: https://jwt.io (paste token and verify 'aud' matches new project URL)
```

### Webhook Issues

```bash
# Test webhook from Supabase dashboard
supabase functions invoke jenga-ipn-callback \
  --project-ref tbmzwmgsvshfdxdoyrcr \
  --body '{"data":"test"}'

# Check recent function invocations
supabase functions logs jenga-ipn-callback --project-ref tbmzwmgsvshfdxdoyrcr --tail
```

---

## Completion Checklist

- [ ] Phase 1: ✅ Code updated (COMPLETE)
- [ ] Phase 2: Schema pulled from old project
- [ ] Phase 2: Linked to new project
- [ ] Phase 2: Schema pushed to new project
- [ ] Phase 2: Extensions enabled (pg_cron, pg_net)
- [ ] Phase 2: All 40+ edge functions deployed
- [ ] Phase 3: Jenga Pay webhook updated
- [ ] Phase 3: KCB Buni webhook updated
- [ ] Phase 3: M-Pesa webhook updated (if configured)
- [ ] Phase 3: Kopokopo webhook updated (if configured)
- [ ] Phase 4: Local auth testing passed
- [ ] Phase 4: API connectivity verified
- [ ] Phase 4: Payment integrations tested
- [ ] Phase 4: RPC functions working
- [ ] Phase 5: Production code deployed
- [ ] Phase 5: Production verification passed
- [ ] Phase 5: 24-48 hour monitoring complete
- [ ] ✅ Old project decommissioned (when stable)

---

## Next Steps

1. **If you have CLI access**: Run the commands in Phase 2 section above
2. **If you don't have CLI access**: Provide access or use Supabase Dashboard
3. **After schema deployed**: Update external webhooks in Phase 3
4. **Before going live**: Complete all tests in Phase 4
5. **Go live**: Follow Phase 5 production deployment steps

For questions or issues, refer to the troubleshooting section or check the Supabase documentation.
