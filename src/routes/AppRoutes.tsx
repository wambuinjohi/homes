import React from "react";
import { Routes, Route } from "react-router-dom";
import { RequireAuth } from "@/components/RequireAuth";
import { RoleBasedRoute } from "@/components/RoleBasedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlanAccessProvider } from "@/context/PlanAccessContext";
import { LandlordOnlyRoute } from "@/components/LandlordOnlyRoute";
import { AdminOnlyRoute } from "@/components/AdminOnlyRoute";
import { SubUserBlockedRoute } from "@/components/SubUserBlockedRoute";
import { PermissionGuard } from "@/components/PermissionGuard";
import NotFound from "@/pages/NotFound";

// Import existing pages
import Auth from "@/pages/Auth";
import Index from "@/pages/Index";
import LandingPage from "@/pages/LandingPage";

// Lazy load tenant pages for better performance
const TenantDashboard = React.lazy(() => import("@/pages/tenant/TenantDashboard"));
const TenantMaintenance = React.lazy(() => import("@/pages/tenant/TenantMaintenance"));
const TenantMessages = React.lazy(() => import("@/pages/tenant/TenantMessages"));
const TenantPaymentPreferences = React.lazy(() => import("@/pages/tenant/TenantPaymentPreferences"));
const TenantPayments = React.lazy(() => import("@/pages/tenant/TenantPayments"));
const TenantProfile = React.lazy(() => import("@/pages/tenant/TenantProfile"));
const TenantSupport = React.lazy(() => import("@/pages/tenant/TenantSupport"));
const FeatureDemo = React.lazy(() => import("@/pages/FeatureDemo"));
const TestSMS = React.lazy(() => import("@/pages/TestSMS"));

// Existing landlord pages
import Properties from "@/pages/Properties";
import Units from "@/pages/Units";
import Tenants from "@/pages/Tenants";
import Invoices from "@/pages/Invoices";
import Payments from "@/pages/Payments";
import Reports from "@/pages/Reports";
import Expenses from "@/pages/Expenses";
import MaintenanceRequestsLandlord from "@/pages/MaintenanceRequestsLandlord";
import Settings from "@/pages/Settings";
import Support from "@/pages/Support";
import Notifications from "@/pages/Notifications";
import Leases from "@/pages/Leases";
import SubUsers from "@/pages/SubUsers";
import { Upgrade } from "@/pages/Upgrade";
import UpgradeSuccess from "@/pages/UpgradeSuccess";
import KnowledgeBase from "@/pages/KnowledgeBase";

// Billing pages
import Billing from "@/pages/landlord/Billing";
import BillingPanel from "@/pages/landlord/BillingPanel";  
import BillingSettings from "@/pages/landlord/BillingSettings";
import EmailTemplates from "@/pages/landlord/EmailTemplates";
import LandlordBillingPage from "@/pages/landlord/LandlordBillingPage";
import MessageTemplates from "@/pages/landlord/MessageTemplates";
import PaymentSettings from "@/pages/landlord/PaymentSettings";
import LandlordBulkMessaging from "@/pages/landlord/BulkMessaging";
import SmsUsage from "@/pages/landlord/SmsUsage";
import UnmatchedPayments from "@/pages/landlord/UnmatchedPayments";
import { Navigate } from "react-router-dom";

// Existing settings pages
import UserManagement from "@/pages/settings/UserManagement";

// Existing admin pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminInvoicesManagement from "@/pages/admin/AdminInvoicesManagement";
import AuditLogs from "@/pages/admin/AuditLogs";
import BillingDashboard from "@/pages/admin/BillingDashboard";
import BulkMessaging from "@/pages/admin/BulkMessaging";
import CommunicationSettings from "@/pages/admin/CommunicationSettings";
import AdminEmailTemplates from "@/pages/admin/EmailTemplates";
import EnhancedSupportCenter from "@/pages/admin/EnhancedSupportCenter";
import LandlordManagement from "@/pages/admin/LandlordManagement";
import AdminMessageTemplates from "@/pages/admin/MessageTemplates";
import PDFTemplateManager from "@/pages/admin/PDFTemplateManager";
import PaymentConfiguration from "@/pages/admin/PaymentConfiguration";
import PlatformPaymentConfig from "@/pages/admin/PlatformPaymentConfig";
import PlatformAnalytics from "@/pages/admin/PlatformAnalytics";
import AdminSupportCenter from "@/pages/admin/SupportCenter";
import SystemConfiguration from "@/pages/admin/SystemConfiguration";
import TrialManagement from "@/pages/admin/TrialManagement";
import AdminUserManagement from "@/pages/admin/UserManagement";
import SelfHostedMonitoring from "@/pages/admin/SelfHostedMonitoring";
import BillingPlanManager from "@/pages/admin/BillingPlanManager";
import SMSLogs from "@/pages/admin/SMSLogs";
import PlanFeaturesManagement from "@/pages/admin/PlanFeaturesManagement";
import { MpesaTest } from "@/pages/MpesaTest";
import JengaPaymentTest from "@/pages/admin/JengaPaymentTest";
import PartnerLogosManager from "@/pages/admin/PartnerLogosManager";

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<LandingPage />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/test-sms" element={
        <React.Suspense fallback={<LoadingSpinner />}>
          <TestSMS />
        </React.Suspense>
      } />
      
      {/* Tenant routes with lazy loading */}
      <Route
        path="/tenant/*"
        element={
          <RequireAuth>
            <RoleBasedRoute>
              <React.Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route index element={<TenantDashboard />} />
                  <Route path="maintenance" element={<TenantMaintenance />} />
                  <Route path="messages" element={<TenantMessages />} />
                  <Route path="payment-preferences" element={<TenantPaymentPreferences />} />
                  <Route path="payments" element={<TenantPayments />} />
                  <Route path="profile" element={<TenantProfile />} />
                  <Route path="support" element={<TenantSupport />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </React.Suspense>
            </RoleBasedRoute>
          </RequireAuth>
        }
      />

      {/* Landlord routes */}
      <Route
        path="/dashboard/*"
        element={
          <RequireAuth>
            <RoleBasedRoute>
              <PlanAccessProvider>
                <Routes>
                <Route path="/" element={<Index />} />
                {/* Redirect from /agent/dashboard to main dashboard */}
                <Route path="/agent/dashboard" element={<Navigate to="/dashboard" replace />} />
                <Route path="/properties" element={
                  <PermissionGuard permission="manage_properties">
                    <Properties />
                  </PermissionGuard>
                } />
                <Route path="/units" element={
                  <PermissionGuard permission="manage_properties">
                    <Units />
                  </PermissionGuard>
                } />
                <Route path="/tenants" element={
                  <PermissionGuard permission="manage_tenants">
                    <Tenants />
                  </PermissionGuard>
                } />
                <Route path="/invoices" element={
                  <PermissionGuard permission="manage_payments">
                    <Invoices />
                  </PermissionGuard>
                } />
                <Route path="/payments" element={
                  <PermissionGuard permission="manage_payments">
                    <Payments />
                  </PermissionGuard>
                } />
                <Route path="/reports" element={
                  <PermissionGuard permission="view_reports">
                    <Reports />
                  </PermissionGuard>
                } />
                <Route path="/expenses" element={
                  <PermissionGuard permission="manage_expenses">
                    <Expenses />
                  </PermissionGuard>
                } />
                <Route path="/maintenance" element={
                  <PermissionGuard permission="manage_maintenance">
                    <MaintenanceRequestsLandlord />
                  </PermissionGuard>
                } />
                <Route path="/settings" element={<Settings />} />
                <Route path="/support" element={<Support />} />
                <Route path="/notifications" element={
                  <PermissionGuard permission="view_reports">
                    <Notifications />
                  </PermissionGuard>
                } />
                <Route path="/leases" element={
                  <PermissionGuard permission="manage_leases">
                    <Leases />
                  </PermissionGuard>
                } />
                <Route path="/sub-users" element={
                  <SubUserBlockedRoute>
                    <LandlordOnlyRoute>
                      <SubUsers />
                    </LandlordOnlyRoute>
                  </SubUserBlockedRoute>
                } />
                <Route path="/upgrade" element={
                  <SubUserBlockedRoute>
                    <Upgrade />
                  </SubUserBlockedRoute>
                } />
                <Route path="/upgrade-success" element={<UpgradeSuccess />} />
                <Route path="/knowledge-base" element={<KnowledgeBase />} />
                <Route path="/feature-demo" element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <FeatureDemo />
                  </React.Suspense>
                } />
                
                {/* Payment Settings Route (primary) */}
                <Route path="/payment-settings" element={
                  <SubUserBlockedRoute>
                    <PaymentSettings />
                  </SubUserBlockedRoute>
                } />
                
                {/* Unmatched Payments Route */}
                <Route path="/unmatched-payments" element={
                  <SubUserBlockedRoute>
                    <UnmatchedPayments />
                  </SubUserBlockedRoute>
                } />
                
                {/* Legacy Payment Settings Routes (redirects) */}
                <Route path="/billing/payment-settings" element={<Navigate to="/payment-settings" replace />} />
                <Route path="/landlord/payment-settings" element={<Navigate to="/payment-settings" replace />} />
                
                {/* Legacy Sub-Users Route (redirect) */}
                <Route path="/landlord/sub-users" element={<Navigate to="/sub-users" replace />} />
                
                {/* Legacy Template Routes (redirects) */}
                <Route path="/email-templates" element={<Navigate to="/billing/email-templates" replace />} />
                <Route path="/message-templates" element={<Navigate to="/billing/message-templates" replace />} />
                
                {/* Unified Billing Route */}
                <Route path="/billing" element={
                  <SubUserBlockedRoute>
                    <Billing />
                  </SubUserBlockedRoute>
                } />
                <Route path="/billing/email-templates" element={
                  <PermissionGuard permission="send_messages">
                    <EmailTemplates />
                  </PermissionGuard>
                } />
                <Route path="/billing/message-templates" element={
                  <PermissionGuard permission="send_messages">
                    <MessageTemplates />
                  </PermissionGuard>
                } />
                
                {/* Landlord SMS Routes */}
                <Route path="/landlord/bulk-messaging" element={
                  <PermissionGuard permission="send_messages">
                    <LandlordBulkMessaging />
                  </PermissionGuard>
                } />
                <Route path="/landlord/sms-usage" element={
                  <PermissionGuard permission="send_messages">
                    <SmsUsage />
                  </PermissionGuard>
                } />
                
                {/* Legacy routes for backward compatibility */}
                <Route path="/billing/details" element={<Navigate to="/billing" replace />} />
                <Route path="/billing/panel" element={
                  <SubUserBlockedRoute>
                    <BillingPanel />
                  </SubUserBlockedRoute>
                } />
                <Route path="/billing/settings" element={
                  <SubUserBlockedRoute>
                    <BillingSettings />
                  </SubUserBlockedRoute>
                } />
                <Route path="/billing/landlord-billing" element={<LandlordBillingPage />} />
                
                {/* Settings routes */}
                <Route path="/settings/users" element={<UserManagement />} />
                
                {/* Catch all unknown routes within protected area */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </PlanAccessProvider>
            </RoleBasedRoute>
          </RequireAuth>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin/*"
        element={
          <RequireAuth>
            <RoleBasedRoute>
              <AdminOnlyRoute>
                <Routes>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/invoices" element={<AdminInvoicesManagement />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/billing" element={<BillingDashboard />} />
                <Route path="/bulk-messaging" element={<BulkMessaging />} />
                <Route path="/communication" element={<CommunicationSettings />} />
                <Route path="/email-templates" element={<AdminEmailTemplates />} />
                <Route path="/enhanced-support" element={<EnhancedSupportCenter />} />
                <Route path="/landlords" element={<LandlordManagement />} />
                <Route path="/message-templates" element={<AdminMessageTemplates />} />
                <Route path="/pdf-templates" element={<PDFTemplateManager />} />
                <Route path="/payment-config" element={<PaymentConfiguration />} />
                <Route path="/platform-payment-config" element={<PlatformPaymentConfig />} />
                <Route path="/analytics" element={<PlatformAnalytics />} />
                <Route path="/support" element={<AdminSupportCenter />} />
                <Route path="/system" element={<SystemConfiguration />} />
                <Route path="/trials" element={<TrialManagement />} />
                <Route path="/users" element={<AdminUserManagement />} />
                <Route path="/self-hosted" element={<SelfHostedMonitoring />} />
                <Route path="/billing-plans" element={<BillingPlanManager />} />
                <Route path="/plan-features" element={<PlanFeaturesManagement />} />
                <Route path="/sms-logs" element={<SMSLogs />} />
                <Route path="/mpesa-test" element={<MpesaTest />} />
                <Route path="/jenga-payment-test" element={<JengaPaymentTest />} />
                <Route path="/partner-logos" element={<PartnerLogosManager />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </AdminOnlyRoute>
            </RoleBasedRoute>
          </RequireAuth>
        }
      />

      {/* Global fallback route for truly unknown paths */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
