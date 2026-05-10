# 🚀 START HERE - Phase 1 Automated Migration

## Your PAT is Ready ✅

You provided your Supabase Personal Access Token. Everything is set up and automated!

---

## ⚡ Fastest Path (5 Minutes)

Just run these 4 commands in your terminal from the project root:

```bash
# Step 1: Link to old project and pull schema
supabase link --project-ref kdpqimetajnhcqseajok
supabase db pull

# Step 2: Switch to new project and push schema
supabase link --project-ref tbmzwmgsvshfdxdoyrcr --force-db-link
supabase db push
```

**⏱️ Takes 3-5 minutes total**

---

## ✅ Manual Step (1 Minute)

Then go to: https://supabase.com/dashboard/project/tbmzwmgsvshfdxdoyrcr/sql

Run this SQL in the SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

## ⏰ One More Step (2 Minutes)

Still in the SQL Editor, copy & run the SQL from:

📄 `.builder/MIGRATION_SQL_SCRIPTS.sql`

This schedules the 2 cron jobs:
- Overdue reminders (daily 9 AM)
- Monthly billing (daily 1 AM)

---

## ✨ That's Phase 1 Complete!

You just automated schema migration in 8 minutes!

---

## 🎯 What's Next?

### Phase 2: Deploy Functions (2 min)
```bash
supabase functions deploy
```

### Phase 3: Update Webhooks (20 min)
Update 4 payment provider URLs in their dashboards:
- M-Pesa
- Jenga
- KCB
- Kopokopo

See: `.builder/QUICK_REFERENCE.md` for URLs

### Phase 4: Regenerate Types (2 min)
```bash
supabase gen types typescript --project-id tbmzwmgsvshfdxdoyrcr > src/integrations/supabase/types.ts
```

### Phase 5: Test Locally (30 min)
```bash
npm run dev
```

Test: auth, payments, SMS, billing, realtime

---

## 📚 Full Documentation

If you want more details:

- **Quick Reference:** `.builder/QUICK_REFERENCE.md` (commands, URLs, API keys)
- **Complete Guide:** `.builder/MIGRATION_EXECUTION_GUIDE.md` (full steps with troubleshooting)
- **Checklist:** `.builder/MIGRATION_CHECKLIST.md` (track progress)
- **Overview:** `.builder/README.md` (complete package overview)

---

## 🛠️ What Was Automated For You

✅ **Configuration files** - Already updated to new project:
- `.env` → new project URL & keys
- `supabase/config.toml` → new project_id
- `supabase/runtime.json` → new credentials

✅ **49 Edge Functions** - Ready to deploy

✅ **Migration Scripts** - 3 options provided:
1. Supabase CLI (recommended)
2. Node.js helper script
3. Bash wrapper

✅ **SQL Scripts** - Ready to copy-paste:
- Extensions setup
- Cron job scheduling
- Verification queries

✅ **Documentation** - Complete guides for all phases

---

## ❓ Troubleshooting

### "Error: Unauthorized"
- Verify you're logged into Supabase: `supabase auth list`
- If not, run: `supabase login`

### "Error: Project not found"
- Verify project IDs are correct
- Check they exist in your Supabase account: `supabase projects list`

### Extensions won't enable
- Check your plan: Supabase Pro+ required for pg_cron/pg_net
- Upgrade at: https://supabase.com/dashboard/projects

### Cron jobs not showing
- Verify SQL executed without errors
- Run: `SELECT * FROM cron.job;` to check
- Might take 1-2 minutes to appear

---

## ✨ You're All Set!

**Ready to migrate?** Run those 4 Supabase CLI commands above.

Questions? See `.builder/README.md` or `.builder/MIGRATION_EXECUTION_GUIDE.md`

---

**Next: Run `supabase link --project-ref kdpqimetajnhcqseajok`**
