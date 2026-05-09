// Route prefetch utilities for improved navigation performance

const routeImportMap: Record<string, () => Promise<any>> = {
  // Main landlord routes
  "/dashboard": () => import("@/pages/Index"),
  "/dashboard/properties": () => import("@/pages/Properties"),
  "/dashboard/units": () => import("@/pages/Units"),
  "/dashboard/tenants": () => import("@/pages/Tenants"),
  "/dashboard/leases": () => import("@/pages/Leases"),
  "/dashboard/invoices": () => import("@/pages/Invoices"),
  "/dashboard/payments": () => import("@/pages/Payments"),
  "/dashboard/maintenance": () => import("@/pages/MaintenanceRequestsLandlord"),
  "/dashboard/expenses": () => import("@/pages/Expenses"),
  "/dashboard/reports": () => import("@/pages/Reports"),
  
  // Tenant routes
  "/tenant": () => import("@/pages/tenant/TenantDashboard"),
  "/tenant/payments": () => import("@/pages/tenant/TenantPayments"),
  "/tenant/maintenance": () => import("@/pages/tenant/TenantMaintenance"),
  "/tenant/profile": () => import("@/pages/tenant/TenantProfile"),
  "/tenant/support": () => import("@/pages/tenant/TenantSupport"),
  "/tenant/messages": () => import("@/pages/tenant/TenantMessages"),
  "/tenant/payment-preferences": () => import("@/pages/tenant/TenantPaymentPreferences"),
  
  // Admin routes
  "/admin": () => import("@/pages/admin/AdminDashboard"),
  "/admin/users": () => import("@/pages/admin/UserManagement"),
  "/admin/landlords": () => import("@/pages/admin/LandlordManagement"),
  "/admin/billing": () => import("@/pages/admin/BillingDashboard"),
  "/admin/trials": () => import("@/pages/admin/TrialManagement"),
  "/admin/support": () => import("@/pages/admin/EnhancedSupportCenter"),
  "/admin/analytics": () => import("@/pages/admin/PlatformAnalytics"),
  
  // Settings and support
  "/dashboard/settings": () => import("@/pages/Settings"),
  "/dashboard/support": () => import("@/pages/Support"),
  "/dashboard/notifications": () => import("@/pages/Notifications"),
};

const prefetchedRoutes = new Set<string>();

export const prefetchRoute = (route: string) => {
  // Don't prefetch if already done
  if (prefetchedRoutes.has(route)) {
    return;
  }

  const importFn = routeImportMap[route];
  if (!importFn) {
    return;
  }

  // Prefetch the route component
  importFn()
    .then(() => {
      prefetchedRoutes.add(route);
      console.log(`✅ Prefetched route: ${route}`);
    })
    .catch((error) => {
      console.warn(`Failed to prefetch route ${route}:`, error);
    });
};

export const prefetchCommonRoutes = (userRole: string) => {
  const commonRoutes: Record<string, string[]> = {
    tenant: ["/tenant", "/tenant/payments", "/tenant/maintenance"],
    admin: ["/admin", "/admin/users", "/admin/support"],
    landlord: ["/dashboard", "/dashboard/properties", "/dashboard/tenants", "/dashboard/reports"],
    manager: ["/dashboard", "/dashboard/properties", "/dashboard/tenants"],
    agent: ["/dashboard", "/dashboard/properties", "/dashboard/tenants"],
  };

  const routes = commonRoutes[userRole] || [];
  routes.forEach(route => prefetchRoute(route));
};
