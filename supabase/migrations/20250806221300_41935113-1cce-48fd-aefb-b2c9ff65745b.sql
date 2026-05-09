-- Create trial notification templates with pre-populated content
INSERT INTO trial_notification_templates (
  notification_type,
  template_name,
  subject,
  days_before_expiry,
  email_content,
  html_content,
  is_active
) VALUES 
(
  'trial_reminder_7_days',
  '7 Day Trial Reminder',
  'Your trial expires in 7 days - Don''t lose access!',
  7,
  'Hi {{first_name}},

Your Zira Homes trial expires in 7 days! Don''t lose access to your property management tools.

Trial ends: {{trial_end_date}}
Days remaining: {{days_remaining}}

What you''ll keep with a paid plan:
✅ Unlimited properties and units
✅ Advanced financial reporting  
✅ Automated rent collection
✅ Maintenance request management
✅ Tenant communication tools
✅ SMS notifications
✅ Priority customer support

Upgrade now: {{upgrade_url}}

Need help? Contact support@zirahomes.com

Best regards,
The Zira Homes Team',
  '<h2>Your trial expires in 7 days</h2><p>Hi {{first_name}},</p><p>Your Zira Homes trial expires in 7 days! Don''t lose access to your property management tools.</p><div style="background:#fef3c7;padding:20px;border-radius:8px;margin:20px 0;"><strong>Trial ends:</strong> {{trial_end_date}}<br><strong>Days remaining:</strong> {{days_remaining}}</div><h3>What you''ll keep with a paid plan:</h3><ul><li>✅ Unlimited properties and units</li><li>✅ Advanced financial reporting</li><li>✅ Automated rent collection</li><li>✅ Maintenance request management</li><li>✅ Tenant communication tools</li><li>✅ SMS notifications</li><li>✅ Priority customer support</li></ul><p><a href="{{upgrade_url}}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;">Upgrade Your Account</a></p>',
  true
),
(
  'trial_reminder_3_days',
  '3 Day Trial Reminder',
  'Only 3 days left in your trial',
  3,
  'Hi {{first_name}},

Time is running out! Your Zira Homes trial expires in just 3 days.

Don''t lose access to:
- Your property data
- Tenant management tools  
- Financial reports
- All your valuable information

Trial ends: {{trial_end_date}}
Days remaining: {{days_remaining}}

⚠️ URGENT: Upgrade now to maintain uninterrupted service!

Upgrade immediately: {{upgrade_url}}

Questions? Reply to this email or contact support@zirahomes.com

The Zira Homes Team',
  '<h2 style="color:#dc2626;">Only 3 days remaining!</h2><p>Hi {{first_name}},</p><p><strong>Time is running out!</strong> Your Zira Homes trial expires in just 3 days.</p><div style="background:#fef2f2;border:2px solid #dc2626;padding:20px;border-radius:8px;margin:20px 0;"><strong>Trial ends:</strong> {{trial_end_date}}<br><strong>Days remaining:</strong> {{days_remaining}}</div><p><strong>Don''t lose access to:</strong></p><ul><li>Your property data</li><li>Tenant management tools</li><li>Financial reports</li><li>All your valuable information</li></ul><p style="background:#fef2f2;padding:15px;border-radius:6px;color:#dc2626;">⚠️ <strong>URGENT:</strong> Upgrade now to maintain uninterrupted service!</p><p><a href="{{upgrade_url}}" style="background:#dc2626;color:white;padding:16px 32px;text-decoration:none;border-radius:5px;font-size:18px;">Upgrade Now - Don''t Lose Access!</a></p>',
  true
),
(
  'trial_reminder_1_day',
  '1 Day Trial Reminder',
  'Last day of your trial - Upgrade now!',
  1,
  'Hi {{first_name}},

🚨 FINAL REMINDER: Your Zira Homes trial expires TOMORROW!

This is your last chance to upgrade before losing access to all your:
- Property management data
- Tenant information
- Financial records
- Reports and analytics

Trial ends: {{trial_end_date}}
Hours remaining: Less than 24!

Don''t lose years of valuable data - upgrade RIGHT NOW!

UPGRADE IMMEDIATELY: {{upgrade_url}}

After tomorrow, your account will be restricted and you may lose access to your data.

URGENT - Contact us: support@zirahomes.com

The Zira Homes Team',
  '<h2 style="color:#dc2626;">🚨 Final reminder: 1 day left!</h2><p>Hi {{first_name}},</p><p><strong style="color:#dc2626;">FINAL REMINDER:</strong> Your Zira Homes trial expires TOMORROW!</p><div style="background:#fef2f2;border:3px solid #dc2626;padding:20px;border-radius:8px;margin:20px 0;text-align:center;"><strong>Trial ends:</strong> {{trial_end_date}}<br><strong style="color:#dc2626;">Hours remaining: Less than 24!</strong></div><p><strong>This is your last chance to upgrade before losing access to all your:</strong></p><ul><li>Property management data</li><li>Tenant information</li><li>Financial records</li><li>Reports and analytics</li></ul><div style="background:#fef2f2;padding:15px;border-radius:6px;color:#dc2626;text-align:center;margin:20px 0;"><strong>⚠️ Don''t lose years of valuable data - upgrade RIGHT NOW!</strong></div><p style="text-align:center;"><a href="{{upgrade_url}}" style="background:#dc2626;color:white;padding:20px 40px;text-decoration:none;border-radius:5px;font-size:20px;font-weight:bold;">UPGRADE IMMEDIATELY</a></p><p style="color:#dc2626;font-size:14px;">After tomorrow, your account will be restricted and you may lose access to your data.</p>',
  true
),
(
  'trial_expired',
  'Trial Expired Notice',
  'Trial expired - Limited time to upgrade',
  0,
  'Hi {{first_name}},

Your Zira Homes trial period has ended, but don''t worry!

You have a 7-day grace period to upgrade your account. During this time:
✓ Your data is completely safe
✗ Access to features is limited
✗ You cannot add new data

Grace period ends: {{grace_period_end_date}}

Don''t wait - upgrade now to restore full functionality immediately!

RESTORE ACCESS NOW: {{upgrade_url}}

Your data and hard work are waiting for you. Just one click to get back to managing your properties efficiently.

Questions? Contact support@zirahomes.com

The Zira Homes Team',
  '<h2 style="color:#dc2626;">Your trial has expired</h2><p>Hi {{first_name}},</p><p>Your Zira Homes trial period has ended, but <strong>don''t worry!</strong></p><div style="background:#fef3c7;border:2px solid #f59e0b;padding:20px;border-radius:8px;margin:20px 0;"><p><strong>You have a 7-day grace period to upgrade your account.</strong></p><p>During this time:<br>✓ Your data is completely safe<br>✗ Access to features is limited<br>✗ You cannot add new data</p><p><strong>Grace period ends:</strong> {{grace_period_end_date}}</p></div><p><strong>Don''t wait - upgrade now to restore full functionality immediately!</strong></p><p style="text-align:center;"><a href="{{upgrade_url}}" style="background:#dc2626;color:white;padding:16px 32px;text-decoration:none;border-radius:5px;font-size:18px;">RESTORE ACCESS NOW</a></p><p>Your data and hard work are waiting for you. Just one click to get back to managing your properties efficiently.</p>',
  true
),
(
  'grace_period_reminder',
  'Grace Period Ending',
  'Grace period ending soon - Upgrade required',
  -3,
  'Hi {{first_name}},

⚠️ URGENT: Your 7-day grace period is almost over!

If you don''t upgrade soon, your account will be suspended and you may lose access to your property management data.

Grace period ends in: {{grace_days_remaining}} days

Don''t let that happen to your valuable business data!

What happens if you don''t upgrade:
❌ Complete loss of access to your account
❌ Cannot view tenant information
❌ Cannot access financial reports  
❌ Risk of losing important business data

UPGRADE TODAY: {{upgrade_url}}

This is your final warning. Protect your business - upgrade now!

URGENT SUPPORT: support@zirahomes.com

The Zira Homes Team',
  '<h2 style="color:#dc2626;">⚠️ Grace period ending soon</h2><p>Hi {{first_name}},</p><p><strong style="color:#dc2626;">URGENT:</strong> Your 7-day grace period is almost over!</p><div style="background:#fef2f2;border:3px solid #dc2626;padding:20px;border-radius:8px;margin:20px 0;text-align:center;"><p><strong>Grace period ends in: {{grace_days_remaining}} days</strong></p><p style="color:#dc2626;">Don''t let that happen to your valuable business data!</p></div><p><strong>What happens if you don''t upgrade:</strong></p><ul style="color:#dc2626;"><li>❌ Complete loss of access to your account</li><li>❌ Cannot view tenant information</li><li>❌ Cannot access financial reports</li><li>❌ Risk of losing important business data</li></ul><div style="background:#fef2f2;padding:20px;border-radius:6px;text-align:center;margin:20px 0;"><p style="color:#dc2626;font-size:18px;font-weight:bold;">This is your final warning. Protect your business - upgrade now!</p></div><p style="text-align:center;"><a href="{{upgrade_url}}" style="background:#dc2626;color:white;padding:20px 40px;text-decoration:none;border-radius:5px;font-size:20px;font-weight:bold;">UPGRADE TODAY</a></p>',
  true
),
(
  'account_suspended',
  'Account Suspended',
  'Account suspended - Upgrade to restore access',
  -7,
  'Hi {{first_name}},

Your Zira Homes account has been suspended due to an expired trial.

🔒 ACCOUNT STATUS: Suspended
📊 DATA STATUS: Safe and secure
🚀 SOLUTION: Upgrade to restore immediate access

Your property management data is still safe, but you currently have no access to the platform.

The good news? You can restore everything instantly by upgrading now!

RESTORE ACCESS IMMEDIATELY: {{upgrade_url}}

Once you upgrade, you''ll immediately regain access to:
✅ All your property data
✅ Tenant management tools
✅ Financial reports and analytics
✅ All platform features

Don''t stay locked out - upgrade now and get back to managing your properties!

IMMEDIATE SUPPORT: support@zirahomes.com

The Zira Homes Team',
  '<h2 style="color:#dc2626;">🔒 Account suspended</h2><p>Hi {{first_name}},</p><p>Your Zira Homes account has been suspended due to an expired trial.</p><div style="background:#fef2f2;border:2px solid #dc2626;padding:20px;border-radius:8px;margin:20px 0;"><p><strong>🔒 ACCOUNT STATUS:</strong> Suspended<br><strong>📊 DATA STATUS:</strong> Safe and secure<br><strong>🚀 SOLUTION:</strong> Upgrade to restore immediate access</p></div><p>Your property management data is still safe, but you currently have no access to the platform.</p><p><strong>The good news? You can restore everything instantly by upgrading now!</strong></p><p style="text-align:center;margin:30px 0;"><a href="{{upgrade_url}}" style="background:#dc2626;color:white;padding:20px 40px;text-decoration:none;border-radius:5px;font-size:20px;font-weight:bold;">RESTORE ACCESS IMMEDIATELY</a></p><div style="background:#f0f9ff;padding:20px;border-radius:8px;"><p><strong>Once you upgrade, you''ll immediately regain access to:</strong></p><ul><li>✅ All your property data</li><li>✅ Tenant management tools</li><li>✅ Financial reports and analytics</li><li>✅ All platform features</li></ul></div><p style="text-align:center;font-weight:bold;">Don''t stay locked out - upgrade now and get back to managing your properties!</p>',
  true
);

-- Update the trial-manager cron job to also trigger trial reminders
SELECT cron.unschedule('daily-trial-manager');

-- Schedule both trial manager and reminder service to run daily at 8:00 AM
SELECT cron.schedule(
  'daily-trial-manager',
  '0 8 * * *', -- Daily at 8:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://kdpqimetajnhcqseajok.supabase.co/functions/v1/trial-manager',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcHFpbWV0YWpuaGNxc2Vham9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMDQxMTAsImV4cCI6MjA2OTU4MDExMH0.VkqXvocYAYO6RQeDaFv8wVrq2xoKKfQ8UVj41az7ZSk"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule trial reminder service to run daily at 9:00 AM (1 hour after trial manager)
SELECT cron.schedule(
  'daily-trial-reminders',
  '0 9 * * *', -- Daily at 9:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://kdpqimetajnhcqseajok.supabase.co/functions/v1/trial-reminder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcHFpbWV0YWpuaGNxc2Vham9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMDQxMTAsImV4cCI6MjA2OTU4MDExMH0.VkqXvocYAYO6RQeDaFv8wVrq2xoKKfQ8UVj41az7ZSk"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);