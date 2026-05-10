import { useQueryClient } from '@tanstack/react-query';
import { getReportData } from '@/lib/reporting/queries';
import { ReportFilters } from '@/lib/reporting/types';
import { useCallback } from 'react';

/**
 * Hook for prefetching report data to speed up preview and PDF generation
 */
export const useReportPrefetch = () => {
  const queryClient = useQueryClient();

  const prefetchReportData = useCallback(async (
    queryId: string, 
    filters: ReportFilters,
    reportTitle?: string
  ) => {
    const queryKey = ['report-data', queryId, filters];
    
    // Check if data is already cached
    const existingData = queryClient.getQueryData(queryKey);
    if (existingData) {
      console.log(`Report data already cached for ${reportTitle || queryId}`);
      return;
    }

    try {
      console.log(`Prefetching report data for ${reportTitle || queryId}...`);
      console.time(`Prefetch: ${reportTitle || queryId}`);
      
      // Prefetch the data
      await queryClient.prefetchQuery({
        queryKey,
        queryFn: () => getReportData(queryId, filters),
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
      
      console.timeEnd(`Prefetch: ${reportTitle || queryId}`);
      console.log(`✅ Successfully prefetched data for ${reportTitle || queryId}`);
    } catch (error) {
      console.warn(`Failed to prefetch data for ${reportTitle || queryId}:`, error);
    }
  }, [queryClient]);

  return {
    prefetchReportData
  };
};