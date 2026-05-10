# SPA Routing Verification Checklist

## Quick Verification Commands

Run these commands to verify SPA routing is working correctly:

### 1. Deep Link Testing
```bash
# Test that deep links return 200 (not 404)
curl -s -o /dev/null -w "%{http_code}" "https://yourdomain.com/dashboard"
curl -s -o /dev/null -w "%{http_code}" "https://yourdomain.com/properties" 
curl -s -o /dev/null -w "%{http_code}" "https://yourdomain.com/tenant/payments"
curl -s -o /dev/null -w "%{http_code}" "https://yourdomain.com/admin/users"

# All should return 200, not 404
```

### 2. Static Asset Testing
```bash
# Test that static assets are served correctly
curl -s -o /dev/null -w "%{http_code}" "https://yourdomain.com/favicon.ico"
curl -s -o /dev/null -w "%{http_code}" "https://yourdomain.com/robots.txt"

# Should return 200
```

### 3. API Route Exclusion
```bash
# Test that API routes are not rewritten to index.html
curl -s "https://yourdomain.com/api/nonexistent" | head -10

# Should NOT contain "<!DOCTYPE html>" - should be actual API response or 404
```

## Manual Testing Checklist

### ✅ Deep Link Navigation
- [ ] Navigate directly to `https://yourdomain.com/dashboard` → Shows correct page (not server 404)
- [ ] Navigate directly to `https://yourdomain.com/properties` → Shows correct page  
- [ ] Navigate directly to `https://yourdomain.com/tenants/123` → Shows correct page
- [ ] Navigate directly to `https://yourdomain.com/tenant/payments` → Shows correct page
- [ ] Navigate directly to `https://yourdomain.com/admin/users` → Shows correct page

### ✅ Page Refresh Testing
- [ ] Go to `/properties`, refresh page → Still shows properties page
- [ ] Go to `/invoices`, refresh page → Still shows invoices page
- [ ] Go to `/tenant/maintenance`, refresh page → Still shows maintenance page
- [ ] Go to `/admin/billing`, refresh page → Still shows admin billing page

### ✅ Authentication Flow
- [ ] Visit protected route while logged out → Redirects to `/auth`
- [ ] Login from `/auth` → Redirects to appropriate dashboard
- [ ] Logout from any protected route → Goes to `/auth`
- [ ] After logout, browser back button → Stays on `/auth` (doesn't re-enter protected area)

### ✅ Role-based Access
- [ ] Tenant user visits `/admin/users` → Shows access denied or redirects
- [ ] Non-admin user visits `/admin/*` routes → Proper access control
- [ ] Landlord-only routes (`/sub-users`) → Restricted to landlords

### ✅ 404 Handling
- [ ] Visit `https://yourdomain.com/this/does/not/exist` → Shows React 404 page (not server 404)
- [ ] Visit `/tenant/unknown-route` → Shows React 404 page
- [ ] Visit `/admin/unknown-route` → Shows React 404 page
- [ ] 404 page shows proper styling and branding

### ✅ Legacy Route Redirects
- [ ] Visit `/agent/dashboard` → Redirects to `/`
- [ ] Visit `/billing/payment-settings` → Redirects to `/payment-settings`
- [ ] Visit `/email-templates` → Redirects to `/billing/email-templates`

### ✅ Browser Navigation
- [ ] Navigate: Home → Properties → Tenants → Invoices
- [ ] Use browser back button → Goes to Tenants
- [ ] Use browser back button → Goes to Properties  
- [ ] Use browser forward button → Goes to Tenants
- [ ] All navigation maintains proper page state

### ✅ Static Assets
- [ ] Favicon loads correctly (`/favicon.ico`)
- [ ] Images load correctly (`/lovable-uploads/*`)
- [ ] CSS and JS chunks load from deep links
- [ ] No 404s in browser console for assets

### ✅ API Routes
- [ ] API calls work correctly (not rewritten to index.html)
- [ ] Supabase calls work correctly
- [ ] WebSocket connections work (if applicable)

### ✅ Query Parameters
- [ ] Deep link with params: `/properties?page=2&filter=active`
- [ ] Refresh page with params → Params preserved
- [ ] Navigation with params → Params handled correctly

### ✅ Hash Fragments
- [ ] URLs with hash fragments work: `/dashboard#section1`
- [ ] Refresh with hash → Fragment preserved
- [ ] Navigation with hash → Fragment handled correctly

## Automated Testing

### Unit Tests
```bash
npm run test src/tests/routing.test.tsx
```

### E2E Tests
```bash
# Cypress
npm run cypress:run cypress/e2e/spa-routing.cy.ts

# Playwright (if configured)
npx playwright test routing
```

## Server Configuration Verification

### Netlify
- [ ] `public/_redirects` file exists and is deployed
- [ ] Check Netlify deploy logs for redirect rule processing
- [ ] Test on Netlify preview URL

### Vercel
- [ ] `vercel.json` exists in project root
- [ ] Check Vercel deployment functions tab
- [ ] Test on Vercel preview URL

### Apache
- [ ] `.htaccess` file exists in document root
- [ ] Apache has mod_rewrite enabled
- [ ] Check Apache error logs for rewrite issues

### Nginx
- [ ] `nginx.conf` configured with try_files directive
- [ ] Nginx configuration reloaded
- [ ] Check Nginx error logs

### Cloudflare Pages
- [ ] `public/_redirects` file deployed
- [ ] Check Cloudflare Pages Functions tab
- [ ] Test on Cloudflare preview URL

## Troubleshooting

### Common Issues:

**Still getting server 404s:**
- [ ] Check server configuration is active
- [ ] Verify file paths and deployment
- [ ] Check server logs for errors

**API routes returning index.html:**
- [ ] Verify API exclusion rules
- [ ] Check API route patterns
- [ ] Test API endpoints directly

**Assets not loading:**
- [ ] Check static file serving configuration
- [ ] Verify asset paths in built files
- [ ] Check network tab for 404s

**Redirects not working:**
- [ ] Check redirect rule syntax
- [ ] Verify rule order (most specific first)
- [ ] Test redirect rules individually

## Performance Verification

- [ ] Lighthouse score on deep links
- [ ] Page load times from direct navigation
- [ ] Asset caching working correctly
- [ ] No unnecessary redirects

## Security Verification

- [ ] CSP headers present and correct
- [ ] X-Frame-Options header set
- [ ] No sensitive data in URLs
- [ ] HTTPS redirects working

## Cross-browser Testing

- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

## Final Checklist

- [ ] All manual tests pass
- [ ] All automated tests pass
- [ ] Server configuration deployed and active
- [ ] Performance acceptable
- [ ] Security headers in place
- [ ] Cross-browser compatibility verified
- [ ] Documentation updated
- [ ] Team informed of changes

## Pass/Fail Results

**Status**: ⏳ Pending Testing

**Last Updated**: [Date]

**Tested By**: [Name]

**Environment**: [Production/Staging URL]

**Server Config**: [Netlify/Vercel/Apache/etc.]

### Results Summary:
- Deep Links: ❌ Not Tested
- Page Refresh: ❌ Not Tested  
- Authentication: ❌ Not Tested
- 404 Handling: ❌ Not Tested
- Static Assets: ❌ Not Tested
- API Routes: ❌ Not Tested
- Browser Navigation: ❌ Not Tested

**Overall Result**: ❌ FAIL (Testing Required)

---

**Notes**: Run through this checklist after implementing SPA routing fixes to ensure everything is working correctly in your deployment environment.