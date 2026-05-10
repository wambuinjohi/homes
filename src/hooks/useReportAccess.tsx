import { usePlanFeatureAccess } from "./usePlanFeatureAccess";

// Map report IDs to feature keys
const REPORT_FEATURE_MAP: Record<string, string> = {
  'rent-collection': 'reports.rent_collection',
  'occupancy-report': 'reports.occupancy',
  'maintenance-report': 'reports.maintenance_summary',
  'executive-summary': 'reports.executive_summary',
  'financial-summary': 'reports.financial_summary',
  'lease-expiry': 'reports.lease_expiry',
  'outstanding-balances': 'reports.outstanding_balances',
  'tenant-turnover': 'reports.tenant_turnover',
  'property-performance': 'reports.property_performance',
  'profit-loss': 'reports.profit_loss',
  'revenue-vs-expenses': 'reports.revenue_vs_expenses',
  'expense-summary': 'reports.expense_summary',
  'cash-flow': 'reports.cash_flow',
  'market-rent': 'reports.market_rent',
};

export function useReportAccess(reportId: string) {
  const featureKey = REPORT_FEATURE_MAP[reportId] || 'reports.basic';
  const { allowed, loading, plan_name, reason } = usePlanFeatureAccess(featureKey);
  
  return { 
    hasAccess: allowed, 
    loading,
    requiredPlan: plan_name,
    featureKey,
    reason
  };
}

export function useAccessibleReports(reportIds: string[]) {
  // Returns only reports the user can access
  const results = reportIds.map(id => ({
    id,
    ...useReportAccess(id)
  }));
  
  return {
    accessibleReports: results.filter(r => r.hasAccess).map(r => r.id),
    allResults: results
  };
}
