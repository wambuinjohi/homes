export function useReportData() {
  return {
    reportData: null,
    loading: false,
    error: null,
    refetch: () => {},
    generateReport: () => Promise.resolve(),
  };
}

// Export all the missing functions as stubs
export function useRentCollectionData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useLeaseExpiryData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useOccupancyData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useOutstandingBalancesData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useExpenseSummaryData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function usePropertyPerformanceData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useProfitLossData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useCashFlowData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useMaintenanceReportData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useExecutiveSummaryData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useMarketRentData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useTenantTurnoverData() { return { data: null, loading: false, error: null, refetch: () => {} }; }
export function useRevenueVsExpensesData() { return { data: null, loading: false, error: null, refetch: () => {} }; }

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
}

export default useReportData;