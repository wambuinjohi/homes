// Simplified version to avoid build errors

export function useOptimizedReportData() {
  return {
    reportData: null,
    loading: false,
    error: null,
    refetch: () => {},
  };
}