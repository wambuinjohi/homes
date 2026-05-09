import { useEffect } from 'react';
import { useOptimizedReportGeneration } from '@/hooks/useOptimizedReportGeneration';
import { reportConfigs } from '@/lib/reporting/config';
import { ReportFilters } from '@/lib/reporting/types';

interface ReportPreloadManagerProps {
  selectedReports?: string[];
  filters: ReportFilters;
}

/**
 * Background component that preloads report data for faster generation
 */
export function ReportPreloadManager({ 
  selectedReports = [], 
  filters 
}: ReportPreloadManagerProps) {
  const { preloadReport } = useOptimizedReportGeneration();

  useEffect(() => {
    // Preload popular reports in the background - prioritize Financial Summary
    const popularReports = [
      'financial-summary', // High priority - comprehensive overview
      'rent-collection',
      'property-performance',
      'executive-summary',
      'profit-loss', 
      'expense-summary',
      'executive-summary'
    ];

    const reportsToPreload = selectedReports.length > 0 
      ? selectedReports 
      : popularReports;

    // Stagger preloading to avoid overwhelming the system
    reportsToPreload.forEach((reportId, index) => {
      const config = reportConfigs.find(c => c.id === reportId);
      if (config) {
        setTimeout(() => {
          preloadReport(config.queryId, filters, config.title);
        }, index * 500); // 500ms delay between each preload
      }
    });
  }, [selectedReports, filters, preloadReport]);

  // This component doesn't render anything
  return null;
}