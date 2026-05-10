# SPA Routing Audit & Configuration

## Route Inventory

### Public Routes
| Path | Component | Public/Protected | Needs Server Rewrite | Notes |
|------|-----------|------------------|---------------------|--------|
| `/auth` | Auth | Public | No | Login/signup page |

### Tenant Routes (Protected)
| Path | Component | Protected | Needs Server Rewrite | Notes |
|------|-----------|-----------|---------------------|--------|
| `/tenant` | TenantDashboard | Yes | Yes | Tenant dashboard home |
| `/tenant/maintenance` | TenantMaintenance | Yes | Yes | Maintenance requests |
| `/tenant/messages` | TenantMessages | Yes | Yes | Tenant messaging |
| `/tenant/payment-preferences` | TenantPaymentPreferences | Yes | Yes | Payment settings |
| `/tenant/payments` | TenantPayments | Yes | Yes | Payment history |
| `/tenant/profile` | TenantProfile | Yes | Yes | Tenant profile |
| `/tenant/support` | TenantSupport | Yes | Yes | Support tickets |

### Landlord/Manager Routes (Protected)
| Path | Component | Protected | Needs Server Rewrite | Notes |
|------|-----------|-----------|---------------------|--------|
| `/` | Index | Yes | Yes | Main dashboard |
| `/properties` | Properties | Yes | Yes | Property management |
| `/units` | Units | Yes | Yes | Unit management |
| `/tenants` | Tenants | Yes | Yes | Tenant management |
| `/invoices` | Invoices | Yes | Yes | Invoice management |
| `/payments` | Payments | Yes | Yes | Payment tracking |
| `/reports` | Reports | Yes | Yes | Reporting dashboard |
| `/expenses` | Expenses | Yes | Yes | Expense tracking |
| `/maintenance` | MaintenanceRequestsLandlord | Yes | Yes | Maintenance management |
| `/settings` | Settings | Yes | Yes | Application settings |
| `/support` | Support | Yes | Yes | Support system |
| `/notifications` | Notifications | Yes | Yes | Notification center |
| `/leases` | Leases | Yes | Yes | Lease management |
| `/sub-users` | SubUsers | Yes (Landlord only) | Yes | Sub-user management |
| `/upgrade` | Upgrade | Yes | Yes | Plan upgrade page |
| `/upgrade-success` | UpgradeSuccess | Yes | Yes | Upgrade confirmation |
| `/knowledge-base` | KnowledgeBase | Yes | Yes | Documentation |
| `/feature-demo` | FeatureDemo | Yes | Yes | Feature demonstration |

### Billing Routes (Protected)
| Path | Component | Protected | Needs Server Rewrite | Notes |
|------|-----------|-----------|---------------------|--------|
| `/payment-settings` | PaymentSettings | Yes | Yes | Primary payment settings |
| `/billing` | Billing | Yes | Yes | Billing overview |
| `/billing/email-templates` | EmailTemplates | Yes | Yes | Email template management |
| `/billing/message-templates` | MessageTemplates | Yes | Yes | Message template management |
| `/billing/panel` | BillingPanel | Yes | Yes | Billing control panel |
| `/billing/settings` | BillingSettings | Yes | Yes | Billing configuration |
| `/billing/landlord-billing` | LandlordBillingPage | Yes | Yes | Landlord billing view |

### Settings Routes (Protected)
| Path | Component | Protected | Needs Server Rewrite | Notes |
|------|-----------|-----------|---------------------|--------|
| `/settings/users` | UserManagement | Yes | Yes | User management |

### Admin Routes (Protected - Admin only)
| Path | Component | Protected | Needs Server Rewrite | Notes |
|------|-----------|-----------|---------------------|--------|
| `/admin` | AdminDashboard | Yes (Admin only) | Yes | Admin dashboard |
| `/admin/invoices` | AdminInvoicesManagement | Yes (Admin only) | Yes | Invoice administration |
| `/admin/audit-logs` | AuditLogs | Yes (Admin only) | Yes | System audit logs |
| `/admin/billing` | BillingDashboard | Yes (Admin only) | Yes | Billing administration |
| `/admin/bulk-messaging` | BulkMessaging | Yes (Admin only) | Yes | Bulk messaging system |
| `/admin/communication` | CommunicationSettings | Yes (Admin only) | Yes | Communication configuration |
| `/admin/email-templates` | AdminEmailTemplates | Yes (Admin only) | Yes | Admin email templates |
| `/admin/enhanced-support` | EnhancedSupportCenter | Yes (Admin only) | Yes | Enhanced support center |
| `/admin/landlords` | LandlordManagement | Yes (Admin only) | Yes | Landlord administration |
| `/admin/message-templates` | AdminMessageTemplates | Yes (Admin only) | Yes | Admin message templates |
| `/admin/pdf-templates` | PDFTemplateManager | Yes (Admin only) | Yes | PDF template management |
| `/admin/payment-config` | PaymentConfiguration | Yes (Admin only) | Yes | Payment configuration |
| `/admin/analytics` | PlatformAnalytics | Yes (Admin only) | Yes | Platform analytics |
| `/admin/support` | AdminSupportCenter | Yes (Admin only) | Yes | Admin support center |
| `/admin/system` | SystemConfiguration | Yes (Admin only) | Yes | System configuration |
| `/admin/trials` | TrialManagement | Yes (Admin only) | Yes | Trial management |
| `/admin/users` | AdminUserManagement | Yes (Admin only) | Yes | User administration |
| `/admin/self-hosted` | SelfHostedMonitoring | Yes (Admin only) | Yes | Self-hosted monitoring |
| `/admin/billing-plans` | BillingPlanManager | Yes (Admin only) | Yes | Billing plan management |

### Legacy Redirects
| Original Path | Redirects To | Notes |
|---------------|--------------|--------|
| `/agent/dashboard` | `/` | Legacy agent dashboard redirect |
| `/billing/payment-settings` | `/payment-settings` | Legacy billing payment settings |
| `/landlord/payment-settings` | `/payment-settings` | Legacy landlord payment settings |
| `/email-templates` | `/billing/email-templates` | Legacy email templates |
| `/message-templates` | `/billing/message-templates` | Legacy message templates |
| `/billing/details` | `/billing` | Legacy billing details |

### Fallback Routes
| Path | Component | Notes |
|------|-----------|--------|
| `*` (within tenant area) | NotFound | Tenant-specific 404 |
| `*` (within admin area) | NotFound | Admin-specific 404 |
| `*` (global catch-all) | NotFound | Global 404 handler |

## Router Configuration

- **Router Type**: BrowserRouter (React Router v6)
- **Base Path**: Configurable via `VITE_BASE_PATH` environment variable (defaults to "/")
- **History Mode**: HTML5 History API (requires server-side rewrites)

## Server Configuration Status

### Active Configurations Created:
- ✅ **Netlify**: `public/_redirects`
- ✅ **Cloudflare Pages**: `public/_redirects` (same file)
- ✅ **Apache**: `public/.htaccess`
- ✅ **Vercel**: `vercel.json`
- ✅ **Firebase**: `firebase.json`
- ✅ **Nginx**: `nginx.conf`
- ✅ **Express/Node**: `server.js`
- ✅ **AWS S3/CloudFront**: Documented in `docs/s3-cloudfront-spa-rewrite.md`

### Key Features:
- API route exclusion (`/api/*`, `/supabase/*`)
- Static asset serving with proper cache headers
- Security headers (CSP, X-Frame-Options, etc.)
- Proper CORS handling
- SPA fallback to `index.html` for all non-file routes

## Authentication & Route Protection

### Protection Levels:
1. **Public**: Accessible without authentication
2. **Protected**: Requires valid user session
3. **Role-based**: Requires specific user role (Admin, Landlord, Tenant, etc.)

### Logout Flow:
- Clears Supabase session (global scope)
- Removes local/session storage tokens
- Clears React Query cache
- Redirects to `/auth` with `window.location.href` (replaces history)
- Prevents back-navigation to protected routes

### Deep Link Handling:
- Unauthenticated users redirected to `/auth` with return path preserved
- Role-based redirects ensure users land on appropriate dashboard
- 404 handling shows React NotFound component (not server 404)

## Testing Checklist

Use this checklist to verify SPA routing is working correctly:

### Manual Testing:
- [ ] Direct navigation to `/dashboard` works (shows correct page, not 404)
- [ ] Refresh on `/invoices/123` maintains the page state
- [ ] Deep link to `/tenant/payments` works for tenant users
- [ ] Logout from any protected route → lands on `/auth`
- [ ] Browser back button after logout doesn't re-enter protected area
- [ ] Unknown route `/this/does/not/exist` shows React NotFound (not server 404)
- [ ] API calls to `/api/*` or `/supabase/*` work correctly (not rewritten)
- [ ] Static assets (`/favicon.ico`, `/assets/*`) load properly

### Automated Testing Script:
```bash
#!/bin/bash
# SPA Routing Verification Script

echo "Testing SPA Routing..."

BASE_URL="https://yourdomain.com"

# Test deep links return 200
echo "Testing deep links..."
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/dashboard" | grep -q "200" && echo "✅ /dashboard" || echo "❌ /dashboard"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/properties" | grep -q "200" && echo "✅ /properties" || echo "❌ /properties"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/tenant/payments" | grep -q "200" && echo "✅ /tenant/payments" || echo "❌ /tenant/payments"

# Test that unknown routes return index.html (200, not 404)
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/nonexistent/route" | grep -q "200" && echo "✅ Unknown routes return 200" || echo "❌ Unknown routes return 404"

# Test static assets are not rewritten
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/favicon.ico" | grep -q "200" && echo "✅ Static assets work" || echo "❌ Static assets broken"

echo "SPA Routing test complete!"
```

## Performance Optimizations

### Lazy Loading:
- Tenant routes are lazy-loaded with React.lazy()
- Feature demo page is lazy-loaded
- Loading spinner shows during code splitting

### Caching Strategy:
- Static assets cached with 1-year expiration
- HTML files (index.html) not cached to ensure updates
- API routes excluded from SPA caching

### Bundle Optimization:
- Vite's built-in code splitting
- Dynamic imports for route-level chunks
- Proper base path configuration for CDN hosting