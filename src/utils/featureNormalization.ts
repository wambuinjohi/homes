/**
 * Normalizes feature names between plan features and code feature constants
 */

import { FEATURES } from "@/hooks/usePlanFeatureAccess";

// Map user-friendly feature names to code constants
const FEATURE_MAPPING: Record<string, string> = {
  // Basic features
  'Basic reporting': FEATURES.BASIC_REPORTING,
  'basic reporting': FEATURES.BASIC_REPORTING,
  
  // Advanced features
  'Advanced reporting': FEATURES.ADVANCED_REPORTING, 
  'advanced reporting': FEATURES.ADVANCED_REPORTING,
  
  // Financial features
  'Financial reports': FEATURES.FINANCIAL_REPORTS,
  'financial reports': FEATURES.FINANCIAL_REPORTS,
  
  // API features
  'API access': FEATURES.API_ACCESS,
  'api access': FEATURES.API_ACCESS,
  
  // Bulk operations
  'Bulk operations': FEATURES.BULK_OPERATIONS,
  'bulk operations': FEATURES.BULK_OPERATIONS,
};

/**
 * Normalize a single feature name to the standard constant
 */
export function normalizeFeatureName(featureName: string): string {
  return FEATURE_MAPPING[featureName] || featureName;
}

/**
 * Normalize an array of feature names to standard constants
 */
export function normalizeFeatures(features: string[]): string[] {
  return features.map(normalizeFeatureName);
}