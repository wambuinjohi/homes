# Authentication Setup Guide

## Fix Authentication Redirect Issues

The authentication redirect errors (redirecting to localhost:3000 or "requested path is invalid") occur because the Supabase Auth configuration doesn't match your deployed application.

### Step 1: Configure Supabase Auth Settings

1. **Go to your Supabase Dashboard:**
   - Visit [Supabase Dashboard](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/auth/url-configuration)

2. **Configure Site URL:**
   - Set the **Site URL** to your deployed application URL
   - For example: `https://your-app-name.lovable.app`
   - This is the main URL where your application is hosted

3. **Configure Redirect URLs:**
   - Add the following redirect URLs (one per line):
   ```
   https://your-app-name.lovable.app/**
   https://your-app-name.lovable.app/auth
   https://your-app-name.lovable.app/auth/callback
   ```
   - Replace `your-app-name.lovable.app` with your actual deployed URL

### Step 2: Test Authentication Flow

1. **Test Sign Up:**
   - Navigate to your deployed app
   - Try to create a new account
   - Check that email confirmation works correctly

2. **Test Sign In:**
   - Try logging in with existing credentials
   - Ensure you're redirected to the dashboard after login

### Step 3: SMS Configuration Issues

The SMS login issue for new property users is likely due to missing SMS provider configuration:

1. **Check SMS Secrets in Supabase:**
   - Go to [Edge Functions Secrets](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/settings/functions)
   - Ensure these secrets are configured:
     - `MPESA_CONSUMER_KEY`
     - `MPESA_CONSUMER_SECRET` 
     - `MPESA_PASSKEY`
     - `MPESA_SHORTCODE`
     - `MPESA_ENVIRONMENT`

2. **Test SMS Function:**
   - The `create-user-with-role` function should send SMS with login credentials
   - Check [Function Logs](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/functions/create-user-with-role/logs) for errors

### Step 4: Trial Management Issues

The user `dmwangui@gmail.com` is not appearing in Trial Management because:

1. **User Status Check:**
   - The user may have converted from trial to active subscription
   - Trial Management currently only shows users with `trial`, `trial_expired`, or `suspended` status

2. **Filter Enhancement Needed:**
   - Add a filter option to show "All Users" vs "Trial Users Only"
   - Add manual trial extension capabilities for admin users

### Immediate Actions Required:

1. **Update Supabase Auth URLs** (most critical)
2. **Verify SMS provider secrets**
3. **Test the complete authentication flow**
4. **Enhance Trial Management with better filtering**

### Next Steps After Configuration:

1. The Support Center database tables have been created
2. Support Center now uses real database structure (currently with mock data)
3. Once Supabase types are regenerated, the Support Center will be fully functional
4. Trial Management can be enhanced with additional admin capabilities

**Note:** The database migration for support system tables was successfully executed. The Support Center is now connected to the database structure and will be fully functional once the Supabase types are updated.