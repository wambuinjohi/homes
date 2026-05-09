# Security Configuration Guide

This document outlines the security configurations that have been implemented and those that require manual configuration in your Supabase dashboard.

## ✅ Completed Security Fixes

### 🚨 CRITICAL: Privilege Escalation Vulnerability FIXED
- ✅ **URGENT FIX APPLIED**: Removed overly permissive user role policies that allowed Landlords to escalate privileges
- ✅ **NEW SECURE POLICIES**: Implemented role hierarchy with proper access controls
- ✅ **ADMIN PROTECTION**: Only Admins can assign/remove Admin roles
- ✅ **SELF-ESCALATION PREVENTION**: Users cannot elevate their own privileges (except Admins)
- ✅ **AUDIT LOGGING**: All role changes are now tracked and logged with full details
- ✅ **LOCKOUT PREVENTION**: Admins cannot remove their own Admin role to prevent system lockout
- ✅ **ROLE HIERARCHY**: Landlords can only manage Manager, Agent, and Tenant roles within their scope

### Database Security Hardening
- ✅ **Function Search Path Protection**: All database functions now include `SET search_path = ''` to prevent SQL injection attacks through search path manipulation
- ✅ **Row Level Security (RLS)**: Comprehensive RLS policies implemented across all tables with secure role-based access
- ✅ **Input Validation**: Robust form validation using Zod schemas
- ✅ **Authentication Security**: Secure auth implementation with proper session management
- ✅ **Security Headers**: CSP, HSTS, and other security headers implemented in application
- ✅ **Error Handling**: Production-ready error reporting and logging
- ✅ **Security Monitoring**: Real-time security event monitoring and logging

### Code Security
- ✅ **No Hardcoded Secrets**: All sensitive credentials use environment variables
- ✅ **XSS Protection**: Content Security Policy and input sanitization
- ✅ **Edge Function Security**: Proper CORS headers and authentication
- ✅ **API Security**: Rate limiting and request validation

## ⚠️ Manual Configuration Required

The following security configurations require manual setup in your Supabase dashboard:

### 1. Authentication Security (High Priority)

#### OTP Expiry Configuration
**Current Issue**: OTP expiry exceeds recommended threshold  
**Required Action**: 
1. Go to [Supabase Dashboard > Authentication > Settings](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/auth/settings)
2. Find "OTP expiry" setting
3. Set to **10 minutes** or less (recommended: 5 minutes)
4. Save changes

#### Leaked Password Protection
**Current Issue**: Leaked password protection is disabled  
**Required Action**:
1. Go to [Supabase Dashboard > Authentication > Settings](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/auth/settings)
2. Find "Password Security" section
3. Enable "Leaked password protection"
4. Save changes

**Reference**: [Supabase Password Security Guide](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

### 2. Database Schema Security (Medium Priority)

#### Extension Schema Migration
**Current Issue**: Extensions are installed in the public schema  
**Required Action**:
1. Go to [Supabase Dashboard > SQL Editor](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/sql/new)
2. Create a dedicated extensions schema:
   ```sql
   CREATE SCHEMA IF NOT EXISTS extensions;
   ```
3. Move extensions from public to extensions schema (requires careful planning)
4. Update any references to use the new schema

**Reference**: [Supabase Database Linter Guide](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)

### 3. Additional Recommended Configurations

#### URL Configuration
Ensure your Site URL and Redirect URLs are properly configured:
1. Go to [Supabase Dashboard > Authentication > URL Configuration](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/auth/url-configuration)
2. Set Site URL to your production domain
3. Add redirect URLs for all environments (development, staging, production)

#### Email Templates
Review and customize authentication email templates:
1. Go to [Supabase Dashboard > Authentication > Email Templates](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/auth/templates)
2. Customize templates to match your branding
3. Review email security settings

## 🔍 Security Monitoring

### Implemented Monitoring
- **Real-time Security Events**: Automatic logging of suspicious activities
- **Failed Authentication Tracking**: Monitoring of failed login attempts
- **Permission Escalation Detection**: Alerts for unauthorized access attempts
- **Rate Limiting**: Automatic detection of rapid request patterns
- **Error Monitoring**: Comprehensive error tracking and reporting

### Monitoring Dashboard
Access your security logs and monitoring data:
- **Edge Function Logs**: [View Function Logs](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/functions)
- **Authentication Logs**: Available in Supabase Dashboard > Authentication > Users
- **Database Logs**: Available in Supabase Dashboard > Logs

## 🛡️ Security Best Practices

### For Administrators
1. **Regular Security Reviews**: Review access logs and user permissions monthly
2. **User Role Auditing**: Regularly audit user roles and permissions
3. **Security Updates**: Keep all dependencies and Supabase features updated
4. **Backup Strategy**: Maintain secure, regular database backups

### For Developers
1. **Environment Separation**: Use different Supabase projects for development/production
2. **Secret Management**: Never commit secrets to version control
3. **Code Reviews**: Implement security-focused code review processes
4. **Testing**: Include security testing in CI/CD pipelines

### For End Users
1. **Strong Passwords**: Enforce strong password requirements
2. **Two-Factor Authentication**: Consider implementing 2FA for admin users
3. **Regular Password Updates**: Encourage periodic password changes
4. **Suspicious Activity Reporting**: Provide channels for reporting security concerns

## 📞 Security Incident Response

If you detect any security issues:

1. **Immediate Actions**:
   - Change relevant passwords
   - Review recent access logs
   - Check for unauthorized data access

2. **Investigation**:
   - Use security monitoring logs to trace the incident
   - Identify affected data and users
   - Document the timeline of events

3. **Communication**:
   - Notify affected users if data was compromised
   - Report to relevant authorities if required
   - Update security measures to prevent recurrence

## 🔗 Quick Links

- [Supabase Security Checklist](https://supabase.com/docs/guides/platform/going-into-prod#security)
- [Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [Authentication Security](https://supabase.com/docs/guides/auth/password-security)
- [Edge Function Logs](https://supabase.com/dashboard/project/kdpqimetajnhcqseajok/functions)

---

**Last Updated**: January 2025  
**Next Security Review**: Schedule monthly reviews of this configuration