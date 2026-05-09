import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePDFGeneration } from './usePDFGeneration';
import { useReportPrefetch } from './useReportPrefetch';
import { getReportData } from '@/lib/reporting/queries';
import { ReportFilters } from '@/lib/reporting/types';
import { toast } from 'sonner';

interface OptimizedGenerationState {
  isPrefetching: boolean;
  isGenerating: boolean;
  progress: number;
  currentStep: string;
}

export const useOptimizedReportGeneration = () => {
  const queryClient = useQueryClient();
  const { generatePDF, isGenerating: pdfGenerating, progress: pdfProgress, currentStep: pdfStep, isComplete } = usePDFGeneration();
  const { prefetchReportData } = useReportPrefetch();
  
  const [state, setState] = useState<OptimizedGenerationState>({
    isPrefetching: false,
    isGenerating: false,
    progress: 0,
    currentStep: ''
  });

  const generateOptimizedReport = useCallback(async (
    queryId: string,
    reportId: string,
    reportTitle: string,
    filters: ReportFilters,
    options: { tableOnly?: boolean } = {}
  ) => {
    try {
      console.time(`Optimized Report Generation: ${reportTitle}`);
      
      setState(prev => ({ 
        ...prev, 
        isPrefetching: true, 
        currentStep: 'Prefetching report data...' 
      }));

      // Step 1: Prefetch data if not already cached (use queryId for data)
      await prefetchReportData(queryId, filters, reportTitle);
      
      setState(prev => ({ 
        ...prev, 
        isPrefetching: false, 
        isGenerating: true,
        currentStep: 'Starting PDF generation...'
      }));

      // Step 2: Generate PDF using cached data (use reportId for config)
      await generatePDF(reportTitle, reportId, queryId, filters, false, options); // No charts for speed, pass options

      console.timeEnd(`Optimized Report Generation: ${reportTitle}`);
      
      setState({
        isPrefetching: false,
        isGenerating: false,
        progress: 0,
        currentStep: ''
      });

    } catch (error) {
      console.error('Optimized report generation failed:', error);
      toast.error('Failed to generate report');
      
      setState({
        isPrefetching: false,
        isGenerating: false,
        progress: 0,
        currentStep: ''
      });
    }
  }, [generatePDF, prefetchReportData]);

  const preloadReport = useCallback(async (
    reportId: string, 
    filters: ReportFilters,
    reportTitle?: string
  ) => {
    // Background prefetch without blocking UI
    prefetchReportData(reportId, filters, reportTitle);
  }, [prefetchReportData]);

  return {
    isPrefetching: state.isPrefetching,
    isGenerating: state.isGenerating || pdfGenerating,
    progress: pdfGenerating ? pdfProgress : state.progress,
    currentStep: pdfGenerating ? pdfStep : state.currentStep,
    isComplete,
    generateOptimizedReport,
    preloadReport,
    isActive: state.isPrefetching || state.isGenerating || pdfGenerating
  };
};