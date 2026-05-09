import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import type { ReportConfig } from "./types";

// Map reports to required features
export const REPORT_FEATURE_MAP: Record<string, string> = {
  // Basic reports (Starter plan)
  'rent-collection': FEATURES.BASIC_REPORTING,
  'occupancy-report': FEATURES.BASIC_REPORTING,
  'maintenance-report': FEATURES.BASIC_REPORTING,
  'executive-summary': FEATURES.BASIC_REPORTING,
  
  // Pro reports require advanced reporting features
  'financial-summary': FEATURES.ADVANCED_REPORTING,
  'lease-expiry': FEATURES.ADVANCED_REPORTING,
  'outstanding-balances': FEATURES.ADVANCED_REPORTING,
  'tenant-turnover': FEATURES.ADVANCED_REPORTING,
  'property-performance': FEATURES.ADVANCED_REPORTING,
  'profit-loss': FEATURES.FINANCIAL_REPORTS,
  'revenue-vs-expenses': FEATURES.FINANCIAL_REPORTS,
  'expense-summary': FEATURES.FINANCIAL_REPORTS,
  'cash-flow': FEATURES.FINANCIAL_REPORTS,
  'market-rent': FEATURES.ADVANCED_REPORTING,
};

/**
 * Get the required feature for a report
 */
export function getReportFeature(reportId: string): string {
  return REPORT_FEATURE_MAP[reportId] || FEATURES.BASIC_REPORTING;
}

/**
 * Filter reports based on user's plan features
 */
export function filterReportsByFeatures(
  reports: ReportConfig[], 
  userFeatures: string[]
): ReportConfig[] {
  return reports.filter(report => {
    const requiredFeature = getReportFeature(report.id);
    return userFeatures.includes(requiredFeature);
  });
}

/**
 * Check if user can access a specific report
 */
export function canAccessReport(reportId: string, userFeatures: string[]): boolean {
  const requiredFeature = getReportFeature(reportId);
  return userFeatures.includes(requiredFeature);
}