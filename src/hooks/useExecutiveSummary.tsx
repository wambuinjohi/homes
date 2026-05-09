import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useExecutiveSummary = () => {
  // Start with current month, fallback to YTD if no data
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const currentMonthEnd = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const ytdStartDate = `${currentYear}-01-01`;
  const ytdEndDate = new Date().toISOString().split('T')[0];

  // First try current month
  const { data: currentMonthData, isLoading: currentMonthLoading, error: currentMonthError } = useQuery({
    queryKey: ['executive-summary-current-month', currentMonthStart, currentMonthEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_executive_summary_report', {
        p_start_date: currentMonthStart,
        p_end_date: currentMonthEnd,
        p_include_tenant_scope: true
      });
      
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for current month
    retry: 1,
  });

  // Check if current month has meaningful data
  const hasCurrentMonthData = (currentMonthData as any)?.kpis?.total_revenue > 0;
  
  // Debug logging with meta data
  console.log('📊 Executive Summary Debug:', {
    period: 'current_month',
    hasData: hasCurrentMonthData,
    kpis: (currentMonthData as any)?.kpis,
    meta: (currentMonthData as any)?.meta
  });
  
  const { data: ytdData, isLoading: ytdLoading, error: ytdError } = useQuery({
    queryKey: ['executive-summary-ytd', ytdStartDate, ytdEndDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_executive_summary_report', {
        p_start_date: ytdStartDate,
        p_end_date: ytdEndDate,
        p_include_tenant_scope: true
      });
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for YTD
    enabled: !currentMonthLoading && !hasCurrentMonthData, // Only fetch if current month has no meaningful data
    retry: 1,
  });

  // Use current month data if available, otherwise YTD
  const executiveData = hasCurrentMonthData ? currentMonthData : ytdData;
  const isLoading = currentMonthLoading || (ytdLoading && !hasCurrentMonthData);
  const hasError = currentMonthError || ytdError;

  // Extract KPIs from the comprehensive report with better error handling
  const totalRevenue = (executiveData as any)?.kpis?.total_revenue || 0;
  const totalOperatingExpenses = (executiveData as any)?.kpis?.total_expenses || 0;
  const netOperatingIncome = (executiveData as any)?.kpis?.net_operating_income || 0;
  const outstandingAmount = (executiveData as any)?.kpis?.total_outstanding || 0;

  return {
    totalRevenue,
    netOperatingIncome,
    outstandingAmount,
    totalOperatingExpenses,
    collectionRate: (executiveData as any)?.kpis?.collection_rate || 0,
    occupancyRate: (executiveData as any)?.kpis?.occupancy_rate || 0,
    isLoading,
    hasData: !isLoading && executiveData && !hasError,
    hasError,
    periodType: hasCurrentMonthData ? 'current_month' : 'ytd',
    periodLabel: hasCurrentMonthData ? 'This Month' : 'YTD'
  };
};