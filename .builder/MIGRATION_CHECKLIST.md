# Supabase Migration Checklist
**From:** kdpqimetajnhcqseajok → **To:** tbmzwmgsvshfdxdoyrcr  
**Date Started:** ___________  
**Date Completed:** ___________

---

## 📋 PRE-MIGRATION CHECKLIST

- [ ] Read `.builder/README.md` for overview
- [ ] Read `.builder/PHASE1_AUTOMATED.md` for Phase 1 steps
- [ ] Have Supabase CLI installed: `supabase --version`
- [ ] Logged into Supabase: `supabase auth list`
- [ ] Have Supabase PAT token available (backup only)
- [ ] Have access to both projects in Supabase dashboard
- [ ] Have time available (1-2 hours total)
- [ ] Old project backed up (it stays intact)
- [ ] Team notified of migration (no database changes during migration)

---

## 🔄 PHASE 1: SCHEMA MIGRATION (5-10 MIN)

### CLI Commands
```bash
# Command 1
supabase link --project-ref kdpqimetajnhcqseajok
```
- [ ] Command executed successfully
- [ ] Project linked (logged in if prompted)

```bash
# Command 2
supabase db pull
```
- [ ] Command executed successfully
- [ ] `supabase/migrations/` directory created
- [ ] Migration files generated (check: `ls supabase/migrations/`)

```bash
# Command 3
supabase link --project-ref tbmzwmgsvshfdxdoyrcr --force-db-link
```
- [ ] Command executed successfully
- [ ] Switched to new project

```bash
# Command 4
supabase db push
```
- [ ] Command executed successfully
- [ ] All migrations applied to new project
- [ ] No errors in output

### Manual: Enable Extensions (1 min)

Go to: https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr/sql

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

- [ ] SQL Editor opened
- [ ] Extensions SQL executed
- [ ] No errors shown

### Manual: Schedule Cron Jobs (2 min)

Copy SQL from `.builder/MIGRATION_SQL_SCRIPTS.sql`:

```sql
SELECT cron.schedule(
  'send-overdue-invoice-reminders',
  '0 9 * * *',
  $$...$$
);

SELECT cron.schedule(
  'automated-monthly-billing-job',
  '0 1 * * *',
  $$...$$
);
```

- [ ] SQL Editor still open
- [ ] Both cron job SQL statements executed
- [ ] No errors shown

### Verification: Check Schema Migrated

In Supabase SQL Editor, run:

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
```

- [ ] Result: 50+ tables (write count: ________)

```sql
SELECT COUNT(*) FROM cron.job;
```

- [ ] Result: 2 jobs scheduled (overdue-reminders + monthly-billing)

```sql
SELECT extname FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
```

- [ ] Result: Shows pg_cron and pg_net

**Phase 1 Status:** ☑️ COMPLETE / ⚠️ ISSUES (note below)

_Issues encountered:_
```
_____________________________________________
_____________________________________________
```

---

## ⚡ PHASE 2: DEPLOY EDGE FUNCTIONS (2-5 MIN)

In your terminal, from project root:

```bash
supabase functions deploy
```

- [ ] Command executed
- [ ] Output shows: "Deployed 49 functions"
- [ ] No errors in output

### Verification: Check Deployments

Go to: https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr/functions

- [ ] All 49 functions listed
- [ ] No red error badges
- [ ] Status: "Deployed" for all

### Test 3 Critical Functions

**Function 1: create-user-with-role**
- [ ] Open function in dashboard
- [ ] Click "Test"
- [ ] Click "Invoke"
- [ ] Check response (should execute)
- [ ] Check logs for errors

**Function 2: send-sms**
- [ ] Open function in dashboard
- [ ] Click "Test"
- [ ] Click "Invoke"
- [ ] Check response
- [ ] Check logs for errors

**Function 3: mpesa-stk-push**
- [ ] Open function in dashboard
- [ ] Click "Test"
- [ ] Click "Invoke"
- [ ] Check response
- [ ] Check logs for errors

**Phase 2 Status:** ☑️ COMPLETE / ⚠️ ISSUES (note below)

_Issues encountered:_
```
_____________________________________________
_____________________________________________
```

---

## 🔗 PHASE 3: UPDATE EXTERNAL WEBHOOKS (20-30 MIN)

### Old Webhook URLs → New Webhook URLs

**M-Pesa Callback**
- Old: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/mpesa-callback`
- New: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/mpesa-callback`
- [ ] Updated in M-Pesa Daraja Portal
- [ ] Tested with test payment
- [ ] Callback received successfully

**Jenga Callback**
- Old: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/jenga-ipn-callback`
- New: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/jenga-ipn-callback`
- [ ] Updated in Jenga API Console
- [ ] Tested with test payment
- [ ] Callback received successfully

**KCB Callback**
- Old: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/kcb-ipn-callback`
- New: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kcb-ipn-callback`
- [ ] Updated in KCB API Portal
- [ ] Tested with test payment
- [ ] Callback received successfully

**Kopokopo Callback**
- Old: `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/kopokopo-callback`
- New: `https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/kopokopo-callback`
- [ ] Updated in Kopokopo Dashboard
- [ ] Tested with test payment
- [ ] Callback received successfully

### Other Webhooks (if any)
- [ ] Search codebase for old project URLs: `grep -r "kdpqimetajnhcqseajok" .`
- [ ] Update any found references
- [ ] Test updated webhooks

**Phase 3 Status:** ☑️ COMPLETE / ⚠️ ISSUES (note below)

_Issues encountered:_
```
_____________________________________________
_____________________________________________
```

---

## 🔤 PHASE 4: REGENERATE DATABASE TYPES (2-3 MIN)

```bash
supabase gen types typescript --project-id tbmzwmgsvshfdxdoyrcr > src/integrations/supabase/types.ts
```

- [ ] Command executed
- [ ] File updated: `src/integrations/supabase/types.ts`

```bash
npm run type-check
```

- [ ] Command executed
- [ ] No TypeScript errors
- [ ] No missing type warnings

**Phase 4 Status:** ☑️ COMPLETE / ⚠️ ISSUES (note below)

_Issues encountered:_
```
_____________________________________________
_____________________________________________
```

---

## 🧪 PHASE 5: LOCAL TESTING & VERIFICATION (30-60 MIN)

```bash
npm run dev
```

- [ ] Dev server started
- [ ] App loads at http://localhost:5173 (or shown port)
- [ ] No console errors
- [ ] Supabase connects (check Network tab)

### Test: Authentication

- [ ] Signup page loads
- [ ] Create new test account
- [ ] Verification email received (or skipped)
- [ ] Account created in Supabase dashboard
- [ ] Login with new account works
- [ ] Dashboard loads after login
- [ ] Password reset works

### Test: Data Operations (CRUD)

- [ ] Create property
- [ ] Read/view property
- [ ] Update property details
- [ ] Create tenant
- [ ] Create lease
- [ ] Create invoice
- [ ] Create maintenance request

### Test: Payment Flows

- [ ] M-Pesa STK dialog triggers (test mode)
- [ ] Kopokopo payment initiated
- [ ] Payment callback received
- [ ] Payment status updated in database
- [ ] Invoice marked as paid

### Test: Communication

- [ ] Send SMS (via send-sms function)
- [ ] SMS delivered (check SMS provider)
- [ ] Send welcome email
- [ ] Email delivered (check mailbox)
- [ ] Overdue reminder SMS sending works

### Test: Billing

- [ ] Create billing checkout
- [ ] Checkout URL generated
- [ ] Upgrade plan works
- [ ] Plan updated in database
- [ ] Monthly billing cron triggers (or manual test)

### Test: Realtime

Open browser DevTools → Network tab:
- [ ] Realtime subscriptions active
- [ ] Property updates appear instantly
- [ ] Lease updates appear instantly
- [ ] Maintenance updates appear instantly

### Monitor Logs

**Edge Function Logs:**
- [ ] Go to: https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr/functions
- [ ] Click each tested function
- [ ] Click "Logs" tab
- [ ] Check for errors
- [ ] All logs green/successful

**Database Performance:**
- [ ] Go to: https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr/database
- [ ] Check: Query performance
- [ ] Check: No slow queries (>1s)
- [ ] Check: Indexes being used

**Application Logs:**
- [ ] Browser console: No red errors
- [ ] Network tab: No 500 errors
- [ ] No failed requests to API

**Phase 5 Status:** ☑️ COMPLETE / ⚠️ ISSUES (note below)

_Issues encountered:_
```
_____________________________________________
_____________________________________________
```

---

## ✅ POST-MIGRATION TASKS (1-2 HOURS)

### Monitoring (First 24-48 Hours)

- [ ] Monitor Supabase dashboard for errors
- [ ] Check edge function logs regularly
- [ ] Monitor app error tracking (if using Sentry, etc.)
- [ ] Watch for user-reported issues
- [ ] Check database query performance

### Documentation

- [ ] Update team runbook with new project ID
- [ ] Document any custom setup steps taken
- [ ] Add new project URL to internal docs
- [ ] Brief team on new project access

### Cleanup

- [ ] Delete old project migrations if not needed: `rm -rf supabase/migrations/` (optional)
- [ ] Update CI/CD if using old project ID
- [ ] Update deployment scripts
- [ ] Update documentation

### Decommission Old Project (After 1-2 Weeks)

- [ ] Verified new project is stable (no issues)
- [ ] All webhooks working with new URLs
- [ ] User-facing errors resolved
- [ ] [ ] Request deletion: https://supabase.com/dashboard/account/billing
- [ ] [ ] Remove old credentials from backups

---

## 🎯 FINAL VERIFICATION

Before considering migration complete:

- [ ] **Phase 1:** Schema fully migrated, 50+ tables, extensions enabled, cron scheduled
- [ ] **Phase 2:** 49 functions deployed, no error badges, critical functions tested
- [ ] **Phase 3:** 4 webhooks updated and tested, payments working
- [ ] **Phase 4:** Types regenerated, TypeScript clean
- [ ] **Phase 5:** All flows tested, no console errors, logs clean
- [ ] **Monitoring:** 24-48 hours of stable operation
- [ ] **Team:** Notified and trained on new project
- [ ] **Documentation:** Updated with new project details

---

## 📊 MIGRATION SUMMARY

| Phase | Task | Status | Time | Notes |
|-------|------|--------|------|-------|
| 1 | Schema migration | ☐ | 5-10 min | |
| 2 | Deploy functions | ☐ | 2-5 min | |
| 3 | Webhooks | ☐ | 20-30 min | |
| 4 | Types | ☐ | 2-3 min | |
| 5 | Testing | ☐ | 30-60 min | |
| Post | Monitoring & docs | ☐ | 1-2 hrs | |
| **Total** | **Full Migration** | **☐** | **60-110 min** | |

---

## 👥 Team Sign-Off

**Migration Performed By:** _____________________  
**Date Completed:** _____________________  
**Verified By:** _____________________  
**Date Verified:** _____________________  

---

## 📝 Notes & Issues Log

### Critical Issues

```
_____________________________________________
_____________________________________________
_____________________________________________
```

### Warnings & Resolutions

```
_____________________________________________
_____________________________________________
_____________________________________________
```

### Lessons Learned

```
_____________________________________________
_____________________________________________
_____________________________________________
```

---

**Print this checklist and check off items as you complete them!**

**Questions? See `.builder/README.md` for support resources.**
