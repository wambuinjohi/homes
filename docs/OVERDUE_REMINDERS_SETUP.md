# Overdue Invoice SMS Reminders

This document explains how the automated overdue invoice reminder system works.

## Overview

The system automatically sends SMS reminders to tenants with overdue invoices at:
- **3 days** after the due date
- **7 days** after the due date

## Components

### 1. Database Table: `invoice_overdue_reminders`
Tracks all reminders sent to prevent duplicates.

**Columns:**
- `invoice_id` - Reference to the overdue invoice
- `tenant_id` - Tenant who received the reminder
- `reminder_type` - Either '3_days' or '7_days'
- `sms_status` - 'sent', 'failed', or 'pending'
- `phone_number` - Recipient phone number
- `sent_at` - When the reminder was sent

### 2. Edge Function: `send-overdue-reminders`
Runs daily to:
1. Find invoices with `status = 'pending'` and due dates of exactly 3 or 7 days ago
2. Check if a reminder was already sent for that invoice/reminder_type combination
3. Send SMS to the tenant using the `send-sms` function
4. Log the reminder in the `invoice_overdue_reminders` table

### 3. Cron Job (PostgreSQL)
Runs the edge function automatically every day at 9:00 AM.

## Setup Instructions

### Enable Required Extensions

Run this SQL once in your Supabase SQL Editor:

\`\`\`sql
-- Enable pg_cron for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;
\`\`\`

### Schedule the Cron Job

Run this SQL to schedule the daily reminder task:

\`\`\`sql
-- Schedule overdue reminders to run every day at 9:00 AM
SELECT cron.schedule(
  'send-overdue-invoice-reminders',
  '0 9 * * *', -- 9:00 AM daily
  $$
  SELECT
    net.http_post(
        url:='https://kdpqimetajnhcqseajok.supabase.co/functions/v1/send-overdue-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SUPABASE_ANON_KEY"}'::jsonb,
        body:=concat('{"triggered_at": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
\`\`\`

**Important:** Replace `YOUR_SUPABASE_ANON_KEY` with your actual Supabase anon key.

### View Scheduled Jobs

To see all scheduled cron jobs:

\`\`\`sql
SELECT * FROM cron.job;
\`\`\`

### Unschedule/Remove the Job

If you need to remove the cron job:

\`\`\`sql
SELECT cron.unschedule('send-overdue-invoice-reminders');
\`\`\`

## Manual Testing

You can manually trigger the function anytime:

\`\`\`sql
SELECT
  net.http_post(
      url:='https://kdpqimetajnhcqseajok.supabase.co/functions/v1/send-overdue-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SUPABASE_ANON_KEY"}'::jsonb,
      body:='{"triggered_at": "manual"}'::jsonb
  ) as request_id;
\`\`\`

Or use the Supabase Functions UI to test it.

## SMS Message Format

**3 Days Overdue:**
> Hi [Tenant Name], your invoice [INV-NUMBER] for KES [AMOUNT] is 3 days overdue. Please settle to avoid further charges. - Zira Homes

**7 Days Overdue:**
> Hi [Tenant Name], URGENT: Your invoice [INV-NUMBER] for KES [AMOUNT] is 7 days overdue. Please settle immediately to avoid penalties. - Zira Homes

## Monitoring

### Check Sent Reminders

\`\`\`sql
SELECT 
  r.reminder_type,
  r.sent_at,
  r.sms_status,
  i.invoice_number,
  i.amount,
  i.due_date,
  t.first_name,
  t.last_name,
  r.phone_number
FROM invoice_overdue_reminders r
JOIN invoices i ON r.invoice_id = i.id
JOIN tenants t ON r.tenant_id = t.id
ORDER BY r.sent_at DESC
LIMIT 50;
\`\`\`

### Check Failed Reminders

\`\`\`sql
SELECT 
  r.*,
  i.invoice_number,
  t.first_name,
  t.last_name
FROM invoice_overdue_reminders r
JOIN invoices i ON r.invoice_id = i.id
JOIN tenants t ON r.tenant_id = t.id
WHERE r.sms_status = 'failed'
ORDER BY r.sent_at DESC;
\`\`\`

### View Edge Function Logs

Check the Supabase Dashboard → Edge Functions → send-overdue-reminders → Logs

## Troubleshooting

### Reminders Not Sending

1. **Check cron job is scheduled:**
   \`\`\`sql
   SELECT * FROM cron.job WHERE jobname = 'send-overdue-invoice-reminders';
   \`\`\`

2. **Check edge function logs** in Supabase Dashboard

3. **Verify tenant phone numbers** are valid:
   \`\`\`sql
   SELECT id, first_name, last_name, phone 
   FROM tenants 
   WHERE phone IS NULL OR phone = '';
   \`\`\`

4. **Test SMS function** manually:
   \`\`\`sql
   SELECT supabase.functions.invoke('send-sms', 
     '{"phone_number": "+254712345678", "message": "Test message"}'::jsonb
   );
   \`\`\`

### Duplicate Reminders

The system prevents duplicates using a UNIQUE constraint on `(invoice_id, reminder_type)`. If you see duplicates, check the `invoice_overdue_reminders` table for the specific invoice.

## Customization

### Change Reminder Schedule

Edit the cron schedule in the SQL:
- `0 9 * * *` - 9:00 AM daily
- `0 */6 * * *` - Every 6 hours
- `0 8,14,20 * * *` - 8 AM, 2 PM, 8 PM daily

### Add More Reminder Days

1. Update the migration to add '14_days' check constraint (already included)
2. Modify the edge function to check for 14-day overdue invoices
3. Add the date calculation logic

### Customize SMS Messages

Edit the message templates in `supabase/functions/send-overdue-reminders/index.ts`:

\`\`\`typescript
const message = daysOverdue === 3
  ? \`Your custom 3-day message...\`
  : \`Your custom 7-day message...\`;
\`\`\`

## SMS Credits

Each reminder SMS consumes credits from the landlord's SMS balance. Monitor usage in the `sms_usage` table and `landlord_subscriptions.sms_credits_balance`.
