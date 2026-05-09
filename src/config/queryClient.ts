import { QueryClient, DefaultOptions } from "@tanstack/react-query";

const queryConfig: DefaultOptions = {
  queries: {
    // Background refetch options - optimized for M-Pesa availability checks
    staleTime: 30 * 1000, // 30 seconds - faster refresh
    gcTime: 60 * 1000, // 60 seconds - shorter cache duration
    
    // Retry configuration
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors (client errors)
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    
    // Background updates - optimized for real-time updates
    refetchOnWindowFocus: true, // Enabled for fresh data on focus
    refetchOnReconnect: true,
    refetchOnMount: true,
    
    // Network mode
    networkMode: 'online',
  },
  mutations: {
    // Retry configuration for mutations
    retry: 1,
    retryDelay: 1000,
    networkMode: 'online',
  },
};

export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
});

export const createOptimizedQueryClient = () =>
  new QueryClient({
    defaultOptions: queryConfig,
  });

// Query Keys Factory for consistent key management
export const queryKeys = {
  // Dashboard queries
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    chartData: (period: string) => [...queryKeys.dashboard.all, 'charts', period] as const,
    recentPayments: () => [...queryKeys.dashboard.all, 'recent-payments'] as const,
    recentActivity: () => [...queryKeys.dashboard.all, 'recent-activity'] as const,
  },
  
  // Expense queries
  expenses: {
    all: ['expenses'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.expenses.all, 'list', filters] as const,
    summary: (dateRange?: { from: Date; to: Date }) => [...queryKeys.expenses.all, 'summary', dateRange] as const,
    byProperty: (propertyId: string) => [...queryKeys.expenses.all, 'by-property', propertyId] as const,
  },
  
  // Report queries
  reports: {
    all: ['reports'] as const,
    rentCollection: (filters: any) => [...queryKeys.reports.all, 'rent-collection', filters] as const,
    leaseExpiry: (filters: any) => [...queryKeys.reports.all, 'lease-expiry', filters] as const,
    occupancy: (filters: any) => [...queryKeys.reports.all, 'occupancy', filters] as const,
    outstandingBalances: (filters: any) => [...queryKeys.reports.all, 'outstanding-balances', filters] as const,
    expenseSummary: (filters: any) => [...queryKeys.reports.all, 'expense-summary', filters] as const,
    propertyPerformance: (filters: any) => [...queryKeys.reports.all, 'property-performance', filters] as const,
    profitLoss: (filters: any) => [...queryKeys.reports.all, 'profit-loss', filters] as const,
    cashFlow: (filters: any) => [...queryKeys.reports.all, 'cash-flow', filters] as const,
    maintenance: (filters: any) => [...queryKeys.reports.all, 'maintenance', filters] as const,
    executiveSummary: (filters: any) => [...queryKeys.reports.all, 'executive-summary', filters] as const,
    revenueVsExpenses: (filters: any) => [...queryKeys.reports.all, 'revenue-vs-expenses', filters] as const,
    marketRent: (filters: any) => [...queryKeys.reports.all, 'market-rent', filters] as const,
    tenantTurnover: (filters: any) => [...queryKeys.reports.all, 'tenant-turnover', filters] as const,
  },
  
  // Properties queries
  properties: {
    all: ['properties'] as const,
    list: () => [...queryKeys.properties.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.properties.all, 'detail', id] as const,
    units: (propertyId: string) => [...queryKeys.properties.all, 'units', propertyId] as const,
  },
  
  // Tenants queries
  tenants: {
    all: ['tenants'] as const,
    list: () => [...queryKeys.tenants.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.tenants.all, 'detail', id] as const,
    byProperty: (propertyId: string) => [...queryKeys.tenants.all, 'by-property', propertyId] as const,
  },
  
  // User profile and auth
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    permissions: () => [...queryKeys.user.all, 'permissions'] as const,
  },
} as const;

// Helper function to invalidate related queries
export const createQueryInvalidation = (queryClient: QueryClient) => ({
  invalidateDashboard: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  },
  
  invalidateExpenses: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
  },
  
  invalidateProperties: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.properties.all });
  },
  
  invalidateTenants: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
  },
  
  invalidateReports: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
  },
  
  // Invalidate everything - use sparingly
  invalidateAll: () => {
    queryClient.invalidateQueries();
  },
});
