import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/auth': 'Authentication',
  '/tenant': 'Tenant Dashboard',
  '/tenant/payments': 'Payments & Invoices',
  '/tenant/maintenance': 'Maintenance Requests',
  '/tenant/messages': 'Messages',
  '/tenant/profile': 'My Profile',
  '/tenant/support': 'Help & Support',
  '/tenant/payment-preferences': 'Payment Settings',
  '/dashboard/properties': 'Properties',
  '/dashboard/units': 'Units',
  '/dashboard/tenants': 'Tenants',
  '/dashboard/invoices': 'Invoices',
  '/dashboard/payments': 'Payments',
  '/dashboard/expenses': 'Expenses',
  '/dashboard/reports': 'Reports',
  '/dashboard/settings': 'Settings',
  '/dashboard/support': 'Support',
  '/dashboard/knowledge-base': 'Knowledge Base',
  '/dashboard/notifications': 'Notifications',
  '/dashboard/sub-users': 'Sub Users',
  '/dashboard/leases': 'Leases',
  '/dashboard/maintenance': 'Maintenance Requests',
  '/dashboard/upgrade': 'Plans & Pricing',
  '/dashboard/billing': 'Billing & Subscription',
  '/dashboard/payment-settings': 'Payment Settings',
  '/dashboard/unmatched-payments': 'Unmatched Payments',
  '/dashboard/landlord/bulk-messaging': 'Bulk Messaging',
  '/dashboard/landlord/sms-usage': 'SMS Usage',
  '/dashboard/billing/email-templates': 'Email Templates',
  '/dashboard/billing/message-templates': 'Message Templates',
  '/admin': 'Admin Dashboard',
  '/admin/users': 'User Management',
  '/admin/landlords': 'Landlord Management',
  '/admin/invoices': 'Admin Invoices',
  '/admin/billing': 'Billing Dashboard',
  '/admin/trials': 'Trial Management',
  '/admin/support': 'Support Center',
  '/admin/communication': 'Communication Settings',
  '/admin/payment-config': 'Payment Configuration',
  '/admin/analytics': 'Platform Analytics',
  '/admin/system': 'System Configuration',
  '/admin/pdf-templates': 'PDF Templates',
  '/admin/audit-logs': 'Audit Logs',
  '/admin/bulk-messaging': 'Bulk Messaging',
  '/admin/email-templates': 'Email Templates',
  '/admin/message-templates': 'Message Templates',
};

const findBestMatchingRoute = (pathname: string): string => {
  // First, try exact match
  if (routeTitles[pathname]) {
    return routeTitles[pathname];
  }
  
  // Then try longest prefix match
  const sortedRoutes = Object.keys(routeTitles).sort((a, b) => b.length - a.length);
  for (const route of sortedRoutes) {
    if (route !== '/' && pathname.startsWith(route)) {
      return routeTitles[route];
    }
  }
  
  // Default fallback
  return 'Dashboard';
};

export const useRouteTitle = () => {
  const location = useLocation();
  
  useEffect(() => {
    const title = findBestMatchingRoute(location.pathname);
    document.title = `${title} | Zira Homes`;
  }, [location.pathname]);
  
  return findBestMatchingRoute(location.pathname);
};
