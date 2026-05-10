import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface FeatureAccessResult {
  allowed: boolean;
  is_limited: boolean;
  limit?: number;
  remaining?: number;
  reason?: string;
  status?: string;
  plan_name?: string;
  required_permission?: string;
}

interface UsePlanFeatureAccessResult extends FeatureAccessResult {
  loading: boolean;
  checkAccess: (feature: string, currentCount?: number) => Promise<FeatureAccessResult>;
  refetch: () => void;
}

export function usePlanFeatureAccess(
  featureName?: string, 
  currentCount: number = 1
): UsePlanFeatureAccessResult {
  const { user } = useAuth();
  const [result, setResult] = useState<FeatureAccessResult>({
    allowed: false,
    is_limited: true,
    reason: 'loading'
  });
  const [loading, setLoading] = useState(true);

  const checkAccess = useCallback(async (
    feature: string, 
    count: number = 1
  ): Promise<FeatureAccessResult> => {
    if (!user) {
      return {
        allowed: false,
        is_limited: true,
        reason: 'not_authenticated'
      };
    }

    try {
      console.log(`🔍 Checking access for feature: ${feature}, count: ${count}`);

      const { data, error } = await supabase.rpc('check_plan_feature_access', {
        _user_id: user.id,
        _feature: feature,
        _current_count: count
      });

      if (error) {
        // Provide clear, serializable logging
        let serialized;
        try {
          serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
        } catch (e) {
          serialized = String(error);
        }

        // Detect network/fetch failures and return a safe fallback
        if (typeof error.message === 'string' && error.message.toLowerCase().includes('failed to fetch')) {
          console.error('❌ Feature access RPC failed due to network/fetch error. This often indicates a CORS or network issue contacting Supabase. Details:', serialized);
          return {
            allowed: false,
            is_limited: true,
            reason: 'network_error',
            status: 'rpc_failed',
            plan_name: undefined
          };
        }

        console.error('❌ Feature access check error:', serialized);

        // Return a default denied response (do not throw) so callers get a predictable object
        return {
          allowed: false,
          is_limited: true,
          reason: 'rpc_error',
          status: (error as any)?.code || 'rpc_error'
        };
      }

      try {
        console.log('✅ Feature access result:', JSON.stringify(data));
      } catch (e) {
        console.log('✅ Feature access result (unserializable):', data);
      }
      return (data as any) as FeatureAccessResult;
    } catch (error) {
      // Handle unexpected errors (including network) with clearer logs
      let serialized;
      try {
        serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
      } catch (e) {
        serialized = String(error);
      }
      console.error('❌ Error checking feature access:', serialized);

      // If it's a typical network error, provide guidance
      if (typeof (error as any)?.message === 'string' && (error as any).message.toLowerCase().includes('failed to fetch')) {
        console.error('👉 Suggestion: verify NEXT_PUBLIC_SUPABASE_URL, internet connectivity, and CORS settings for your Supabase project');
      }

      return {
        allowed: false,
        is_limited: true,
        reason: 'error'
      };
    }
  }, [user]);

  const refetch = useCallback(() => {
    if (featureName) {
      setLoading(true);
      checkAccess(featureName, currentCount).then(setResult).finally(() => setLoading(false));
    }
  }, [featureName, currentCount, checkAccess]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    ...result,
    loading,
    checkAccess,
    refetch
  };
}

// Predefined feature constants for type safety
export const FEATURES = {
  // Limits
  PROPERTIES_MAX: 'properties.max',
  UNITS_MAX: 'units.max',
  TENANTS_MAX: 'tenants.max',
  SMS_QUOTA: 'sms.quota',
  
  // Core Features
  BASIC_REPORTING: 'reports.basic',
  ADVANCED_REPORTING: 'reports.advanced',
  FINANCIAL_REPORTS: 'reports.financial',
  MAINTENANCE_TRACKING: 'maintenance.tracking',
  TENANT_PORTAL: 'tenant.portal',
  INVOICING: 'invoicing.basic',
  ADVANCED_INVOICING: 'invoicing.advanced',
  MANAGE_PAYMENTS: 'payments.management',
  EXPENSE_TRACKING: 'expenses.tracking',
  
  // Dashboard Sections
  DASHBOARD_STATS_CARDS: 'dashboard.stats_cards',
  DASHBOARD_CHARTS: 'dashboard.charts',
  DASHBOARD_RECENT_ACTIVITY: 'dashboard.recent_activity',
  DASHBOARD_RECENT_PAYMENTS: 'dashboard.recent_payments',
  
  // Individual Reports
  REPORT_RENT_COLLECTION: 'reports.rent_collection',
  REPORT_OCCUPANCY: 'reports.occupancy',
  REPORT_MAINTENANCE: 'reports.maintenance_summary',
  REPORT_EXECUTIVE_SUMMARY: 'reports.executive_summary',
  REPORT_FINANCIAL_SUMMARY: 'reports.financial_summary',
  REPORT_LEASE_EXPIRY: 'reports.lease_expiry',
  REPORT_OUTSTANDING_BALANCES: 'reports.outstanding_balances',
  REPORT_TENANT_TURNOVER: 'reports.tenant_turnover',
  REPORT_PROPERTY_PERFORMANCE: 'reports.property_performance',
  REPORT_PROFIT_LOSS: 'reports.profit_loss',
  REPORT_REVENUE_VS_EXPENSES: 'reports.revenue_vs_expenses',
  REPORT_EXPENSE_SUMMARY: 'reports.expense_summary',
  REPORT_CASH_FLOW: 'reports.cash_flow',
  REPORT_MARKET_RENT: 'reports.market_rent',
  
  // Integrations
  API_ACCESS: 'integrations.api',
  ACCOUNTING_INTEGRATION: 'integrations.accounting',
  SMS_NOTIFICATIONS: 'notifications.sms',
  EMAIL_NOTIFICATIONS: 'notifications.email',
  
  // Team & Permissions
  TEAM_ROLES: 'team.roles',
  SUB_USERS: 'team.sub_users',
  ROLE_PERMISSIONS: 'team.permissions',
  
  // Branding & Customization
  WHITE_LABEL: 'branding.white_label',
  CUSTOM_BRANDING: 'branding.custom',
  
  // Support
  PRIORITY_SUPPORT: 'support.priority',
  DEDICATED_SUPPORT: 'support.dedicated',
  
  // Advanced Features
  BULK_OPERATIONS: 'operations.bulk',
  AUTOMATED_BILLING: 'billing.automated',
  DOCUMENT_TEMPLATES: 'documents.templates',
  
  // Communication Features
  CUSTOM_EMAIL_TEMPLATES: 'communication.email_templates',
  CUSTOM_SMS_TEMPLATES: 'communication.sms_templates',
  NOTIFICATION_RESPONSES: 'communication.notification_responses',
} as const;

export type Feature = typeof FEATURES[keyof typeof FEATURES];
